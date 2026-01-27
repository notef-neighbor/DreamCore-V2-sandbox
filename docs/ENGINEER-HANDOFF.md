# Modal Sandbox 実装 - エンジニア引き継ぎ文書

**作成日**: 2026-01-27
**最終更新**: 2026-01-27
**対象プロジェクト**: DreamCore-V2 Modal Sandbox 化

---

## 1. 最終決定アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser                                   │
│                    (変更なし・WebSocket)                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express Server                                │
│   【UX/API契約の本体】                                            │
│   - 認証（JWT検証・Supabase Auth）                                │
│   - WebSocket管理                                                │
│   - DB操作（Supabase）                                           │
│   - アセット管理（/api/assets）                                   │
│   - SSE→WS変換                                                   │
│   - Modal呼び出し                                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP + SSE
                      │ X-Modal-Secret ヘッダー
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Modal Sandbox                                 │
│   【実行専用】                                                    │
│   - Claude CLI 実行 ✅ 動作確認済み                               │
│   - Python 実行 ✅ 動作確認済み                                   │
│   - Git 操作 ✅ 動作確認済み                                      │
│   - ファイル I/O                                                  │
│   ※ DB操作は行わない                                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Modal Volume                                  │
│     dreamcore-data: /data/users/{user_id}/projects/              │
│     dreamcore-global: /skills/ (共有・読み取り専用)               │
└─────────────────────────────────────────────────────────────────┘
```

### 決定事項サマリ

| 項目 | 決定内容 |
|------|----------|
| UX | **完全維持**（WebSocketそのまま、フロントエンド変更なし） |
| Express | **UX/API契約の本体**（中継だけでなくDB・認証・アセット管理を担当） |
| Modal | **実行専用**（Claude CLI / Python / Git / ファイルI/O のみ） |
| DB操作 | **Express側に集約**（ModalにはSupabase認証情報を渡さない） |
| サンドボックス | Modal gVisor で実現 |
| スケール | Modal側が自動対応 |

---

## 2. SSE → WebSocket 変換ルール（固定）

Modal（SSE）から Express が受信したイベントを WebSocket メッセージに変換する際のマッピング:

| SSE event | WS message type | 備考 |
|-----------|-----------------|------|
| `event: status` | `{ type: 'progress', message: ... }` | 進捗表示用 |
| `event: stream` | `{ type: 'stream', content: ... }` | ストリーミング出力 |
| `event: done` | `{ type: 'completed', result: ... }` | 正常完了 |
| `event: error` | `{ type: 'failed', error: ... }` | エラー終了 |

**実装例（Express側）**:
```javascript
// modalClient.js
function convertSseToWsEvent(sseEvent) {
  const mapping = {
    'status': 'progress',
    'stream': 'stream',
    'done': 'completed',
    'error': 'failed'
  };
  return {
    type: mapping[sseEvent.event] || sseEvent.event,
    ...sseEvent.data
  };
}
```

---

## 3. 参照ドキュメント

### 移行計画・設計書（実装時に必ず参照）

| ドキュメント | パス | 内容 |
|-------------|------|------|
| 移行計画書 | `/Users/admin/DreamCore-V2-sandbox/docs/MODAL-MIGRATION-PLAN.md` | 6フェーズの移行計画、4層防御、ロールバック計画 |
| 技術設計書 | `/Users/admin/DreamCore-V2-sandbox/docs/MODAL-DESIGN.md` | modalClient.js、claudeRunner.js修正、SSE→WS変換の実装詳細 |
| V2アーキテクチャ | `/Users/admin/DreamCore-V2-sandbox/docs/ARCHITECTURE-V2.md` | 現行DreamCore-V2の正確なアーキテクチャ |

### Modal固有の参照資料

| ドキュメント | パス | 内容 |
|-------------|------|------|
| Modalアーキテクチャ | `/Users/admin/DreamCore-V2-sandbox/docs/modal-architecture/MODAL-SANDBOX-ARCHITECTURE.md` | Modal側の設計パターン、セキュリティ、I/O |
| クイックリファレンス | `/Users/admin/DreamCore-V2-sandbox/docs/modal-architecture/QUICK-REFERENCE.md` | Modalコマンド、SSEヘッダー、デバッグシグナル |

### 現行実装の参照（DreamCore-V2本体）

| ファイル | パス | 参照理由 |
|----------|------|----------|
| Claude実行 | `/Users/admin/DreamCore-V2/server/claudeRunner.js` | Modal統合の改修対象 |
| ジョブ管理 | `/Users/admin/DreamCore-V2/server/jobManager.js` | ジョブキュー・状態管理 |
| 認証 | `/Users/admin/DreamCore-V2/server/authMiddleware.js` | JWT検証ロジック |
| 設定 | `/Users/admin/DreamCore-V2/server/config.js` | 環境変数・レート制限 |
| DB操作 | `/Users/admin/DreamCore-V2/server/database-supabase.js` | Supabase操作（Express側で維持） |

---

## 4. Modal化対象と対象外

### Modal化対象（実行をModalに移行）

| 機能 | 状態 | 備考 |
|------|------|------|
| Claude CLI 実行 | ✅ 動作確認済み | sandbox.exec() で実行 |
| Python スクリプト | ✅ 動作確認済み | subprocess または sandbox.exec() |
| Git 操作 | ✅ 動作確認済み | Volume内で実行 |
| ファイル I/O | ✅ 動作確認済み | Modal Volume に永続化 |

### Modal化対象外（Express側で維持）

| 機能 | 理由 |
|------|------|
| `/api/assets/*` | DB操作を伴うため |
| `/api/projects/*` | DB操作を伴うため |
| 認証・JWT検証 | セキュリティ上の理由 |
| WebSocket管理 | UX契約維持のため |
| Supabase操作 | DB操作はExpress集約方針 |

---

## 5. アセット管理（製品版必須）

アセット管理はExpress側で維持し、以下を復活させる:

### 必須コンポーネント

| コンポーネント | 説明 |
|---------------|------|
| `assets` テーブル | Supabase PostgreSQL でメタデータ管理 |
| `project_assets` テーブル | プロジェクトとアセットの関連付け |
| `/api/assets/:id` | アセット取得エンドポイント |
| `replaceAssetReferences()` | 生成コード内のアセット参照を解決 |

### アセットの流れ

```
1. ユーザーがアセットをアップロード
   → Express: /api/assets (POST)
   → Supabase Storage に保存
   → assets テーブルにメタデータ登録

2. ゲーム生成時
   → Modal: Claude CLI がコード生成
   → Express: replaceAssetReferences() でアセットURLを解決
   → ブラウザ: 正しいURLでアセット取得
```

---

## 6. 実装すべきコンポーネント

### 6.1 Modal側（Python）

**ファイル**: `modal_app/sandbox.py`（新規作成）

```python
# エンドポイント
@app.function()
@modal.web_endpoint(method="POST")
async def generate(request: Request):
    # 1. X-Modal-Secret 検証
    # 2. リクエストパラメータ検証（UUID形式）
    # 3. Sandbox作成・実行
    # 4. SSEストリーム返却
```

**SSEイベント形式**:
```
event: status
data: {"message": "Starting generation..."}

event: stream
data: {"content": "生成されたコード..."}

event: done
data: {"success": true}

event: error
data: {"error": "エラーメッセージ"}
```

### 6.2 Express側（JavaScript）

**ファイル**: `/Users/admin/DreamCore-V2/server/modalClient.js`（新規作成）

```javascript
// SSEストリームを受信してイベントを返すジェネレーター
async function* streamFromModal(params) {
  const response = await fetch(MODAL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Modal-Secret': process.env.MODAL_SECRET,
    },
    body: JSON.stringify(params),
  });

  // SSEパース → yield イベント
}

// SSE→WS変換
function convertSseToWsEvent(sseEvent) {
  const mapping = {
    'status': 'progress',
    'stream': 'stream',
    'done': 'completed',
    'error': 'failed'
  };
  return {
    type: mapping[sseEvent.event] || sseEvent.event,
    ...sseEvent.data
  };
}
```

**ファイル**: `/Users/admin/DreamCore-V2/server/claudeRunner.js`（修正）

```javascript
const USE_MODAL = process.env.USE_MODAL === 'true';

async function runClaude(jobId, userId, projectId, message, options) {
  if (USE_MODAL) {
    return runClaudeOnModal(jobId, userId, projectId, message, options);
  } else {
    return runClaudeLocal(jobId, userId, projectId, message, options);
  }
}

async function runClaudeOnModal(jobId, userId, projectId, message, options) {
  const stream = modalClient.streamFromModal({
    user_id: userId,
    project_id: projectId,
    message,
    skills: options.skills,
  });

  for await (const event of stream) {
    const wsEvent = convertSseToWsEvent(event);
    switch (wsEvent.type) {
      case 'stream':
        jobManager.notifySubscribers(jobId, { type: 'stream', content: wsEvent.content });
        break;
      case 'completed':
        jobManager.completeJob(jobId, wsEvent.result);
        break;
      case 'failed':
        jobManager.failJob(jobId, wsEvent.error);
        break;
    }
  }
}
```

---

## 7. セキュリティ要件（4層防御）

| 層 | 実装箇所 | 検証内容 |
|----|----------|----------|
| 1. Express認証 | `authMiddleware.js` | JWT検証、Supabase Auth |
| 2. Modal内部認証 | `X-Modal-Secret` | 共有シークレット検証 |
| 3. パス検証 | Modal sandbox | UUID形式、パストラバーサル防止 |
| 4. gVisor隔離 | Modal Sandbox | VM レベル隔離 |

### UUID検証（全箇所で統一）

```javascript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

---

## 8. 環境変数

### Express側（追加）

```bash
# Modal統合
USE_MODAL=true                    # Modal使用フラグ（false=ローカル実行）
MODAL_ENDPOINT=https://xxx.modal.run/generate
MODAL_SECRET=your-shared-secret   # X-Modal-Secretヘッダー用
```

### Modal側

```bash
# Modal Secrets として設定
# ※ Supabase認証情報は含めない（DB操作はExpress側で行う）
modal secret create dreamcore-secrets \
  ANTHROPIC_API_KEY=sk-ant-xxx \
  MODAL_SECRET=your-shared-secret
```

**重要**: `SUPABASE_URL` や `SUPABASE_SERVICE_ROLE_KEY` は Modal に渡さない。DB操作は Express 側に集約する。

---

## 9. Modal Volume 設定

```bash
# ボリューム作成
modal volume create dreamcore-data
modal volume create dreamcore-global

# マウント構成
dreamcore-data    → /data        # ユーザーデータ（読み書き）
dreamcore-global  → /skills      # 共有スキル（読み取り専用）
```

### パス構造

```
/data/
└── users/
    └── {user_id}/
        └── projects/
            └── {project_id}/
                ├── index.html
                ├── game.js
                └── assets/

/skills/
└── (共有スキルファイル)
```

---

## 10. テスト計画

### Phase 1: Modal単体テスト

```bash
# Modal CLIでローカルテスト（有効なUUID形式を使用）
modal run modal_app/sandbox.py::generate --input '{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "project_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "message": "hello"
}'
```

### Phase 2: 統合テスト

1. `USE_MODAL=true` で Express起動
2. WebSocket経由でゲーム生成リクエスト
3. ストリーミング応答の確認
4. 生成ファイルの永続化確認

### Phase 3: 負荷テスト

- 同時接続数: 10, 50, 100
- Modal cold start の影響測定
- SSE→WS変換のレイテンシ測定

---

## 11. ロールバック計画

```javascript
// config.js
const USE_MODAL = process.env.USE_MODAL === 'true';

// 問題発生時: USE_MODAL=false で即座にローカル実行に戻る
```

**ロールバック手順**:
1. `USE_MODAL=false` に変更
2. Express再起動
3. ローカルClaude CLI実行に自動フォールバック

---

## 12. 実装優先順位

| 優先度 | タスク | 状態 | 担当 |
|--------|--------|------|------|
| 1 | Modal sandbox.py 基本実装 | ✅ 動作確認済み | Modal側 |
| 2 | modalClient.js 実装 | 未着手 | Express側 |
| 3 | claudeRunner.js 統合 | 未着手 | Express側 |
| 4 | SSE→WS変換テスト | 未着手 | 統合 |
| 5 | Volume永続化テスト | 未着手 | Modal側 |
| 6 | アセット管理復活 | 未着手 | Express側 |
| 7 | 本番デプロイ・監視設定 | 未着手 | 両方 |

---

## 13. 質問・連絡先

不明点があれば以下を参照:
- 移行計画の詳細: `/Users/admin/DreamCore-V2-sandbox/docs/MODAL-MIGRATION-PLAN.md`
- 技術設計の詳細: `/Users/admin/DreamCore-V2-sandbox/docs/MODAL-DESIGN.md`
- Modal固有の知識: `/Users/admin/DreamCore-V2-sandbox/docs/modal-architecture/`

---

## 重要ポイント（まとめ）

1. **フロントエンドは一切変更しない** - WebSocket通信はそのまま維持
2. **ExpressはUX/API契約の本体** - 中継だけでなくDB・認証・アセット管理を担当
3. **Modalは実行専用** - Claude CLI / Python / Git / ファイルI/O のみ
4. **DB操作はExpress集約** - ModalにSupabase認証情報を渡さない
5. **SSE→WS変換は固定マッピング** - status→progress, stream→stream, done→completed, error→failed
