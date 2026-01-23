-- =====================================================
-- Migration: 006_sync_rls.sql
-- Description: Phase 2準備 - anon向けSELECTポリシー追加
-- Created: 2026-01-23
--
-- 変更内容:
--   1. assets: anonユーザー向けSELECTポリシー確認（005で追加済み）
--   2. projects: anonユーザー向けSELECT追加
--   3. project_assets: anonユーザー向けSELECT追加
--
-- Note: 冪等性のあるマイグレーション（DROP IF EXISTS後にCREATE）
-- =====================================================

-- =====================================================
-- 1. assets: anon向けSELECTポリシー（005_asset_v2.sqlで追加済み）
-- =====================================================
-- 確認のため再作成（冪等）
DROP POLICY IF EXISTS "assets_select_anon" ON public.assets;
CREATE POLICY "assets_select_anon" ON public.assets
  FOR SELECT TO anon
  USING (
    is_deleted = FALSE
    AND (
      is_public = TRUE
      OR is_global = TRUE
    )
  );

-- =====================================================
-- 2. projects: anon向けSELECT追加
-- =====================================================
-- 公開プロジェクトはanonユーザーも閲覧可能
DROP POLICY IF EXISTS "projects_select_anon" ON public.projects;
CREATE POLICY "projects_select_anon" ON public.projects
  FOR SELECT TO anon
  USING (is_public = TRUE);

-- =====================================================
-- 3. project_assets: anon向けSELECT追加
-- =====================================================
-- 公開プロジェクトに紐づくアセットリンクはanonユーザーも閲覧可能
DROP POLICY IF EXISTS "project_assets_select_anon" ON public.project_assets;
CREATE POLICY "project_assets_select_anon" ON public.project_assets
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_assets.project_id
        AND projects.is_public = TRUE
    )
  );

-- =====================================================
-- 4. chat_history: anon向けSELECT追加（公開プロジェクトの会話履歴）
-- =====================================================
-- Phase 2で公開ゲームページに会話履歴を表示する場合に備えて
DROP POLICY IF EXISTS "chat_history_select_anon" ON public.chat_history;
CREATE POLICY "chat_history_select_anon" ON public.chat_history
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = chat_history.project_id
        AND projects.is_public = TRUE
    )
  );

-- =====================================================
-- 5. publish_drafts: anon向けSELECT追加（公開情報）
-- =====================================================
-- 公開プロジェクトのpublish情報はanonも閲覧可能
DROP POLICY IF EXISTS "publish_drafts_select_anon" ON public.publish_drafts;
CREATE POLICY "publish_drafts_select_anon" ON public.publish_drafts
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = publish_drafts.project_id
        AND projects.is_public = TRUE
    )
  );

-- =====================================================
-- コメント追加
-- =====================================================
COMMENT ON POLICY "assets_select_anon" ON public.assets IS 'Phase 2: 公開・グローバルアセットはanonも閲覧可';
COMMENT ON POLICY "projects_select_anon" ON public.projects IS 'Phase 2: 公開プロジェクトはanonも閲覧可';
COMMENT ON POLICY "project_assets_select_anon" ON public.project_assets IS 'Phase 2: 公開プロジェクトのアセットリンクはanonも閲覧可';
COMMENT ON POLICY "chat_history_select_anon" ON public.chat_history IS 'Phase 2: 公開プロジェクトの会話履歴はanonも閲覧可';
COMMENT ON POLICY "publish_drafts_select_anon" ON public.publish_drafts IS 'Phase 2: 公開プロジェクトの公開情報はanonも閲覧可';
