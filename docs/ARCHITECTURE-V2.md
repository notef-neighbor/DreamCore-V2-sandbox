# DreamCore-V2 アーキテクチャ

作成日: 2026-01-27
ベース: DreamCore-V2（Supabase Auth + RLS 移行済み）

---

## システム概要

チャットベースでブラウザゲームを生成するAIプラットフォーム。

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT (Browser SPA)                                            │
│  ├─ public/*.html / public/*.js                                │
│  ├─ WebSocket接続 (リアルタイム通信)                            │
│  ├─ Supabase Auth SDK (Google OAuth)                           │
│  └─ Game iframe (生成されたゲームのプレビュー)                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ JSON messages + JWT (Authorization Bearer)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ SERVER (Node.js + Express)                                      │
│  ├─ WebSocket Handler    ← チャット、ジョブ更新                 │
│  ├─ REST API             ← 画像生成、アセット管理               │
│  ├─ Game File Serving    ← /game/:userId/:projectId/           │
│  │                                                              │
│  ├─ authMiddleware.js    ← JWT検証 (jose + JWKS)               │
│  ├─ claudeRunner.js      ← Claude CLI + Gemini実行             │
│  ├─ jobManager.js        ← 非同期ジョブキュー                   │
│  └─ database-supabase.js ← Supabase RLS対応DB操作              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ File System  │ │ Supabase     │ │ External API │
│  /data/      │ │  Auth        │ │  Anthropic   │
│  users/      │ │  PostgreSQL  │ │  Gemini      │
│  assets/     │ │  RLS         │ │  Replicate   │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## ディレクトリ構成

```
DreamCore-V2/
├── public/                      # フロントエンド
│   ├── index.html               # ログインページ
│   ├── create.html              # プロジェクト一覧
│   ├── project.html             # エディタ
│   ├── publish.html             # 公開設定
│   ├── play.html                # プレイ画面
│   ├── app.js                   # エディタ (GameCreatorApp)
│   ├── auth.js                  # Supabase Auth ユーティリティ
│   └── style.css                # グローバルスタイル
│
├── server/                      # バックエンド
│   ├── index.js                 # Express + WebSocket サーバー
│   ├── config.js                # 設定・起動チェック・パスヘルパー
│   ├── authMiddleware.js        # JWT認証 (jose + JWKS)
│   ├── supabaseClient.js        # Supabase クライアント初期化
│   ├── database-supabase.js     # Supabase RLS対応DB操作
│   ├── claudeRunner.js          # Claude CLI 実行エンジン
│   ├── jobManager.js            # ジョブキュー・スロット管理
│   ├── userManager.js           # ファイルI/O・Git操作
│   ├── geminiClient.js          # Gemini API (画像生成)
│   ├── errorResponse.js         # エラーレスポンス標準化
│   │
│   ├── prompts/                 # プロンプトテンプレート
│   │   ├── baseRules.js         # KAWAIIデザイン・コーディング規約
│   │   ├── createPrompt.js      # 新規ゲーム作成用
│   │   └── updatePrompt.js      # ゲーム更新用
│   │
│   └── analyzer/                # ゲーム解析モジュール
│       ├── gameTypeAnalyzer.js  # 2D/3D 自動検出
│       └── skillSelector.js     # スキル自動選択
│
├── .claude/                     # Claude Code CLI 設定
│   ├── SYSTEM_PROMPT.md         # マスターシステムプロンプト
│   └── skills/                  # 30+ 再利用可能スキル
│
├── /data/                       # ランタイムデータ (外部マウント)
│   ├── users/{userId}/
│   │   ├── projects/{projectId}/
│   │   │   ├── index.html       # ゲームコード
│   │   │   ├── spec.md          # 仕様書
│   │   │   ├── STYLE.md         # スタイル設定
│   │   │   ├── PUBLISH.json     # 公開情報
│   │   │   ├── thumbnail.webp   # サムネイル
│   │   │   ├── movie.mp4        # デモ動画
│   │   │   └── .git/            # バージョン管理
│   │   └── assets/              # ユーザーアセット
│   └── assets/global/           # グローバルアセット
│
└── game-video/                  # Remotion プロジェクト
```

---

## 認証方式

### Supabase Auth + Google OAuth

```
┌─────────────────────────────────────────────────────────────────┐
│ フロントエンド (public/auth.js)                                  │
│  └─ Supabase SDK → Google OAuth → access_token (JWT)            │
│     └─ localStorage に保存 (5分キャッシュ)                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Authorization: Bearer {access_token}
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ バックエンド (authMiddleware.js)                                 │
│  └─ JWT検証 (jose + JWKS)                                       │
│     ├─ JWKS: Supabaseの公開鍵セット (キャッシュ)                │
│     ├─ ローカル検証 → API呼び出しゼロ                           │
│     └─ Fallback: JWKS失敗時のみ Supabase API                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ req.user = { id, email }
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ RLS対応クライアント作成                                          │
│  └─ req.supabase = createUserSupabaseClient(access_token)       │
│     └─ ユーザーは自分のデータのみアクセス可能                    │
└─────────────────────────────────────────────────────────────────┘
```

### 認証ミドルウェア

| メソッド | 用途 |
|---------|------|
| `authenticate` | 必須認証（401エラー） |
| `optionalAuth` | 任意認証（req.userがnullでも続行） |
| `verifyWebSocketAuth` | WebSocket用（initメッセージのaccess_token） |

---

## ファイルストレージ

### 統一パス構造

```
/data/
├── users/{userId}/
│   ├── projects/{projectId}/     # プロジェクトファイル
│   │   ├── index.html            # ゲームコード
│   │   ├── spec.md               # 仕様書
│   │   ├── STYLE.md              # スタイル設定
│   │   ├── PUBLISH.json          # 公開メタデータ
│   │   ├── thumbnail.webp        # サムネイル
│   │   ├── movie.mp4             # デモ動画
│   │   └── .git/                 # バージョン管理
│   └── assets/                   # ユーザーアセット
│       ├── {alias}_{hash}.png    # 例: player_abc123.png
│       └── ...
└── assets/global/{category}/     # グローバルアセット
    └── {alias}_{hash}.png
```

### パスヘルパー (config.js)

```javascript
getProjectPath(userId, projectId)  // → /data/users/{userId}/projects/{projectId}
getUserAssetsPath(userId)          // → /data/users/{userId}/assets
getGlobalAssetsPath(category)      // → /data/assets/global/{category}
```

---

## データベース (Supabase PostgreSQL)

### 主要テーブル

| テーブル | 用途 |
|---------|------|
| `users` | ユーザー情報（Supabase Auth連携） |
| `projects` | ゲームプロジェクト |
| `assets` | アセットメタデータ |
| `project_assets` | プロジェクト-アセット関連 |
| `jobs` | 非同期ジョブ |
| `chat_history` | 会話ログ |

### RLS (Row Level Security)

```sql
-- projects: オーナーのみアクセス
CREATE POLICY "owner_only" ON projects
  USING (user_id = auth.uid());

-- assets: オーナーかつ未削除
CREATE POLICY "owner_active" ON assets
  USING (owner_id = auth.uid() AND is_deleted = FALSE);
```

### クライアント分離

| クライアント | 用途 | RLS |
|-------------|------|-----|
| `req.supabase` | ユーザー操作 | 適用 |
| `supabaseAdmin` | 管理操作（ジョブ、削除） | バイパス |

---

## ジョブ管理

### スロット制限 (config.js)

| 設定 | 値 | 説明 |
|------|-----|------|
| `maxConcurrentPerUser` | 1 | ユーザーあたり同時実行数 |
| `maxConcurrentTotal` | 50 | システム全体の同時実行数 |
| `timeout` | 10分 | 1ジョブの最大実行時間 |

### ジョブ状態

```
pending → processing → completed
                    ↘ failed
```

### JobManager API

```javascript
acquireSlot(userId)      // スロット確保（超過時エラー）
releaseSlot(jobId)       // 解放（idempotent）
subscribe(jobId, cb)     // リアルタイム更新購読
getJob(jobId)            // 状態取得
getActiveJob(projectId)  // アクティブジョブ取得
```

---

## ゲーム生成フロー

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ユーザーメッセージ受信 (WebSocket: message)                   │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ジョブ作成・スロット確保 (jobManager)                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. インテント判定 (Claude Haiku)                                 │
│    → chat / edit / restore                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. スキル選択 (detectSkillsWithAI)                               │
│    → ["p5js-setup", "kawaii-colors", ...]                       │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Gemini API 呼び出し (主) / Claude CLI (フォールバック)        │
│    ├─ System: baseRules + 出力形式                              │
│    └─ User: メッセージ + スキル内容 + 既存コード(update時)       │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. レスポンス処理                                                │
│    ├─ create: ファイル書き込み + 画像生成                       │
│    ├─ edit: 差分適用                                            │
│    └─ chat: 会話応答                                            │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Git コミット + 仕様書更新                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. 完了通知 (WebSocket: gameUpdated)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## WebSocket通信

### メッセージタイプ

| タイプ | 方向 | 説明 |
|--------|------|------|
| `init` | C→S | 認証初期化（access_token送信） |
| `ping/pong` | 双方向 | ハートビート |
| `selectProject` | C→S | プロジェクト選択 |
| `createProject` | C→S | 新規作成 |
| `deleteProject` | C→S | 削除 |
| `message` | C→S | ゲーム生成リクエスト |
| `stream` | S→C | リアルタイムストリーム |
| `jobUpdate` | S→C | ジョブ状態更新 |
| `gameUpdated` | S→C | ゲーム完成 |
| `getVersions` | C→S | バージョン一覧 |
| `restoreVersion` | C→S | バージョン復元 |
| `cancel` | C→S | キャンセル |
| `error` | S→C | エラー通知 |

---

## REST API

### 認証・設定
- `GET /api/health` - ヘルスチェック
- `GET /api/config` - Supabase設定

### プロジェクト
- `GET /api/projects` - 一覧
- `GET /api/projects/:id` - 詳細
- `GET /api/projects/:id/code` - HTMLコード
- `GET /api/projects/:id/preview` - プレビュー
- `GET /api/projects/:id/download` - ZIPダウンロード

### ジョブ
- `GET /api/jobs/:id` - 状態取得
- `POST /api/jobs/:id/cancel` - キャンセル

### アセット
- `POST /api/assets/upload` - アップロード
- `GET /api/assets` - 一覧
- `GET /api/assets/:id` - 取得
- `DELETE /api/assets/:id` - 削除（ソフト）
- `GET /user-assets/:userId/:alias` - ユーザーアセット配信
- `GET /global-assets/:category/:alias` - グローバルアセット配信

### 画像生成
- `POST /api/generate-image` - Gemini Imagen
- `POST /api/assets/remove-background` - 背景削除

### 公開
- `GET/PUT /api/projects/:id/publish-draft` - 公開ドラフト
- `POST /api/projects/:id/generate-thumbnail` - サムネイル生成
- `POST /api/projects/:id/generate-movie` - 動画生成

### ゲーム配信
- `GET /game/:userId/:projectId/*` - ゲームファイル（owner-only）
- `GET /play/:projectId` - プレイ画面（owner-only）

---

## セキュリティ

### 認証・認可
- **JWT検証**: jose + JWKS（ローカル、API呼び出しゼロ）
- **RLS**: Supabase提供、owner-onlyアクセス
- **所有者チェック**: `checkProjectOwnership` / `checkAssetOwnership`

### HTTP応答
- 他ユーザーのリソース → **404**（403ではなく）
- RLSがフィルタ → 「存在しない」扱い（情報漏洩防止）

### スロット制限
- `USER_LIMIT_EXCEEDED`: ユーザー同時実行超過
- `SYSTEM_LIMIT_EXCEEDED`: システム全体超過

---

## 外部依存

| パッケージ | 用途 |
|-----------|------|
| Express.js | HTTP/RESTサーバー |
| ws | WebSocket通信 |
| @supabase/supabase-js | Supabase クライアント |
| jose | JWT ローカル検証 |
| sharp | 画像変換 |
| multer | ファイルアップロード |
| archiver | ZIP圧縮 |
| child_process | Claude CLI / Git実行 |

---

## 機能スコープ

**DreamCore-V2 の現状仕様に完全に従う。機能削減はしない。**

各エンドポイント・ページの挙動は DreamCore-V2 の実装をそのまま引き継ぐ。
参照: `/Users/admin/DreamCore-V2/`
