-- =====================================================
-- Migration: 007_public_indexes.sql
-- Description: Phase 2 公開アクセス用インデックス追加
-- Created: 2026-01-23
--
-- 背景:
--   - V1で既に7,000件以上の公開ゲームが存在
--   - Phase 2で公開一覧（/discover）へのアクセスが増加予定
--   - anon ユーザーのクエリを高速化する必要あり
-- =====================================================

-- =====================================================
-- 1. 公開プロジェクト用インデックス
-- =====================================================
-- /discover ページで公開プロジェクト一覧を取得する際に使用
-- 条件: is_public = TRUE のみ対象（部分インデックス）

DROP INDEX IF EXISTS idx_projects_public;
CREATE INDEX idx_projects_public
  ON public.projects(updated_at DESC)
  WHERE is_public = TRUE;

COMMENT ON INDEX idx_projects_public IS 'Phase 2: 公開プロジェクト一覧の高速化（新着順）';

-- =====================================================
-- 2. 公開アセット用インデックス（削除済み除外）
-- =====================================================
-- 公開ゲーム内で使用されているアセットの取得を高速化
-- 条件: is_public = TRUE AND is_deleted = FALSE

DROP INDEX IF EXISTS idx_assets_public_active;
CREATE INDEX idx_assets_public_active
  ON public.assets(created_at DESC)
  WHERE is_public = TRUE AND is_deleted = FALSE;

COMMENT ON INDEX idx_assets_public_active IS 'Phase 2: 公開アセット取得の高速化（削除済み除外）';

-- =====================================================
-- 3. 公開プロジェクトのアセットリンク用
-- =====================================================
-- project_assets テーブルから公開プロジェクトのアセットを取得
-- JOINクエリの高速化

-- 既存の idx_project_assets_project_id で対応可能なため追加不要
-- （必要に応じて複合インデックスを検討）
