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
      alert('Supabase is not configured. Please check your configuration.');
      return;
    }
  }

  try {
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
      console.error('Error signing in with Google:', error);
      alert('Error signing in with Google: ' + error.message);
      return;
    }
  } catch (err) {
    console.error('Unexpected error:', err);
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
      
      // Enforce email domain restriction
      if (!isAllowedEmailDomain(email)) {
        await supabaseClient.auth.signOut();
        alert('Only TUP email addresses (@tup.edu.ph) are allowed to sign up.');
        return;
      }
      
      console.log('User signed in:', email);
      // TODO: Update UI to reflect logged-in state
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
      // TODO: Update UI to reflect logged-out state
    }
  });
}

// ===== HANDLE OAUTH CALLBACK =====
// Process OAuth callback when page loads with access token in URL
async function handleOAuthCallback() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  // Check if this is an OAuth callback (has hash fragment with access_token)
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  if (hashParams.has('access_token')) {
    // Get the current session to check email
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session?.user?.email) {
      const email = session.user.email;
      
      // Check email domain immediately
      if (!isAllowedEmailDomain(email)) {
        await supabaseClient.auth.signOut();
        alert('Only TUP email addresses (@tup.edu.ph) are allowed to sign up.');
        // Clean up the URL (remove hash and query params)
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      // Clean up the URL after successful OAuth
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
  
  // Also clean up any query parameters that might be left from form submissions
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

