# DreamCore-V2 → Modal 移行計画（Express + WebSocket維持）

作成日: 2026-01-27
更新日: 2026-01-27
ベース: DreamCore-V2（Supabase Auth + RLS 移行済み）

---

## 目的

- **UXは完全維持**: 画面・フロー・WebSocket通信をDreamCore-V2と同一に保つ
- **裏側のみModal化**: 生成処理・ファイルI/OをModal Sandbox (gVisor)へ移行
- **セキュリティ強化**: VM級隔離 + 4層防御アーキテクチャ

---

## 方針

```
┌──────────────────┬─────────────────────────────────────┐
│       項目       │                内容                 │
├──────────────────┼─────────────────────────────────────┤
│ UX               │ 完全維持（WebSocket そのまま）      │
├──────────────────┼─────────────────────────────────────┤
│ サンドボックス   │ Modal gVisor で実現                 │
├──────────────────┼─────────────────────────────────────┤
│ スケール         │ Modal 側が自動対応                  │
├──────────────────┼─────────────────────────────────────┤
│ Express サーバー │ 中継のみ（100人余裕）               │
├──────────────────┼─────────────────────────────────────┤
│ コスト           │ サーバー $5〜20/月 + Modal 従量課金 │
└──────────────────┴─────────────────────────────────────┘
```

---

## 現状 vs 移行後

| 項目 | 現状 (V2) | 移行後 (Modal) |
|------|-----------|----------------|
| **フロントエンド** | Express静的配信 | Express静的配信（変更なし） |
| **リアルタイム通信** | WebSocket | WebSocket（変更なし） |
| **認証** | Supabase Auth | Supabase Auth（変更なし） |
| **DB** | Supabase PostgreSQL | Supabase PostgreSQL（変更なし） |
| **アセット管理** | Supabase + /api/assets | Supabase + /api/assets（変更なし） |
| **ゲーム生成** | ローカル Claude CLI | Modal Sandbox (gVisor) |
| **画像生成** | ローカル Gemini API | Modal Function |
| **ファイル保存** | ローカル `/data/` | Modal Volume |
| **Expressの役割** | 全処理 | 中継・オーケストレーション |

---

## アーキテクチャ（移行後）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User's Browser                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DreamCore-V2 フロントエンド（変更なし）                             │   │
│  │  - Chat Interface                                                    │   │
│  │  - Game Preview (iframe)                                            │   │
│  │  - Project Management                                                │   │
│  │  - WebSocket for streaming                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ WebSocket + JWT
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Express Server（中継・オーケストレーション）              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  server/index.js                                                     │   │
│  │  - WebSocket Handler（変更なし）                                     │   │
│  │  - REST API（変更なし）                                              │   │
│  │  - authMiddleware.js（変更なし）                                     │   │
│  │  - database-supabase.js（変更なし）                                  │   │
│  │  - modalClient.js [NEW] ← Modal API呼び出し                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTP + X-Modal-Secret
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Modal Cloud                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Web Endpoints (FastAPI)                                              │ │
│  │  - generate_game     : Claude CLI でゲーム生成（SSE）                 │ │
│  │  - generate_gemini   : Gemini API で高速生成（SSE）                  │ │
│  │  - get_file          : プロジェクトファイル取得                      │ │
│  │  - detect_intent     : ユーザー意図検出（Haiku）                     │ │
│  │  - detect_skills     : 必要スキル検出（Haiku）                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Modal Sandbox (gVisor VM-level Isolation)                            │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Per-Request Isolated Container                                  │ │ │
│  │  │  - User: claude (non-root, UID 1000)                            │ │ │
│  │  │  - Memory: 2GB limit                                             │ │ │
│  │  │  - Timeout: 10 minutes                                           │ │ │
│  │  │  - Claude Code CLI installed                                     │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Modal Volumes (Persistent Storage)                                   │ │
│  │  - dreamcore-data   : /data/users/{userId}/projects/{projectId}/    │ │
│  │  - dreamcore-global : /.claude/skills/, /scripts/                   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Supabase（変更なし）                                  │
│  - Auth (Google OAuth)                                                       │
│  - PostgreSQL (projects, assets, chat_history, jobs)                        │
│  - RLS policies                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4層防御アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: UUID Validation                                                    │
│  ├── user_id, project_id は UUID 形式のみ許可                               │
│  ├── 正規表現: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i │
│  └── パストラバーサル攻撃を完全ブロック                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 2: Path-Based Isolation                                               │
│  ├── パス構築: /data/users/{UUID}/projects/{UUID}/                          │
│  └── 別ユーザーのディレクトリへのアクセスは物理的に不可能                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 3: gVisor Sandbox                                                     │
│  ├── 各リクエストは独立したコンテナで実行                                   │
│  ├── gVisor による VM 級隔離                                                │
│  └── Claude Code Web と同等のセキュリティレベル                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 4: File Path Validation                                               │
│  ├── ファイルパスに ".." が含まれていたら拒否                               │
│  ├── 絶対パス（"/"で開始）は拒否                                            │
│  └── システムパス（/etc, /proc, /dev）へのアクセスをブロック                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 変更するもの / しないもの

### 変更しないもの（UX完全維持）

| カテゴリ | 内容 |
|---------|------|
| **フロントエンド** | public/*.html, public/*.js - 一切変更なし |
| **WebSocket通信** | メッセージ形式・イベント - 一切変更なし |
| **REST API** | エンドポイント・レスポンス形式 - 一切変更なし |
| **認証** | Supabase Auth, JWT検証 - 一切変更なし |
| **DB** | テーブル構造, RLS - 一切変更なし |
| **アセット管理** | /api/assets/:id, assetsテーブル, replaceAssetReferences() |

### 変更するもの（裏側のみ）

| カテゴリ | Before | After |
|---------|--------|-------|
| **claudeRunner.js** | ローカルClaude CLI実行 | Modal API呼び出し |
| **geminiClient.js** | ローカルGemini API | Modal API呼び出し |
| **userManager.js** | ローカルファイルI/O | Modal Volume経由 |
| **新規追加** | - | modalClient.js（Modal API クライアント） |

---

## 移行フェーズ

### Phase 0: 準備（1週間）

- [ ] Modalアカウント作成・設定
- [ ] Modal Secrets設定
  - [ ] `anthropic-api-key`
  - [ ] `modal-internal-secret`
  - [ ] `gemini-api-key`
- [ ] Modal Volumes作成
  - [ ] `dreamcore-data`
  - [ ] `dreamcore-global`
- [ ] スキルアップロードスクリプト作成・実行

### Phase 1: Modal Backend構築（2週間）

- [ ] Modal app.py 実装
  - [ ] generate_game（Claude CLI + SSE）
  - [ ] generate_gemini（Gemini高速パス）
  - [ ] get_file / list_files / apply_files
  - [ ] detect_intent / detect_skills
- [ ] gVisor Sandbox設定
- [ ] X-Modal-Secret認証実装
- [ ] SSEストリーミング実装
- [ ] 単体テスト

### Phase 2: Express連携（1週間）

- [ ] modalClient.js 実装（Modal API クライアント）
- [ ] claudeRunner.js 改修
  - [ ] ローカル実行 → Modal呼び出しに変更
  - [ ] SSE → WebSocketブリッジ実装
- [ ] userManager.js 改修
  - [ ] ローカルI/O → Modal Volume経由に変更
- [ ] geminiClient.js 改修
  - [ ] Modal経由に変更

### Phase 3: アセット管理移行（1週間）

- [ ] /api/assets/:id をModal Volume対応
- [ ] replaceAssetReferences() の維持確認
- [ ] アセットアップロード → Modal Volume保存
- [ ] アセットメタデータ → Supabase維持

### Phase 4: Git・バージョン管理（1週間）

- [ ] Modal Volume上でのGit操作実装
- [ ] getVersions() のModal対応
- [ ] restoreVersion() のModal対応
- [ ] createVersionSnapshot() のModal対応

### Phase 5: 統合テスト（1週間）

- [ ] E2Eテスト
  - [ ] ゲーム生成フロー
  - [ ] アセットアップロード・参照
  - [ ] バージョン履歴・リストア
  - [ ] Publish/Remix/autoFix
- [ ] パフォーマンステスト
- [ ] セキュリティテスト

### Phase 6: 本番切り替え（1週間）

- [ ] ステージング環境検証
- [ ] 本番デプロイ
- [ ] モニタリング設定
- [ ] ロールバック手順確認
- [ ] ドキュメント更新

---

## Expressサーバーの役割変更

### Before（現状）

```javascript
// claudeRunner.js - 重い処理をローカルで実行
const child = spawn('claude', [...], { cwd: projectDir });
```

### After（Modal化後）

```javascript
// claudeRunner.js - Modal APIを呼び出すだけ
const modalClient = require('./modalClient');

async function runClaudeAsJob(userId, projectId, message, options) {
  const job = await jobManager.createJob(userId, projectId);

  // Modal API呼び出し（SSEストリーム）
  const stream = await modalClient.generateGame({
    user_id: userId,
    project_id: projectId,
    message,
    skills: options.skills,
  });

  // SSE → WebSocketブリッジ
  for await (const event of stream) {
    if (event.type === 'stream') {
      jobManager.emit(job.id, 'stream', { content: event.content });
    } else if (event.type === 'done') {
      jobManager.completeJob(job.id, event.result);
    }
  }
}
```

---

## Volume構造

```
dreamcore-data/                      ← ユーザーデータ（読み書き可能）
└── users/
    └── {userId}/                    ← UUID形式のみ許可
        ├── projects/
        │   └── {projectId}/
        │       ├── index.html
        │       ├── spec.md
        │       ├── STYLE.md
        │       ├── assets/
        │       └── .git/
        └── assets/                  ← ユーザーアセット

dreamcore-global/                    ← グローバルリソース（読み取り専用）
├── .claude/
│   └── skills/                      ← 共有スキル
│       ├── p5js-setup/
│       ├── threejs-setup/
│       ├── kawaii-colors/
│       └── ...
└── scripts/
    └── generate_image.py
```

---

## アセット管理（必須維持）

### 維持するもの

| 項目 | 説明 |
|------|------|
| `assets`テーブル | Supabase PostgreSQL（メタデータ管理） |
| `/api/assets/:id` | アセット取得エンドポイント |
| `/api/assets/upload` | アセットアップロード |
| `replaceAssetReferences()` | コード内のアセット参照置換 |

### 変更点

| 項目 | Before | After |
|------|--------|-------|
| ファイル保存先 | `/data/users/{userId}/assets/` | Modal Volume `dreamcore-data` |
| メタデータ | Supabase | Supabase（変更なし） |

---

## 環境変数

### Express Server

```env
# 既存（変更なし）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 新規追加
MODAL_ENDPOINT=https://xxx--dreamcore-generate-game.modal.run
MODAL_GET_FILE_ENDPOINT=https://xxx--dreamcore-get-file.modal.run
MODAL_INTERNAL_SECRET=<random-hex-64>
USE_MODAL=true  # false でローカルフォールバック
```

### Modal Secrets

```bash
modal secret create anthropic-api-key ANTHROPIC_API_KEY=sk-ant-...
modal secret create modal-internal-secret MODAL_INTERNAL_SECRET=...
modal secret create gemini-api-key GEMINI_API_KEY=...
```

---

## ロールバック計画

### トリガー条件
- Modal障害
- 重大なバグ発見
- パフォーマンス著しく低下

### 手順
1. 環境変数 `USE_MODAL=false` に変更
2. Expressサーバー再起動
3. ローカル実行にフォールバック

### 事前準備
- ローカル実行コードは削除せず、条件分岐で保持
- `/data/` ディレクトリは定期的にModal Volumeと同期

---

## 成功基準

| 項目 | 基準 |
|------|------|
| **UXパリティ** | 画面・操作がV2と完全に同一 |
| **API互換性** | リクエスト/レスポンス形式が100%一致 |
| **WebSocket互換性** | メッセージ形式が100%一致 |
| **レイテンシ** | ゲーム生成時間がV2比+30%以内 |
| **可用性** | 99.5%以上 |
| **隔離性** | ユーザー間でファイルアクセス不可 |

---

## 参考ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| `/Users/admin/DreamCore-V2-sandbox/docs/ARCHITECTURE-V2.md` | DreamCore-V2現状アーキテクチャ |
| `/Users/admin/DreamCore-V2-sandbox/docs/MODAL-DESIGN.md` | Modal技術設計 |
| `/Users/admin/DreamCore-V2-sandbox/docs/modal-architecture/MODAL-SANDBOX-ARCHITECTURE.md` | Modal汎用アーキテクチャパターン |
| `/Users/admin/DreamCore-V2-sandbox/docs/modal-architecture/QUICK-REFERENCE.md` | Modalコマンド・運用チェック |
