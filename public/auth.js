/**
 * Supabase Auth Client for DreamCore V2
 *
 * Provides authentication utilities using Supabase Auth with Google OAuth.
 */

// Global auth state
let supabaseClient = null;
let currentSession = null;
let authStateListeners = [];

/**
 * Initialize Supabase client
 * Must be called before any auth operations
 */
async function initAuth() {
  if (supabaseClient) return supabaseClient;

  // Fetch config from server
  const response = await fetch('/api/config');
  const config = await response.json();

  // Load Supabase JS from CDN if not already loaded
  if (!window.supabase) {
    await loadSupabaseScript();
  }

  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  // Listen for auth state changes
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('[Auth] State changed:', event);
    currentSession = session;
    authStateListeners.forEach(listener => listener(event, session));
  });

  // Get initial session
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentSession = session;

  return supabaseClient;
}

/**
 * Load Supabase JS library from CDN
 */
function loadSupabaseScript() {
  return new Promise((resolve, reject) => {
    if (window.supabase) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Sign in with Google OAuth
 */
async function signInWithGoogle() {
  if (!supabaseClient) await initAuth();

  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/create.html'
    }
  });

  if (error) {
    console.error('[Auth] Google sign-in error:', error);
    throw error;
  }

  return data;
}

/**
 * Sign out
 */
async function signOut() {
  if (!supabaseClient) await initAuth();

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error('[Auth] Sign out error:', error);
    throw error;
  }

  // Clear local storage
  localStorage.removeItem('visitorId');
  localStorage.removeItem('sessionId');

  // Redirect to login
  window.location.href = '/';
}

/**
 * Get current session
 * @returns {Object|null} Current session or null if not authenticated
 */
async function getSession() {
  if (!supabaseClient) await initAuth();

  if (currentSession) return currentSession;

  const { data: { session } } = await supabaseClient.auth.getSession();
  currentSession = session;
  return session;
}

/**
 * Get current user
 * @returns {Object|null} Current user or null if not authenticated
 */
async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Get access token for API calls
 * @returns {string|null} Access token or null if not authenticated
 */
async function getAccessToken() {
  const session = await getSession();
  return session?.access_token || null;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

/**
 * Add auth state change listener
 * @param {Function} listener - Callback function (event, session)
 */
function onAuthStateChange(listener) {
  authStateListeners.push(listener);
}

/**
 * Remove auth state change listener
 * @param {Function} listener - Callback function to remove
 */
function offAuthStateChange(listener) {
  authStateListeners = authStateListeners.filter(l => l !== listener);
}

/**
 * Authenticated fetch wrapper
 * Automatically adds Authorization header
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function authFetch(url, options = {}) {
  const token = await getAccessToken();

  const headers = {
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Require authentication - redirect to login if not authenticated
 * Call this at the start of protected pages
 */
async function requireAuth() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    window.location.href = '/';
    return false;
  }
  return true;
}

// Export for use in other scripts
window.DreamCoreAuth = {
  initAuth,
  signInWithGoogle,
  signOut,
  getSession,
  getUser,
  getAccessToken,
  isAuthenticated,
  onAuthStateChange,
  offAuthStateChange,
  authFetch,
  requireAuth
};
