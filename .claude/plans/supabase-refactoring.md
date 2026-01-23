# DreamCore V2 Supabase リファクタリング計画

**作成日:** 2026-01-23
**最終更新:** 2026-01-23
**ステータス:** 本番調査完了 → 003 修正待ち

---

## エグゼクティブサマリー

本番 Supabase の調査が完了し、専門家レビューを反映した最終計画。

### 優先順位

| 優先度 | 領域 | 状態 |
|--------|------|------|
| **P0** | スキーマ整合性 + RLS 整理 | 🔄 計画確定、実装待ち |
| **P1** | RLS 最適化 `(SELECT auth.uid())` | 🔄 P0 と同時実装 |
| **P2** | FK/RLS インデックス追加 | 🔄 P0 と同時実装 |
| **P3** | tsvector 検索移行 | ⏳ 後続 |
| **P4** | クエリ簡素化 | ⏳ 後続 |
| **P5** | サーバー側共通化 | ⏳ 後続 |
| **P6** | フロントエンド改善 | ⏳ 後続 |

---

## 本番調査結果（2026-01-23 実施）

### A. users / profiles テーブル

| テーブル | 件数 | 備考 |
|----------|------|------|
| `users` | 5 | FK 参照先（projects, assets） |
| `profiles` | 11 | レガシー。jobs のみが FK 参照 |

**詳細:**
- `profiles のみ`: 6件（古いテスト用アカウント）
- `両方に存在`: 5件
- `handle_new_user()` トリガー: 現在は `users` に INSERT

**結論:** `profiles` はレガシー。バックフィル後に廃止可能。

### B. FK 参照先の不整合

| テーブル | カラム | 参照先 |
|----------|--------|--------|
| projects | user_id | **users** ✅ |
| assets | owner_id | **users** ✅ |
| jobs | user_id | **profiles** ⚠️ 要修正 |

### C. 欠落カラム

| カラム | 存在 |
|--------|------|
| `assets.is_deleted` | ✅ |
| `projects.remixed_from` | ❌ 追加必要 |
| `assets.available_from` | ❌ 追加必要 |
| `assets.available_until` | ❌ 追加必要 |

### D. RLS ポリシー状況

| テーブル | ポリシー数 | 問題 |
|----------|-----------|------|
| assets | 8 | 4ペア重複（`Users can...` + `assets_...`） |
| projects | 8 | 4ペア重複（`Users can...` + `projects_...`） |
| games | 4 | `games_read_public` が Phase 1 と矛盾 |
| users | 2 | 正常 |

**全ポリシー共通:**
- `roles = {public}` → `authenticated` に絞るべき（セキュリティ原則）
- `permissive = PERMISSIVE` → 重複は OR 結合（実害なし）
- `auth.uid()` 直書き → `(SELECT auth.uid())` に最適化必要

---

## 003_sync_schema.sql 修正計画

### 修正項目一覧

| # | 項目 | 対応内容 |
|---|------|----------|
| 1 | **バックフィル** | profiles → users（既存実装 OK） |
| 2 | **jobs FK 変更** | profiles → users に変更 |
| 3 | **jobs インデックス追加** | `jobs_user_id_idx` |
| 4 | **欠落カラム追加** | remixed_from, available_from/until |
| 5 | **RLS 重複削除** | `Users can...` を削除、`*_own` を残す |
| 6 | **games_read_public 削除** | Phase 1 整合性のため（存在する場合のみ） |
| 7 | **RLS 最適化** | `auth.uid()` → `(SELECT auth.uid())` |
| 8 | **RLS roles 変更** | `{public}` → `{authenticated}` に変更 |
| 9 | **FK インデックス追加** | 全 FK 列にインデックス |
| 10 | **Partial インデックス追加** | `assets WHERE is_deleted = FALSE` |

### 詳細: RLS ポリシー整理

**方針:**
- `roles = {public}` → `TO authenticated` に変更（セキュリティ原則）
- 重複削除と新規作成は **同一トランザクション内** で実行（空白期間を作らない）
- 削除 → 即座に再作成 の順序を守る

**削除対象（重複）:**
```sql
-- assets（削除後に即座に再作成）
DROP POLICY IF EXISTS "Users can read own assets" ON assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON assets;
DROP POLICY IF EXISTS "Users can update own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON assets;

-- projects（削除後に即座に再作成）
DROP POLICY IF EXISTS "Users can read own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- games（存在する場合のみ削除）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'games' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "games_read_public" ON public.games;
  END IF;
END $$;
```

**再作成（最適化版）:**
```sql
-- 例: projects（TO authenticated + (SELECT auth.uid())）
DROP POLICY IF EXISTS "projects_read_own" ON projects;
CREATE POLICY "projects_read_own" ON projects
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

### 詳細: インデックス追加

**対象列一覧（FK + RLS 条件列）:**

| テーブル | カラム | 種類 | 用途 |
|----------|--------|------|------|
| jobs | user_id | FK | RLS 条件 |
| projects | user_id | FK | RLS 条件 |
| assets | owner_id | FK | RLS 条件 |
| project_assets | project_id | FK | RLS サブクエリ |
| project_assets | asset_id | FK | RLS サブクエリ |
| chat_history | project_id | FK | RLS サブクエリ |
| publish_drafts | project_id | FK | RLS サブクエリ |
| activity_log | user_id | FK | RLS 条件 |
| assets | owner_id + is_deleted | Partial | アクティブアセット |

```sql
-- FK インデックス（必須）
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON project_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_asset_id ON project_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON chat_history(project_id);
CREATE INDEX IF NOT EXISTS idx_publish_drafts_project_id ON publish_drafts(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);

-- Composite インデックス（頻出クエリ）
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status);

-- Partial インデックス（is_deleted 対応）
CREATE INDEX IF NOT EXISTS idx_assets_owner_active ON assets(owner_id, created_at DESC)
  WHERE is_deleted = FALSE;
```

---

## 実行手順

### Step 1: 003_sync_schema.sql 修正

上記の修正項目を反映したマイグレーションファイルを作成。

### Step 2: 本番適用前の確認

```sql
-- 適用前に再度確認
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

### Step 3: 本番適用

Supabase SQL Editor で 003 を実行。

### Step 4: profiles テーブル削除（オプション）

```sql
-- バックフィル完了後
DROP TABLE IF EXISTS public.profiles CASCADE;
```

### Step 5: 動作確認

- 既存テストスイート実行
- RLS 動作確認
- アプリ動作確認

---

## 検討事項

### profiles テーブルの扱い

| オプション | 説明 | 推奨度 |
|------------|------|--------|
| A: バックフィル後に DROP | 完全廃止 | ⭐⭐⭐ |
| B: ビュー化 | users へのビューとして残す | ⭐⭐ |
| C: 放置 | 参照しないが残す | ⭐ |

**推奨: A（DROP）** - コードで一切参照していないため。

**DROP 前の確認事項:**
```sql
-- 1. profiles を参照する関数がないか確認
SELECT proname, prosrc
FROM pg_proc
WHERE prosrc LIKE '%profiles%';

-- 2. profiles を参照するビューがないか確認
SELECT viewname, definition
FROM pg_views
WHERE definition LIKE '%profiles%';

-- 3. profiles を参照するトリガーがないか確認
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass;
```

**確認後の DROP:**
```sql
-- バックフィル完了 & 上記確認後に実行
DROP TABLE IF EXISTS public.profiles CASCADE;
```

### games テーブルの扱い

| オプション | 説明 | 推奨度 |
|------------|------|--------|
| A: ポリシー削除のみ | games_read_public を削除 | ⭐⭐⭐ |
| B: テーブルごと DROP | Phase 2 で再作成 | ⭐⭐ |
| C: 放置 | 使われていないので害なし | ⭐ |

**推奨: A（ポリシー削除のみ）** - Phase 1 整合性のため。テーブルは Phase 2 用に残す。

---

## 専門家レビュー対応記録

### 第1回レビュー（計画策定時）

| 指摘 | 対応 |
|------|------|
| スキーマ整合性を最優先 | P0 として計画 |
| Partial Index のサブクエリは不可 | 計画から削除 |
| activity_log_project_id_idx は誤り | 計画から削除 |
| tsvector 移行 | P3 として計画 |

### 第2回レビュー（本番調査後）

| 指摘 | 対応 |
|------|------|
| pg_policies の roles/permissive 確認 | ✅ 確認完了 |
| assets/projects 重複ポリシー削除 | `Users can...` を削除 |
| games_read_public は Phase 1 と矛盾 | 削除予定 |
| roles={public} は authenticated に絞るべき | 対応予定 |
| RLS 最適化 `(SELECT auth.uid())` | 全ポリシーで対応 |
| FK/RLS 条件列のインデックス追加 | 追加予定 |

---

## 参考資料

- [Supabase RLS Performance](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)
- [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [Supabase Full Text Search](https://supabase.com/docs/guides/database/full-text-search)
- Supabase Skills: `schema-foreign-key-indexes`, `security-rls-performance`
