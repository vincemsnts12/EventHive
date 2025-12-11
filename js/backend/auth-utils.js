// ===== CENTRALIZED AUTH UTILITIES =====
// Single source of truth for authentication state
// All other files should use these functions instead of accessing localStorage directly

// ===== TIMEOUT WRAPPER =====
// Prevents Supabase calls from hanging indefinitely
window.withTimeout = function withTimeout(promise, ms, operation = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    )
  ]);
};

// Default timeouts
const AUTH_TIMEOUT = 10000; // 10 seconds for auth operations
const DATA_TIMEOUT = 15000; // 15 seconds for data operations

// ===== GET SUPABASE CLIENT =====
// Returns the Supabase client, trying multiple sources
window.getSupabase = function getSupabase() {
  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      return supabaseClient;
    } else if (typeof window.getSupabaseClient === 'function') {
      return window.getSupabaseClient();
    } else if (typeof getSupabaseClient === 'function') {
      return getSupabaseClient();
    } else if (typeof initSupabase === 'function') {
      return initSupabase();
    }
  } catch (e) {
    console.warn('Error getting Supabase client:', e.message);
  }
  return null;
};

// ===== GET SAFE USER =====
// Returns current user from session, or null if not authenticated
if (typeof getSafeUser === 'undefined') {
  window.getSafeUser = async function getSafeUser() {
    const supabase = window.getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await window.withTimeout(
        supabase.auth.getSession(),
        AUTH_TIMEOUT,
        'getSession'
      );

      if (error) {
        console.warn('Error getting session:', error.message);
        return null;
      }

      return data?.session?.user || null;
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('Auth session missing') || msg.includes('timed out')) {
        return null;
      }
      console.warn('Error in getSafeUser:', msg);
      return null;
    }
  };
}

// ===== GET CURRENT USER ID =====
// Returns just the user ID, with timeout protection
window.getCurrentUserId = async function getCurrentUserId() {
  const user = await window.getSafeUser();
  return user?.id || null;
};

// ===== CHECK IS ADMIN (SERVER-SIDE) =====
// Uses direct fetch to avoid Supabase client timeout issues
window.checkIsAdmin = async function checkIsAdmin() {
  try {
    const SUPABASE_URL = window.__EH_SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured for admin check');
      return false;
    }

    // Get auth token from localStorage
    let accessToken = null;
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      (key.includes('supabase') && key.includes('auth-token')) ||
      (key.startsWith('sb-') && key.includes('auth-token'))
    );
    if (supabaseAuthKeys.length > 0) {
      try {
        const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
        accessToken = authData?.access_token;
      } catch (e) {
        console.warn('Error parsing auth token:', e);
      }
    }

    if (!accessToken) {
      console.warn('No access token for admin check');
      return false;
    }

    // Use AbortController for timeout (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: '{}',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Admin check failed with status:', response.status);
      return false;
    }

    const data = await response.json();
    return data === true;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('Admin check timed out after 5s');
    } else {
      console.warn('Admin check failed:', err.message);
    }
    return false;
  }
};

// ===== GET AUTH STATE =====
// Returns complete auth state from server (not cache)
// Use this when you need authoritative state
window.getAuthState = async function getAuthState() {
  const supabase = window.getSupabase();

  const result = {
    isLoggedIn: false,
    isAdmin: false,
    userId: null,
    email: null,
    error: null
  };

  if (!supabase) {
    result.error = 'Supabase not available';
    return result;
  }

  try {
    // Get session with timeout
    const { data, error } = await window.withTimeout(
      supabase.auth.getSession(),
      AUTH_TIMEOUT,
      'getSession'
    );

    if (error || !data?.session?.user) {
      return result; // Not logged in
    }

    const user = data.session.user;
    result.isLoggedIn = true;
    result.userId = user.id;
    result.email = user.email;

    // Check admin status via RPC (server-side, not cached)
    result.isAdmin = await window.checkIsAdmin();

    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
};

// ===== UPDATE AUTH CACHE =====
// Updates the localStorage cache (for fast UI loading)
// Should be called after getAuthState() to keep cache fresh
window.updateAuthCache = function updateAuthCache(authState) {
  try {
    const cache = {
      isLoggedIn: authState.isLoggedIn,
      isAdmin: authState.isAdmin,
      userId: authState.userId,
      timestamp: Date.now()
    };
    localStorage.setItem('eventhive_auth_cache', JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to update auth cache:', e.message);
  }
};

// ===== GET CACHED AUTH STATE =====
// Returns cached auth state for fast UI (may be stale)
// Use getAuthState() for authoritative state
window.getCachedAuthState = function getCachedAuthState() {
  try {
    const cached = localStorage.getItem('eventhive_auth_cache');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
};

// ===== CLEAR AUTH STATE =====
// Clears all auth-related caches
window.clearAuthState = function clearAuthState() {
  try {
    localStorage.removeItem('eventhive_auth_cache');
    localStorage.removeItem('eventhive_profile_cache');
    localStorage.removeItem('eventhive_last_authenticated_user_id');
    localStorage.removeItem('eventhive_just_signed_up');
    localStorage.removeItem('eventhive_just_signed_up_email');

    // Clear Supabase tokens
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn('Error clearing auth state:', e.message);
  }
};

console.log('Auth utilities loaded');
