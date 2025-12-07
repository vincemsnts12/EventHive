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
      } else if (typeof initSupabase === 'function') {
        supabase = initSupabase();
      }
    } catch (e) {
      // ignore
      supabase = null;
    }

    if (!supabase) return null;

    try {
      const res = await supabase.auth.getUser();
      // supabase JS may return either { data: { user } } or throw
      const user = res?.data?.user || null;
      const error = res?.error;
      if (error) return null;
      return user;
    } catch (err) {
      const msg = (err && err.message) ? err.message : '';
      if (msg.includes('Auth session missing') || (err.name && err.name.includes('AuthSessionMissingError'))) {
        return null;
      }
      throw err;
    }
  };
}
