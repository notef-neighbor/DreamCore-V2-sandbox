/**
 * Supabase Client for DreamCore V2
 *
 * V2 uses Supabase Auth for user authentication (Google OAuth).
 * This file provides server-side Supabase client initialization.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from environment variables
// NOTE: Environment validation is done in config.js at startup
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Public Supabase client (anon key)
 * Use for operations that should respect RLS policies
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Admin Supabase client (service role key)
 * Use for server-side operations that bypass RLS
 * WARNING: Only use on server-side, never expose to client
 */
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

/**
 * Create a Supabase client with a specific user's JWT
 * @param {string} accessToken - User's access token from Supabase Auth
 * @returns {SupabaseClient} Client authenticated as the user
 */
const createUserClient = (accessToken) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
};

/**
 * Verify a JWT access token and return user info
 * @param {string} accessToken - JWT access token
 * @returns {Promise<{user: Object|null, error: Error|null}>}
 */
const verifyToken = async (accessToken) => {
  if (!supabaseAdmin) {
    console.error('[Supabase] Admin client not available. Check SUPABASE_SERVICE_ROLE_KEY.');
    return { user: null, error: new Error('Server configuration error') };
  }

  if (!accessToken || typeof accessToken !== 'string') {
    return { user: null, error: new Error('Invalid access token') };
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error) {
      // Log specific error types for debugging
      if (error.message?.includes('expired')) {
        console.warn('[Supabase] Token expired');
      } else if (error.message?.includes('invalid')) {
        console.warn('[Supabase] Invalid token format');
      } else {
        console.error('[Supabase] Token verification error:', error.message);
      }
      return { user: null, error };
    }

    if (!user) {
      return { user: null, error: new Error('User not found') };
    }

    return { user, error: null };
  } catch (err) {
    console.error('[Supabase] Unexpected error during token verification:', err.message);
    return { user: null, error: err };
  }
};

/**
 * Check if admin client is available
 * @returns {boolean}
 */
const isAdminConfigured = () => {
  return !!supabaseAdmin;
};

module.exports = {
  supabase,
  supabaseAdmin,
  createUserClient,
  verifyToken,
  isAdminConfigured,
  SUPABASE_URL
};
