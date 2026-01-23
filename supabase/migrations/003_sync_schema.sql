-- =============================================
-- Migration 003: Sync Schema (Production Alignment)
-- =============================================
-- Purpose:
--   Align production schema with current code expectations
--   WITHOUT recreating tables that already exist in prod.
--
-- Changes (2026-01-23):
--   - RLS optimization: auth.uid() -> (SELECT auth.uid())
--   - RLS roles: TO authenticated (security principle)
--   - games_read_public removal (Phase 1 consistency)
--   - FK indexes addition (performance)
--
-- Notes:
--   - This migration assumes core tables already exist in production.
--   - For fresh environments, use supabase/schema.sql or 001 + schema.sql.
-- =============================================

-- =============================================
-- 0. BACKFILL users FROM profiles (legacy data)
-- =============================================
-- Insert profiles that do not exist in users yet.
-- If email conflict exists, skip (manual resolution required).
-- Guarded: profiles table may not exist in fresh environments.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.users (id, email, display_name, avatar_url, created_at)
    SELECT
      p.id,
      p.email,
      p.display_name,
      p.avatar_url,
      COALESCE(p.created_at, NOW())
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.users u2 WHERE u2.email = p.email
    );
  END IF;
END $$;

-- =============================================
-- 1. JOBS FK: profiles -> users
-- =============================================
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_user_id_fkey;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- =============================================
-- 2. MISSING COLUMNS
-- =============================================
-- projects.remixed_from (Phase 2 remix feature)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS remixed_from UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- assets.available_from / available_until (time-limited assets)
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ;
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;

-- =============================================
-- 3. GAMES: Phase 1 consistency (owner-only + authenticated)
-- =============================================
-- Drop all existing policies and recreate with:
--   - TO authenticated (security principle)
--   - (SELECT auth.uid()) optimization
--   - WITH CHECK for INSERT/UPDATE
-- Note: DROP → CREATE in same block to minimize RLS gap.
DO $$
BEGIN
  IF to_regclass('public.games') IS NOT NULL THEN
    -- Enable RLS
    ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

    -- Drop all existing policies
    DROP POLICY IF EXISTS "games_read_public" ON public.games;
    DROP POLICY IF EXISTS "games_read_own" ON public.games;
    DROP POLICY IF EXISTS "games_insert_own" ON public.games;
    DROP POLICY IF EXISTS "games_update_own" ON public.games;
    DROP POLICY IF EXISTS "games_delete_own" ON public.games;

    -- Recreate with authenticated + owner-only
    CREATE POLICY "games_read_own" ON public.games
      FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()));

    CREATE POLICY "games_insert_own" ON public.games
      FOR INSERT TO authenticated
      WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "games_update_own" ON public.games
      FOR UPDATE TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));

    CREATE POLICY "games_delete_own" ON public.games
      FOR DELETE TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- =============================================
-- 4. RLS POLICY CLEANUP & OPTIMIZATION
-- =============================================
-- Changes:
--   1. Remove duplicate policies (Users can... variants)
--   2. Use (SELECT auth.uid()) for performance
--   3. Add TO authenticated for security
-- =============================================

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4.1 USERS
-- =============================================
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- =============================================
-- 4.2 PROJECTS
-- =============================================
DROP POLICY IF EXISTS "Users can read own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "projects_read_own" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;

CREATE POLICY "projects_read_own" ON public.projects
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- =============================================
-- 4.3 ASSETS
-- =============================================
DROP POLICY IF EXISTS "Users can read own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON public.assets;
DROP POLICY IF EXISTS "assets_read_own" ON public.assets;
DROP POLICY IF EXISTS "assets_insert_own" ON public.assets;
DROP POLICY IF EXISTS "assets_update_own" ON public.assets;
DROP POLICY IF EXISTS "assets_delete_own" ON public.assets;

CREATE POLICY "assets_read_own" ON public.assets
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND is_deleted = FALSE);

CREATE POLICY "assets_insert_own" ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "assets_update_own" ON public.assets
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "assets_delete_own" ON public.assets
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- =============================================
-- 4.4 PROJECT_ASSETS
-- =============================================
DROP POLICY IF EXISTS "project_assets_manage_own" ON public.project_assets;
DROP POLICY IF EXISTS "Users can read own project_assets" ON public.project_assets;
DROP POLICY IF EXISTS "Users can insert own project_assets" ON public.project_assets;
DROP POLICY IF EXISTS "Users can delete own project_assets" ON public.project_assets;
DROP POLICY IF EXISTS "project_assets_read_own" ON public.project_assets;
DROP POLICY IF EXISTS "project_assets_insert_own" ON public.project_assets;
DROP POLICY IF EXISTS "project_assets_update_own" ON public.project_assets;
DROP POLICY IF EXISTS "project_assets_delete_own" ON public.project_assets;

CREATE POLICY "project_assets_read_own" ON public.project_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_assets.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "project_assets_insert_own" ON public.project_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_assets.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
    AND
    EXISTS (
      SELECT 1 FROM public.assets
      WHERE assets.id = project_assets.asset_id
      AND assets.owner_id = (SELECT auth.uid())
      AND assets.is_deleted = FALSE
    )
  );

CREATE POLICY "project_assets_update_own" ON public.project_assets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_assets.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_assets.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
    AND
    EXISTS (
      SELECT 1 FROM public.assets
      WHERE assets.id = project_assets.asset_id
      AND assets.owner_id = (SELECT auth.uid())
      AND assets.is_deleted = FALSE
    )
  );

CREATE POLICY "project_assets_delete_own" ON public.project_assets
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_assets.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

-- =============================================
-- 4.5 CHAT_HISTORY
-- =============================================
DROP POLICY IF EXISTS "Users can read own chat_history" ON public.chat_history;
DROP POLICY IF EXISTS "Users can insert own chat_history" ON public.chat_history;
DROP POLICY IF EXISTS "Users can delete own chat_history" ON public.chat_history;
DROP POLICY IF EXISTS "chat_history_read_own" ON public.chat_history;
DROP POLICY IF EXISTS "chat_history_insert_own" ON public.chat_history;
DROP POLICY IF EXISTS "chat_history_delete_own" ON public.chat_history;

CREATE POLICY "chat_history_read_own" ON public.chat_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = chat_history.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "chat_history_insert_own" ON public.chat_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = chat_history.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "chat_history_delete_own" ON public.chat_history
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = chat_history.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

-- =============================================
-- 4.6 JOBS (user can read/insert only; updates via service_role)
-- =============================================
DROP POLICY IF EXISTS "Users can read own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.jobs;
DROP POLICY IF EXISTS "jobs_read_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_own" ON public.jobs;

CREATE POLICY "jobs_read_own" ON public.jobs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "jobs_insert_own" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = jobs.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

-- =============================================
-- 4.7 PUBLISH_DRAFTS
-- =============================================
DROP POLICY IF EXISTS "Users can read own publish_drafts" ON public.publish_drafts;
DROP POLICY IF EXISTS "Users can insert own publish_drafts" ON public.publish_drafts;
DROP POLICY IF EXISTS "Users can update own publish_drafts" ON public.publish_drafts;
DROP POLICY IF EXISTS "Users can delete own publish_drafts" ON public.publish_drafts;
DROP POLICY IF EXISTS "publish_drafts_read_own" ON public.publish_drafts;
DROP POLICY IF EXISTS "publish_drafts_insert_own" ON public.publish_drafts;
DROP POLICY IF EXISTS "publish_drafts_update_own" ON public.publish_drafts;
DROP POLICY IF EXISTS "publish_drafts_delete_own" ON public.publish_drafts;

CREATE POLICY "publish_drafts_read_own" ON public.publish_drafts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = publish_drafts.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "publish_drafts_insert_own" ON public.publish_drafts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = publish_drafts.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "publish_drafts_update_own" ON public.publish_drafts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = publish_drafts.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = publish_drafts.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "publish_drafts_delete_own" ON public.publish_drafts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = publish_drafts.project_id
      AND projects.user_id = (SELECT auth.uid())
    )
  );

-- =============================================
-- 4.8 ACTIVITY_LOG
-- =============================================
DROP POLICY IF EXISTS "Users can read own activity" ON public.activity_log;
DROP POLICY IF EXISTS "Users can insert own activity" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_read_own" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_insert_own" ON public.activity_log;

CREATE POLICY "activity_log_read_own" ON public.activity_log
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "activity_log_insert_own" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- =============================================
-- 5. INDEXES (FK + Composite + Partial)
-- =============================================

-- 5.1 FK Indexes (required for JOIN/DELETE performance)
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_remixed_from ON public.projects(remixed_from);
CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON public.assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON public.project_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_asset_id ON public.project_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON public.chat_history(project_id);
CREATE INDEX IF NOT EXISTS idx_publish_drafts_project_id ON public.publish_drafts(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);

-- 5.2 Composite Indexes (frequent query patterns)
CREATE INDEX IF NOT EXISTS idx_projects_user_updated
  ON public.projects(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_user_status
  ON public.jobs(user_id, status);

-- 5.3 Partial Indexes (is_deleted filtering)
CREATE INDEX IF NOT EXISTS idx_assets_owner_active
  ON public.assets(owner_id, created_at DESC)
  WHERE is_deleted = FALSE;

-- =============================================
-- 6. updated_at TRIGGERS (ensure present)
-- =============================================
DROP TRIGGER IF EXISTS jobs_updated_at ON public.jobs;
CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS publish_drafts_updated_at ON public.publish_drafts;
CREATE TRIGGER publish_drafts_updated_at
  BEFORE UPDATE ON public.publish_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- END OF MIGRATION
-- =============================================
