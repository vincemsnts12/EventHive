// Centralized auth utilities
// Provides a safe `getSafeUser()` helper that normalizes missing sessions to null.

// Define only if not already present to avoid clobbering other definitions during incremental deploys
if (typeof getSafeUser === 'undefined') {
  window.getSafeUser = async function getSafeUser() {
    // Try to resolve a Supabase client without depending on per-file getSupabaseClient
    let supabase = null;

    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        supabase = supabaseClient;
      } else if (typeof window.getSupabaseClient === 'function') {
        supabase = window.getSupabaseClient();
      } else if (typeof getSupabaseClient === 'function') {
        supabase = getSupabaseClient();
      } else if (typeof initSupabase === 'function') {
        supabase = initSupabase();
      }
    } catch (e) {
      // ignore
      supabase = null;
    }

    if (!supabase) return null;

    try {
      // Use getSession() instead of getUser() - it's cached locally and doesn't make network request
      // getUser() can hang because it validates token with Supabase server
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('Error getting session:', error.message);
        return null;
      }

      // Extract user from session
      const user = data?.session?.user || null;
      return user;
    } catch (err) {
      const msg = (err && err.message) ? err.message : '';
      if (msg.includes('Auth session missing') || (err.name && err.name.includes('AuthSessionMissingError'))) {
        return null;
      }
      console.warn('Error in getSafeUser:', msg);
      return null;
    }
  };
}
