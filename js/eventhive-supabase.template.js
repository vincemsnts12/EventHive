// ===== SUPABASE CONFIGURATION =====
// This file is a template. During build, credentials are injected from environment variables.
// DO NOT commit actual credentials to git!

const SUPABASE_URL = '{{SUPABASE_URL}}'; // Injected from Vercel env: NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = '{{SUPABASE_ANON_KEY}}'; // Injected from Vercel env: NEXT_PUBLIC_SUPABASE_ANON_KEY

// Initialize Supabase client
// Note: You'll need to include the Supabase JS library in your HTML:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

let supabaseClient = null;
let lastAuthenticatedUserId = null; // Track user to show alert only once per sign-in
let authStateListenerInitialized = false; // Flag: auth listener attached only once

// Initialize Supabase (call this after Supabase library is loaded)
function initSupabase() {
  // Reuse a single Supabase client instance when possible to avoid
  // Multiple GoTrueClient instances and undefined behavior.
  if (window.__EH_SUPABASE_CLIENT) {
    supabaseClient = window.__EH_SUPABASE_CLIENT;
    return supabaseClient;
  }

  if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    try { window.__EH_SUPABASE_CLIENT = supabaseClient; } catch (e) { /* ignore */ }
    return supabaseClient;
  } else {
    console.error('Supabase library not loaded. Please include: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    return null;
  }
}

// Get Supabase client (for use in other modules)
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
  }
  return supabaseClient;
}

// ===== EMAIL DOMAIN RESTRICTION =====
// Only allow TUP email addresses (@tup.edu.ph)
function isAllowedEmailDomain(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith('@tup.edu.ph');
}

// ===== GOOGLE OAUTH SIGN IN =====
async function signInWithGoogle() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) {
      console.error('Supabase client initialization failed.');
      alert('Error: Supabase is not configured. Please check your configuration.');
      return;
    }
  }

  try {
    console.log('Initiating Google OAuth sign-in...');
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Use origin-only redirect to reduce state/redirect mismatches
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Google OAuth error:', error.code, error.message);
      let userMessage = 'Error signing in with Google.';
      
      // Provide friendly error messages based on error code
      if (error.message.includes('redirect')) {
        userMessage = 'OAuth configuration issue: redirect URI mismatch. Contact support.';
      } else if (error.message.includes('access_denied') || error.message.includes('blocked')) {
        userMessage = 'Google sign-in was blocked. Please ensure you are using a verified account or check your Google app settings.';
      } else if (error.message.includes('not verified') || error.message.includes('unverified')) {
        userMessage = 'This Google app is not yet verified. Please try with a test account or contact support.';
      } else {
        userMessage = 'Error: ' + error.message;
      }
      
      alert(userMessage);
      return;
    }
    
    console.log('Google OAuth initiated, waiting for callback...');
  } catch (err) {
    console.error('Unexpected error during Google sign-in:', err);
    alert('An unexpected error occurred. Please try again.');
  }
}

// ===== AUTH STATE LISTENER =====
// Monitors authentication state changes and enforces email domain restriction
// IMPORTANT: Only initialize once per app session to avoid duplicate listeners
function setupAuthStateListener() {
  if (authStateListenerInitialized) {
    console.log('Auth state listener already initialized, skipping duplicate setup');
    return;
  }
  
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  authStateListenerInitialized = true;
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user?.email) {
      const email = session.user.email;
      
      console.log('SIGNED_IN event detected for email:', email);
      
      // Enforce email domain restriction - MUST verify before any user-facing changes
      if (!isAllowedEmailDomain(email)) {
        console.warn('Non-TUP email attempted sign-in:', email, '- signing out immediately');
        // Sign out and prevent storage in database
        try {
          await supabaseClient.auth.signOut();
          console.log('Successfully signed out non-TUP user:', email);
        } catch (err) {
          console.error('Error signing out non-TUP user:', err);
        }
        alert('Access Denied: Only TUP email addresses (@tup.edu.ph) are allowed to sign up. Your account has been removed.');
        return;
      }
      
      console.log('User successfully authenticated with TUP email:', email);
      // Show success message to user only on first sign-in, not on every page load
      if (lastAuthenticatedUserId !== session?.user?.id) {
        lastAuthenticatedUserId = session.user.id;
        alert('Welcome! You have been successfully authenticated with ' + email);
      }
      // TODO: Update UI to reflect logged-in state (e.g., show username in dropdown, enable dashboard link)
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
      lastAuthenticatedUserId = null; // Reset so alert shows again on next sign-in
      // TODO: Update UI to reflect logged-out state
    } else if (event === 'TOKEN_REFRESHED') {
      console.log('Session token refreshed');
    } else if (event === 'USER_UPDATED') {
      console.log('User profile updated');
    }
  });
}

// ===== HANDLE OAUTH CALLBACK =====
// Process OAuth callback when page loads using the Supabase helper
// This is called after Google redirects the user back to the app with an auth code
async function handleOAuthCallback() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  try {
    console.log('Processing OAuth callback...');

    // Early check: provider returned an error (e.g. state missing, access_denied)
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = (window.location.hash || '').startsWith('#') ? new URLSearchParams(window.location.hash.slice(1)) : null;
    const oauthError = searchParams.get('error') || (hashParams && hashParams.get('error'));
    const oauthErrorDesc = searchParams.get('error_description') || (hashParams && hashParams.get('error_description'));
    if (oauthError) {
      const safeDescription = oauthErrorDesc ? decodeURIComponent(oauthErrorDesc).replace(/[^\w\s\-.,:;()<>@!?'"/\\]/g, '') : '';
      console.warn('OAuth provider returned error:', oauthError, safeDescription);
      let userMsg = 'Authentication failed. Please try signing in again.';
      if (oauthError === 'invalid_request' && safeDescription.toLowerCase().includes('state')) {
        userMsg = 'Authentication failed: missing or invalid state parameter. Please try signing in again.';
      } else if (oauthError === 'access_denied') {
        userMsg = 'Authentication was denied. Please allow access to continue.';
      }
      if (safeDescription) userMsg += '\n\nDetails: ' + safeDescription;
      alert(userMsg);
      try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) { /* ignore */ }
      return;
    }
    
    // Use Supabase v2 helper to parse the URL and obtain the session
    // This is more reliable than manually parsing the hash/query string
    if (typeof supabaseClient.auth.getSessionFromUrl === 'function') {
      const { data, error } = await supabaseClient.auth.getSessionFromUrl({ store: true });
      if (error) {
        console.warn('OAuth callback parsing error:', error.code, error.message);
        return; // Silent fail - may not be an OAuth callback
      }

      const session = data?.session;
      if (session?.user?.email) {
        const email = session.user.email;
        console.log('OAuth callback: user email detected -', email);
        
        // Enforce email domain restriction
        if (!isAllowedEmailDomain(email)) {
          console.warn('Rejecting non-TUP email from OAuth:', email);
          // Sign out the user immediately - prevents storage in database
          try {
            await supabaseClient.auth.signOut();
            console.log('Non-TUP user signed out, account not stored');
          } catch (err) {
            console.error('Error signing out non-TUP user:', err);
          }
          alert('Access Denied: Only TUP email addresses (@tup.edu.ph) are allowed. Your account has been removed.');
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        console.log('OAuth callback validated for TUP user:', email);
        // Clean up URL after successful OAuth
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else {
      // Fallback: robust manual parsing & safe session set
      // This will parse the URL fragment (hash) for OAuth tokens and
      // attempt to set the session via supabaseClient.auth.setSession()
      // if available. It never logs tokens and immediately clears the URL.
      console.log('getSessionFromUrl not available, using robust fallback parsing');

      const parseHashToObject = (hash) => {
        const out = {};
        if (!hash) return out;
        const raw = hash.startsWith('#') ? hash.slice(1) : hash;
        raw.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          if (!k) return;
          out[k] = v ? decodeURIComponent(v.replace(/\+/g, ' ')) : '';
        });
        return out;
      };

      try {
        const params = parseHashToObject(window.location.hash);
        const accessToken = params.access_token || params.accessToken || null;
        const refreshToken = params.refresh_token || params.refreshToken || null;

        if (accessToken) {
          // Prefer supabaseClient.auth.setSession when available (supabase-js v2)
          if (supabaseClient.auth && typeof supabaseClient.auth.setSession === 'function') {
            try {
              // Do NOT log tokens. setSession will store securely.
              const { data, error } = await supabaseClient.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
              if (error) {
                console.warn('setSession returned an error (fallback):', error.message || error);
              }

              const session = data?.session;
              if (session?.user?.email) {
                const email = session.user.email;
                if (!isAllowedEmailDomain(email)) {
                  console.warn('Rejecting non-TUP email (fallback setSession):', email);
                  try { await supabaseClient.auth.signOut(); } catch (err) { console.error('Error signing out non-TUP user (fallback setSession):', err); }
                  alert('Access Denied: Only TUP email addresses (@tup.edu.ph) are allowed. Your account has been removed.');
                  // Clear URL fragment immediately
                  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                  return;
                }
                // Successful validation
                console.log('OAuth fallback validated for TUP user (setSession):', email);
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                return;
              }
            } catch (err) {
              console.error('Error while calling setSession (fallback):', err);
            }
          }

          // If setSession is not available, attempt to rely on Supabase internal parsing
          // but still enforce domain restriction and clear the URL to avoid token leakage.
          try {
            // Avoid calling any method that would log tokens; try to obtain the current session
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) console.warn('getSession() warning (fallback):', error.message || error);
            const session = data?.session;
            if (session?.user?.email) {
              const email = session.user.email;
              if (!isAllowedEmailDomain(email)) {
                console.warn('Rejecting non-TUP email (fallback getSession):', email);
                try { await supabaseClient.auth.signOut(); } catch (err) { console.error('Error signing out non-TUP user (fallback getSession):', err); }
                alert('Access Denied: Only TUP email addresses (@tup.edu.ph) are allowed. Your account has been removed.');
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                return;
              }
              console.log('OAuth fallback validated for TUP user (getSession):', email);
              window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
              return;
            }
          } catch (err) {
            console.error('Error during fallback getSession parsing:', err);
          }
        }
      } catch (err) {
        console.error('Unexpected error in OAuth fallback parsing:', err);
      }
    }
  } catch (err) {
    console.error('Error handling OAuth callback:', err);
  }

  // Clean up any leftover query parameters
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }
}

// ===== INITIALIZE ON PAGE LOAD =====
// Automatically initialize Supabase when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof supabase !== 'undefined') {
    initSupabase();
    setupAuthStateListener();
    // Handle OAuth callback if present
    await handleOAuthCallback();
  } else {
    // Retry after a short delay if Supabase library hasn't loaded yet
    setTimeout(async () => {
      if (typeof supabase !== 'undefined') {
        initSupabase();
        setupAuthStateListener();
        // Handle OAuth callback if present
        await handleOAuthCallback();
      }
    }, 100);
  }
});

