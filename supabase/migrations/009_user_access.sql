-- ウェイトリスト/アクセス管理テーブル
-- V2 初期リリース用。承認されたユーザーのみアプリ利用可能。
--
-- 削除方法: DROP TABLE user_access;

CREATE TABLE IF NOT EXISTS user_access (
    email TEXT PRIMARY KEY,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    display_name TEXT,
    avatar_url TEXT,
    requested_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    note TEXT  -- 管理者メモ
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_user_access_status ON user_access(status);

-- RLS 有効化
ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;

-- ポリシー: service_role のみアクセス可（フロントエンドからは直接アクセス不可）
-- 管理は Supabase Dashboard から行う
CREATE POLICY "Service role only" ON user_access
    FOR ALL
    USING (false)
    WITH CHECK (false);

COMMENT ON TABLE user_access IS 'ウェイトリスト/アクセス管理。V2初期リリース用。WAITLIST.md参照。';
