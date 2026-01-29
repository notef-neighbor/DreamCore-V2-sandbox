# ウェイトリスト/アクセス管理

V2 初期リリース用のアクセス制御機能。承認されたユーザーのみがアプリを利用可能。

---

## 概要

- **目的**: 初期リリース時に利用者を限定
- **認証**: Google OAuth（Supabase Auth）
- **承認**: Supabase Dashboard から手動で行う

---

## ユーザーフロー

```
1. ユーザーが / にアクセス
2. Google Sign-In でログイン
3. user_access テーブルをチェック
   - approved → /create.html（アプリ）へ
   - pending または未登録 → /waitlist.html へ
4. waitlist.html でウェイトリスト登録 API を呼び出し
5. 管理者が Supabase Dashboard で承認
6. 次回ログイン時にアプリ利用可能
```

---

## テーブル構造

**テーブル名**: `user_access`

| カラム | 型 | 説明 |
|--------|-----|------|
| email | TEXT (PK) | ユーザーのメールアドレス |
| status | TEXT | `pending` または `approved` |
| display_name | TEXT | Google アカウントの表示名 |
| avatar_url | TEXT | Google アカウントのアバター URL |
| requested_at | TIMESTAMPTZ | 登録日時 |
| approved_at | TIMESTAMPTZ | 承認日時（手動更新） |
| note | TEXT | 管理者メモ |

**マイグレーション**: `supabase/migrations/009_user_access.sql`

---

## API エンドポイント

### GET /api/check-access

ユーザーのアクセス権を確認。

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "allowed": true,
  "status": "approved"
}
```

### POST /api/waitlist/register

ウェイトリストに登録。既存ユーザーは更新しない（ignoreDuplicates）。

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response**:
```json
{
  "success": true
}
```

---

## フロントエンド

### auth.js

新しい関数:

- `checkAccess()` - アクセス権を確認、`{ allowed, status }` を返す
- `requireAuthAndAccess()` - 認証 + アクセス権を確認、不可なら `/waitlist.html` へリダイレクト

### 保護されたページ

以下のページでアクセスチェックを実行:

- `create.html` / `app.js` - checkAuthAndConnect() 内
- `mypage.html` / `mypage.js` - init() 内
- `discover.html` - DOMContentLoaded 内

---

## 管理方法

### ユーザーを承認する

1. Supabase Dashboard → Table Editor → `user_access`
2. 承認したいユーザーの行を選択
3. `status` を `pending` から `approved` に変更
4. （任意）`approved_at` に現在時刻を設定
5. （任意）`note` にメモを追加
6. Save

### pending ユーザーを確認

```sql
SELECT * FROM user_access WHERE status = 'pending' ORDER BY requested_at DESC;
```

### 一括承認

```sql
UPDATE user_access
SET status = 'approved', approved_at = now()
WHERE email IN ('user1@example.com', 'user2@example.com');
```

---

## 無効化方法

ウェイトリスト機能を完全に無効化するには:

### 方法1: ルートを無効化（推奨）

`server/index.js` の以下の行をコメントアウト:

```javascript
// waitlist.setupRoutes(app);
```

→ API は 404 を返す。フロントエンドのチェックは失敗し、全員アクセス可能になる。

### 方法2: 全員を承認

```sql
UPDATE user_access SET status = 'approved' WHERE status = 'pending';
```

### 方法3: フロントエンドのチェックを削除

`app.js`, `mypage.js`, `discover.html` から `checkAccess()` 呼び出しを削除。

---

## 完全削除方法

1. `server/index.js` から `require('./waitlist')` と `setupRoutes` を削除
2. `server/waitlist.js` を削除
3. `public/waitlist.html` を削除
4. `auth.js` から `checkAccess`, `requireAuthAndAccess` を削除
5. 各ページから `checkAccess()` 呼び出しを削除
6. Supabase: `DROP TABLE user_access;`

---

## セキュリティ

- `user_access` テーブルは RLS で保護（service_role のみアクセス可）
- フロントエンドから直接テーブルにアクセスできない
- API は `supabaseAdmin`（service_role）経由でアクセス
- トークン検証は `supabaseAdmin.auth.getUser()` で実施

---

## ファイル一覧

| ファイル | 役割 |
|----------|------|
| `server/waitlist.js` | バックエンド API |
| `public/waitlist.html` | ウェイトリストページ UI |
| `public/auth.js` | `checkAccess()`, `requireAuthAndAccess()` |
| `public/app.js` | create.html のアクセスチェック |
| `public/mypage.js` | mypage.html のアクセスチェック |
| `public/discover.html` | discover ページのアクセスチェック |
| `supabase/migrations/009_user_access.sql` | テーブル定義 |
| `docs/WAITLIST.md` | このドキュメント |
