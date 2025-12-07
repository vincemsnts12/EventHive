// ===== SUPABASE CONFIGURATION =====
// This file is a template. During build, credentials are injected from environment variables.
// DO NOT commit actual credentials to git!

const SUPABASE_URL = '{{SUPABASE_URL}}'; // Injected from Vercel env: NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = '{{SUPABASE_ANON_KEY}}'; // Injected from Vercel env: NEXT_PUBLIC_SUPABASE_ANON_KEY

// Initialize Supabase client
// Note: You'll need to include the Supabase JS library in your HTML:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

let supabaseClient = null;

// Initialize Supabase (call this after Supabase library is loaded)
function initSupabase() {
  if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
        redirectTo: window.location.origin + window.location.pathname,
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
function setupAuthStateListener() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

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
      // Show success message to user
      alert('Welcome! You have been successfully authenticated with ' + email);
      // TODO: Update UI to reflect logged-in state (e.g., show username in dropdown, enable dashboard link)
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
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
      // Fallback: minimal parsing as before (keeps backward compatibility)
      console.log('getSessionFromUrl not available, using fallback parsing');
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      if (hashParams.has('access_token')) {
        console.log('Access token found in URL hash');
        const { data: { session } = {}, error } = await supabaseClient.auth.getSession();
        if (error) {
          console.warn('Error obtaining session after OAuth:', error);
        }
        if (session?.user?.email) {
          const email = session.user.email;
          console.log('OAuth fallback: user email -', email);
          if (!isAllowedEmailDomain(email)) {
            console.warn('Rejecting non-TUP email (fallback):', email);
            try {
              await supabaseClient.auth.signOut();
              console.log('Non-TUP user signed out (fallback), account not stored');
            } catch (err) {
              console.error('Error signing out non-TUP user (fallback):', err);
            }
            alert('Access Denied: Only TUP email addresses (@tup.edu.ph) are allowed. Your account has been removed.');
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
          }
          console.log('OAuth fallback validated for TUP user:', email);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
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

