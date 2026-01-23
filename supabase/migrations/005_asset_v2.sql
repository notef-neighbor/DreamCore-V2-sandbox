-- =====================================================
-- Migration: 005_asset_v2.sql
-- Description: アセットアーキテクチャV2 - エイリアス方式導入
-- Created: 2026-01-23
--
-- 変更内容:
--   1. 新カラム追加: alias, hash, hash_short, original_asset_id,
--      created_in_project_id, is_remix_allowed, is_global, category
--   2. owner_id を NULL 許容に変更（公式アセット対応）
--   3. UNIQUE制約・CHECK制約追加
--   4. 新インデックス追加
--   5. RLSポリシー更新（is_deleted条件追加、globalのみavailability適用）
--
-- Note: 公開前のため後方互換性は考慮しない
--
-- ⚠️ 前提条件:
--   - assets テーブルに既存データがないこと
--   - 以後は INSERT 時に必ず alias と hash を設定すること
-- =====================================================

-- =====================================================
-- 1. 新カラム追加
-- =====================================================

-- alias: URL用のエイリアス（player.png）
ALTER TABLE public.assets ADD COLUMN alias TEXT NOT NULL;

-- hash: SHA256フルハッシュ（64文字）
ALTER TABLE public.assets ADD COLUMN hash TEXT NOT NULL;

-- hash_short: ハッシュ先頭8文字（生成カラム）
ALTER TABLE public.assets
ADD COLUMN hash_short TEXT GENERATED ALWAYS AS (LEFT(hash, 8)) STORED;

-- original_asset_id: Remix元アセットの追跡
ALTER TABLE public.assets
ADD COLUMN original_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;

-- created_in_project_id: 作成元プロジェクト
ALTER TABLE public.assets
ADD COLUMN created_in_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- is_remix_allowed: リミックス許可フラグ
ALTER TABLE public.assets ADD COLUMN is_remix_allowed BOOLEAN DEFAULT FALSE;

-- is_global: 公式アセットフラグ
ALTER TABLE public.assets ADD COLUMN is_global BOOLEAN DEFAULT FALSE;

-- category: カテゴリ（seasonal, characters など）
ALTER TABLE public.assets ADD COLUMN category TEXT;

-- =====================================================
-- 2. owner_id を NULL 許容に変更（公式アセット対応）
-- =====================================================

ALTER TABLE public.assets ALTER COLUMN owner_id DROP NOT NULL;

-- =====================================================
-- 3. 制約追加
-- =====================================================

-- owner_id + alias のユニーク制約（ユーザーアセット用）
ALTER TABLE public.assets
ADD CONSTRAINT assets_owner_alias_unique UNIQUE (owner_id, alias);

-- global/owner_id 整合性チェック
-- is_global=true なら owner_id=NULL、is_global=false なら owner_id必須
ALTER TABLE public.assets
ADD CONSTRAINT assets_global_owner_check CHECK (
  (is_global = TRUE AND owner_id IS NULL)
  OR (is_global = FALSE AND owner_id IS NOT NULL)
);

-- =====================================================
-- 4. インデックス追加
-- =====================================================

-- hash 検索用（重複検出、追跡）
CREATE INDEX idx_assets_hash ON public.assets(hash);

-- original_asset_id 検索用（系譜追跡）
CREATE INDEX idx_assets_original_asset_id ON public.assets(original_asset_id);

-- created_in_project_id 検索用（プロジェクト別一覧）
CREATE INDEX idx_assets_created_in_project_id ON public.assets(created_in_project_id);

-- 公式アセット検索用（部分インデックス）
CREATE INDEX idx_assets_global ON public.assets(is_global) WHERE is_global = TRUE;

-- 公式アセットのalias一意性（部分UNIQUE）
CREATE UNIQUE INDEX idx_assets_global_alias_unique ON public.assets(alias) WHERE is_global = TRUE;

-- =====================================================
-- 5. RLSポリシー更新
-- =====================================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "assets_read_own" ON public.assets;
DROP POLICY IF EXISTS "assets_insert_own" ON public.assets;
DROP POLICY IF EXISTS "assets_update_own" ON public.assets;
DROP POLICY IF EXISTS "assets_delete_own" ON public.assets;

-- SELECT（認証済みユーザー）
-- 条件: is_deleted=false, (所有者 OR 公開 OR 公式)
-- Note: availabilityは公式アセット(is_global)にのみ適用。publicは常時公開。
CREATE POLICY "assets_select_authenticated" ON public.assets
  FOR SELECT TO authenticated
  USING (
    is_deleted = FALSE
    AND (
      owner_id = (SELECT auth.uid())
      OR is_public = TRUE
      OR (
        is_global = TRUE
        AND (available_from IS NULL OR available_from <= NOW())
        AND (available_until IS NULL OR available_until >= NOW())
      )
    )
  );

-- SELECT（匿名ユーザー - 公開ゲーム用）
-- 条件: is_deleted=false, (公開 OR 公式)
-- Note: availabilityは公式アセット(is_global)にのみ適用。publicは常時公開。
DROP POLICY IF EXISTS "assets_select_public" ON public.assets;
CREATE POLICY "assets_select_anon" ON public.assets
  FOR SELECT TO anon
  USING (
    is_deleted = FALSE
    AND (
      is_public = TRUE
      OR (
        is_global = TRUE
        AND (available_from IS NULL OR available_from <= NOW())
        AND (available_until IS NULL OR available_until >= NOW())
      )
    )
  );

-- INSERT（所有者のみ）
CREATE POLICY "assets_insert_own" ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- UPDATE（所有者のみ）
CREATE POLICY "assets_update_own" ON public.assets
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- DELETE（所有者のみ）
CREATE POLICY "assets_delete_own" ON public.assets
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- =====================================================
-- 6. コメント追加
-- =====================================================

COMMENT ON COLUMN public.assets.alias IS 'URL用エイリアス（例: player.png）。owner_id と組み合わせてユニーク';
COMMENT ON COLUMN public.assets.hash IS 'SHA256ハッシュ（64文字）。追跡・重複検出用';
COMMENT ON COLUMN public.assets.hash_short IS 'hashの先頭8文字（自動生成）。ファイル名に使用';
COMMENT ON COLUMN public.assets.original_asset_id IS 'Remix元アセットID。系譜追跡用';
COMMENT ON COLUMN public.assets.created_in_project_id IS '作成元プロジェクトID';
COMMENT ON COLUMN public.assets.is_remix_allowed IS 'リミックス許可フラグ';
COMMENT ON COLUMN public.assets.is_global IS '公式アセットフラグ。owner_id=NULL と組み合わせて使用';
COMMENT ON COLUMN public.assets.category IS 'カテゴリ（seasonal, characters など）';
