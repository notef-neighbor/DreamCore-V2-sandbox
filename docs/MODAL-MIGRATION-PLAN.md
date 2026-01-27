# DreamCore-V2 → Modal 移行計画

作成日: 2026-01-27
ベース: DreamCore-V2（Supabase Auth + RLS 移行済み）

---

## 目的

- **UXは完全維持**: 画面・フロー・API契約をDreamCore-V2と同一に保つ
- **バックエンドのみModal化**: 生成処理・ファイルI/OをModalサンドボックスへ移行
- **セキュリティ強化**: ユーザーごとに隔離された実行環境を提供

---

## 現状 vs 移行後

| 項目 | 現状 (V2) | 移行後 (Modal) |
|------|-----------|----------------|
| **認証** | Supabase Auth | Supabase Auth（変更なし） |
| **DB** | Supabase PostgreSQL | Supabase PostgreSQL（変更なし） |
| **ゲーム生成** | ローカル Claude CLI | Modal Function内 Claude CLI |
| **画像生成** | ローカル Gemini API | Modal Function内 Gemini API |
| **ファイル保存** | ローカル `/data/` | Modal Volume |
| **Git操作** | ローカル `execFileSync` | Modal Volume内 Git |
| **Remotion** | ローカル Node.js | Modal Function内 Remotion |

---

## 変更しないもの（維持）

### フロントエンド
- `public/*.html` - 全画面
- `public/*.js` - 全スクリプト
- WebSocket通信プロトコル
- API契約（リクエスト/レスポンス形式）

### バックエンド（Node.jsサーバー）
- `authMiddleware.js` - JWT検証
- `database-supabase.js` - DB操作
- `jobManager.js` - ジョブ管理（一部変更）
- REST APIエンドポイント定義
- WebSocketハンドラー定義

### インフラ
- Supabase Auth / PostgreSQL / RLS
- Google OAuth設定

---

## 変更するもの（Modal化）

### 1. ゲーム生成 (claudeRunner.js)

**現状:**
```javascript
// ローカルでClaude CLI実行
const child = spawn('claude', [...], { cwd: projectDir });
```

**移行後:**
```javascript
// Modal Functionを呼び出し
const result = await modalClient.functions.call('generate-game', {
  userId,
  projectId,
  message,
  skills,
});
```

### 2. ファイルI/O (userManager.js)

**現状:**
```javascript
// ローカルファイルシステム
const projectDir = `/data/users/${userId}/projects/${projectId}`;
fs.writeFileSync(path.join(projectDir, 'index.html'), content);
```

**移行後:**
```javascript
// Modal Volume経由
await modalClient.volumes.write(volumeId, filePath, content);
const content = await modalClient.volumes.read(volumeId, filePath);
```

### 3. Git操作

**現状:**
```javascript
execFileSync('git', ['commit', '-m', message], { cwd: projectDir });
```

**移行後:**
```javascript
// Modal Function内でGit操作
await modalClient.functions.call('git-operation', {
  volumeId,
  projectPath,
  operation: 'commit',
  message,
});
```

### 4. 画像生成 (geminiClient.js)

**現状:**
```javascript
// ローカルでAPI呼び出し
const result = await gemini.generateImage(prompt);
fs.writeFileSync(assetPath, buffer);
```

**移行後:**
```javascript
// Modal Function内で生成・保存
await modalClient.functions.call('generate-image', {
  volumeId,
  prompt,
  outputPath,
});
```

### 5. Remotion動画生成

**現状:**
```javascript
// ローカルでRemotionレンダリング
execSync('npx remotion render ...', { cwd: 'game-video' });
```

**移行後:**
```javascript
// Modal Function（GPU付き）でレンダリング
await modalClient.functions.call('render-video', {
  volumeId,
  projectId,
  outputPath,
});
```

---

## アーキテクチャ（移行後）

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT (Browser SPA) - 変更なし                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ NODE.JS SERVER (Express + WebSocket) - オーケストレーター       │
│  ├─ authMiddleware.js     ← JWT検証（変更なし）                 │
│  ├─ database-supabase.js  ← DB操作（変更なし）                  │
│  ├─ jobManager.js         ← ジョブ管理（Modal連携追加）         │
│  ├─ modalClient.js        ← Modal API クライアント [NEW]        │
│  └─ streamBridge.js       ← Modal→WebSocketブリッジ [NEW]       │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Modal API
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ MODAL PLATFORM                                                  │
│  ├─ Volume: user-{userId}   ← ユーザーごとの隔離ストレージ      │
│  │   ├─ projects/{projectId}/                                   │
│  │   └─ assets/                                                 │
│  │                                                              │
│  ├─ Function: generate-game  ← Claude CLI実行                   │
│  ├─ Function: generate-image ← Gemini画像生成                   │
│  ├─ Function: git-operation  ← Git操作                          │
│  ├─ Function: render-video   ← Remotionレンダリング (GPU)       │
│  └─ Function: file-operation ← ファイル読み書き                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUPABASE - 変更なし                                             │
│  ├─ Auth (Google OAuth)                                         │
│  ├─ PostgreSQL (メタデータ)                                     │
│  └─ RLS (アクセス制御)                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 移行フェーズ

### Phase 0: 準備（1週間）

- [ ] Modalアカウント作成・設定
- [ ] Modal Volume設計
- [ ] Modal Secrets設定（API keys）
- [ ] ローカル開発環境構築
- [ ] 技術検証（PoC）

### Phase 1: ファイルI/O移行（1週間）

- [ ] `modalClient.js` 実装
- [ ] Modal Volume作成・マウント
- [ ] `file-operation` Function実装
- [ ] `userManager.js` をModal Volume対応に変更
- [ ] ファイル読み書きテスト

### Phase 2: ゲーム生成移行（2週間）

- [ ] `generate-game` Function実装（Claude CLI）
- [ ] ストリーミングブリッジ実装（Modal→WebSocket）
- [ ] `claudeRunner.js` をModal呼び出しに変更
- [ ] スキル読み込みのModal対応
- [ ] E2Eテスト

### Phase 3: Git移行（1週間）

- [ ] `git-operation` Function実装
- [ ] バージョン履歴取得のModal対応
- [ ] リストア機能のModal対応
- [ ] Git操作テスト

### Phase 4: 画像生成移行（1週間）

- [ ] `generate-image` Function実装
- [ ] 背景削除のModal対応
- [ ] `geminiClient.js` をModal呼び出しに変更
- [ ] 画像生成テスト

### Phase 5: Remotion移行（1週間）

- [ ] `render-video` Function実装（GPU）
- [ ] Remotionプロジェクトのコンテナ化
- [ ] 動画生成テスト

### Phase 6: E2E検証・切り替え（1週間）

- [ ] 全機能E2Eテスト
- [ ] パフォーマンス測定
- [ ] ステージング環境テスト
- [ ] 本番切り替え
- [ ] ロールバック手順確認

---

## ストリーミング設計

### 課題
Modal Functionは非同期実行のため、Claude CLIのリアルタイムストリームをどうWebSocketに伝えるか。

### 解決策: Webhookコールバック

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│ Modal Func │────▶│ Node.js    │────▶│ WebSocket  │
│ (Claude)   │     │ /callback  │     │ Client     │
└────────────┘     └────────────┘     └────────────┘
     │                   ▲
     └─── HTTP POST ─────┘
          (stream chunk)
```

1. Modal Function開始時にcallback URLを渡す
2. Claude CLI出力をチャンクごとにPOST
3. Node.jsがWebSocketで転送

### 代替案: Modal Streams（将来）
Modal Streamsが正式リリースされたら移行検討。

---

## ロールバック計画

### トリガー条件
- 本番切り替え後に重大なエラーが発生
- パフォーマンスが著しく低下
- Modal障害

### 手順
1. 環境変数 `USE_MODAL=false` に変更
2. Node.jsサーバー再起動
3. ローカル実行にフォールバック
4. `/data/` ディレクトリの同期確認

### 事前準備
- ローカル実行コードは削除せず、条件分岐で保持
- `/data/` ディレクトリは定期的にModal Volumeと同期

---

## 成功基準

| 項目 | 基準 |
|------|------|
| **UXパリティ** | 画面・操作がV2と同一 |
| **API互換性** | リクエスト/レスポンス形式がV2と一致 |
| **レイテンシ** | ゲーム生成時間がV2比+20%以内 |
| **可用性** | 99.5%以上 |
| **隔離性** | ユーザー間でファイルアクセス不可 |

---

## リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Modalダウンタイム | サービス停止 | ローカルフォールバック |
| ストリーミング遅延 | UX低下 | バッファリング最適化 |
| Volume容量超過 | 保存失敗 | 監視・アラート・自動拡張 |
| コスト超過 | 予算オーバー | 使用量監視・制限 |
| Claude CLI互換性 | 生成失敗 | バージョン固定・テスト |

---

## 次のアクション

1. **技術設計書作成** → `MODAL-DESIGN.md`
2. **Modalアカウント準備**
3. **Phase 0 PoC実施**
