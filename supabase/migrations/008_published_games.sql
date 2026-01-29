-- Migration: Create published_games table for V2 game publishing feature
-- Date: 2026-01-30

-- ==================== Table ====================

CREATE TABLE IF NOT EXISTS published_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Metadata
    title TEXT NOT NULL,
    description TEXT,
    how_to_play TEXT,
    tags TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,

    -- Publishing settings
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
    allow_remix BOOLEAN DEFAULT true,

    -- Statistics
    play_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,

    -- Timestamps
    published_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    UNIQUE(project_id)  -- One published game per project
);

-- ==================== Indexes ====================

CREATE INDEX IF NOT EXISTS idx_published_games_user_id ON published_games(user_id);
CREATE INDEX IF NOT EXISTS idx_published_games_visibility ON published_games(visibility);
CREATE INDEX IF NOT EXISTS idx_published_games_published_at ON published_games(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_published_games_play_count ON published_games(play_count DESC);

-- ==================== RLS ====================

ALTER TABLE published_games ENABLE ROW LEVEL SECURITY;

-- Public games are viewable by everyone (SELECT only)
-- Note: unlisted games are NOT visible via RLS - must use service_role
CREATE POLICY "Public games are viewable by everyone"
ON published_games FOR SELECT
USING (visibility = 'public');

-- Users can view all their own games (any visibility)
CREATE POLICY "Users can view their own games"
ON published_games FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own games (with WITH CHECK)
CREATE POLICY "Users can insert their own games"
ON published_games FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own games (with USING and WITH CHECK)
CREATE POLICY "Users can update their own games"
ON published_games FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own games
CREATE POLICY "Users can delete their own games"
ON published_games FOR DELETE
USING (user_id = auth.uid());

-- ==================== Helper Functions ====================

-- Function to increment play count atomically
CREATE OR REPLACE FUNCTION increment_play_count(game_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE published_games
    SET play_count = play_count + 1
    WHERE id = game_id;
END;
$$;

-- ==================== Trigger for updated_at ====================

CREATE OR REPLACE FUNCTION update_published_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_published_games_updated_at
    BEFORE UPDATE ON published_games
    FOR EACH ROW
    EXECUTE FUNCTION update_published_games_updated_at();

-- ==================== Comments ====================

COMMENT ON TABLE published_games IS 'Published games for V2 game publishing feature';
COMMENT ON COLUMN published_games.visibility IS 'public: visible to all, unlisted: accessible via direct link only, private: owner only';
COMMENT ON COLUMN published_games.allow_remix IS 'Whether other users can remix this game';
