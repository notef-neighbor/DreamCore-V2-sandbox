-- =============================================
-- DreamCore V2 - Supabase Schema
-- =============================================
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 0. EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 1. PROFILES TABLE (linked to auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for auto-creating profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 2. PROJECTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New Game',
  is_public BOOLEAN DEFAULT FALSE,
  remixed_from UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_public ON public.projects(is_public);

-- =============================================
-- 3. ASSETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  is_public BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  tags TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON public.assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_assets_is_public ON public.assets(is_public);
CREATE INDEX IF NOT EXISTS idx_assets_is_deleted ON public.assets(is_deleted);

-- =============================================
-- 4. PROJECT_ASSETS TABLE (junction)
-- =============================================
CREATE TABLE IF NOT EXISTS public.project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  usage_type TEXT DEFAULT 'image',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON public.project_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_asset_id ON public.project_assets(asset_id);

-- =============================================
-- 5. CHAT_HISTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON public.chat_history(project_id);

-- =============================================
-- 6. JOBS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0,
  progress_message TEXT,
  result TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);

-- =============================================
-- 7. PUBLISH_DRAFTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.publish_drafts (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  how_to_play TEXT,
  tags TEXT,
  visibility TEXT DEFAULT 'public',
  remix TEXT DEFAULT 'allowed',
  thumbnail_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. ACTIVITY_LOG TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at);

-- =============================================
-- 9. UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply updated_at triggers (with DROP for re-runnability)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_publish_drafts_updated_at ON public.publish_drafts;
CREATE TRIGGER update_publish_drafts_updated_at
  BEFORE UPDATE ON public.publish_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
