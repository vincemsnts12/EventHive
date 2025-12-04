// ===== SUPABASE CONFIGURATION =====
// TODO: Replace these with your actual Supabase project credentials
// Get these from: https://app.supabase.com/project/_/settings/api

const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Your anon/public key

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

// Check if email domain is allowed (tup.edu.ph)
function isAllowedEmailDomain(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith('@tup.edu.ph');
}

// Google OAuth Sign In with email domain restriction
async function signInWithGoogle() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) {
      alert('Supabase is not configured. Please check your configuration.');
      return;
    }
  }

  try {
    // Sign in with Google OAuth
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

    // The OAuth flow will redirect the user to Google, then back to your app
    // After redirect, check the email domain in the auth state change listener
  } catch (err) {
    console.error('Unexpected error:', err);
    alert('An unexpected error occurred. Please try again.');
  }
}

// Listen for auth state changes and validate email domain
function setupAuthStateListener() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user?.email) {
      const email = session.user.email;
      
      // Check if email domain is allowed
      if (!isAllowedEmailDomain(email)) {
        // Sign out the user if email domain is not allowed
        await supabaseClient.auth.signOut();
        alert('Only TUP email addresses (@tup.edu.ph) are allowed to sign up.');
        return;
      }

      // Email domain is valid, user is signed in
      console.log('User signed in:', email);
      // TODO: Update UI to reflect logged-in state
      // You can call your existing updateMobileMenuAuthState() and similar functions here
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
      // TODO: Update UI to reflect logged-out state
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Wait for Supabase library to load
  if (typeof supabase !== 'undefined') {
    initSupabase();
    setupAuthStateListener();
  } else {
    // Retry after a short delay if library hasn't loaded yet
    setTimeout(() => {
      if (typeof supabase !== 'undefined') {
        initSupabase();
        setupAuthStateListener();
      }
    }, 100);
  }
});

