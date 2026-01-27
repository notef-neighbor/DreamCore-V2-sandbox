# Modal Sandbox 実装 - エンジニア引き継ぎ文書

**作成日**: 2026-01-27
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
│         (認証・WS管理・SSE→WS変換・中継のみ)                      │
│                   $5-20/月で100ユーザー対応可能                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP + SSE
                      │ X-Modal-Secret ヘッダー
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Modal Sandbox                                 │
│              (gVisor隔離・Claude CLI実行)                         │
│                    従量課金・自動スケール                          │
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
| サンドボックス | Modal gVisor で実現 |
| スケール | Modal側が自動対応 |
| Expressサーバー | 中継のみ（重い処理はModal） |
| コスト | サーバー $5-20/月 + Modal従量課金 |
| 将来計画 | Next.js移行はPhase 2として保留 |

---

## 2. 参照ドキュメント

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
| WebSocket | `/Users/admin/DreamCore-V2/server/websocket.js` | WS→SSE変換の統合先 |
| 認証 | `/Users/admin/DreamCore-V2/server/authMiddleware.js` | JWT検証ロジック |
| 設定 | `/Users/admin/DreamCore-V2/server/config.js` | 環境変数・レート制限 |

---

## 3. 実装すべきコンポーネント

### 3.1 Modal側（Python）

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

### 3.2 Express側（JavaScript）

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
    // SSEイベント → WebSocketメッセージに変換
    switch (event.type) {
      case 'stream':
        jobManager.sendProgress(jobId, event.data.content);
        break;
      case 'done':
        jobManager.completeJob(jobId, event.data);
        break;
      case 'error':
        jobManager.failJob(jobId, event.data.error);
        break;
    }
  }
}
```

---

## 4. セキュリティ要件（4層防御）

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

## 5. 環境変数

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
modal secret create dreamcore-secrets \
  ANTHROPIC_API_KEY=sk-ant-xxx \
  MODAL_SECRET=your-shared-secret \
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

## 6. Modal Volume 設定

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

## 7. テスト計画

### Phase 1: Modal単体テスト

```bash
# Modal CLIでローカルテスト
modal run modal_app/sandbox.py::generate --input '{"user_id":"test","project_id":"test","message":"hello"}'
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

## 8. ロールバック計画

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

## 9. 実装優先順位

| 優先度 | タスク | 担当 |
|--------|--------|------|
| 1 | Modal sandbox.py 基本実装 | Modal側 |
| 2 | modalClient.js 実装 | Express側 |
| 3 | claudeRunner.js 統合 | Express側 |
| 4 | SSE→WS変換テスト | 統合 |
| 5 | Volume永続化テスト | Modal側 |
| 6 | 本番デプロイ・監視設定 | 両方 |

---

## 10. 質問・連絡先

不明点があれば以下を参照:
- 移行計画の詳細: `/Users/admin/DreamCore-V2-sandbox/docs/MODAL-MIGRATION-PLAN.md`
- 技術設計の詳細: `/Users/admin/DreamCore-V2-sandbox/docs/MODAL-DESIGN.md`
- Modal固有の知識: `/Users/admin/DreamCore-V2-sandbox/docs/modal-architecture/`

---

**重要**: フロントエンドは一切変更しません。WebSocket通信はそのまま維持し、Express側でSSE→WebSocket変換を行います。
