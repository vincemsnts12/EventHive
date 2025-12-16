// ===== SUPABASE CONFIGURATION =====
// This file is a template. During build, credentials are injected from environment variables.
// DO NOT commit actual credentials to git!

const SUPABASE_URL = '{{SUPABASE_URL}}'; // Injected from Vercel env: NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = '{{SUPABASE_ANON_KEY}}'; // Injected from Vercel env: NEXT_PUBLIC_SUPABASE_ANON_KEY

// OpenAI API key for AI moderation (optional - set in Vercel env vars)
const OPENAI_API_KEY = '{{OPENAI_API_KEY}}'; // Injected from Vercel env: OPENAI_API_KEY

// Initialize AI moderation if API key is available
if (typeof initAIModeration === 'function' && OPENAI_API_KEY && OPENAI_API_KEY !== '{{OPENAI_API_KEY}}') {
  initAIModeration(OPENAI_API_KEY);
}

// Initialize Supabase client
// Note: You'll need to include the Supabase JS library in your HTML:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

let supabaseClient = null;
// Load last authenticated user ID from localStorage to persist across page navigations
let lastAuthenticatedUserId = localStorage.getItem('eventhive_last_authenticated_user_id') || null;
let authStateListenerInitialized = false; // Flag: auth listener attached only once
let isProcessingOAuthCallback = false; // Flag: skip alert during callback processing

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
    try {
      window.__EH_SUPABASE_CLIENT = supabaseClient;
      // Expose URL and key for creating guest clients
      window.__EH_SUPABASE_URL = SUPABASE_URL;
      window.__EH_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
    } catch (e) { /* ignore */ }
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
  const processedUserIds = new Set(); // Track processed user IDs to prevent duplicates
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    // Handle SIGNED_OUT - reset all flags for fresh login
    if (event === 'SIGNED_OUT') {
      console.log('SIGNED_OUT event detected - resetting auth flags');
      processedUserIds.clear();
      lastAuthenticatedUserId = null;
      isProcessingOAuthCallback = false;
      return;
    }

    if (event === 'SIGNED_IN' && session?.user?.email) {
      const userId = session?.user?.id;
      const email = session.user.email;

      // SKIP all processing on set-password page - let that page handle the session itself
      // This prevents OAuth/signup logic from interfering with password reset
      const isSetPasswordPage = window.location.pathname.includes('set-password');
      if (isSetPasswordPage) {
        console.log('On set-password page - skipping auth listener processing for password reset');
        return;
      }

      // Prevent duplicate processing if SIGNED_IN fires multiple times for the same user
      if (processedUserIds.has(userId)) {
        console.log('SIGNED_IN event already processed for this user, skipping');
        return;
      }
      processedUserIds.add(userId);

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
        processedUserIds.delete(userId); // Remove from processed set on error
        return;
      }

      console.log('User successfully authenticated with TUP email:', email);

      // Check if email is verified (required for all users)
      if (!session.user.email_confirmed_at) {
        console.warn('User email not verified:', email);
        // Sign out unverified user
        try {
          await supabaseClient.auth.signOut();
          console.log('Unverified user signed out:', email);
        } catch (err) {
          console.error('Error signing out unverified user:', err);
        }
        alert('Please verify before logging in. A verification has been sent to your TUP Email.');
        processedUserIds.delete(userId); // Remove from processed set
        return;
      }

      // Only show message if user changed (not just a token refresh)
      const isNewUserLogin = lastAuthenticatedUserId !== userId;

      // ===== DEVICE MFA CHECK =====
      // Check if MFA was just verified (after reload from MFA modal)
      const mfaJustVerified = sessionStorage.getItem('eventhive_mfa_just_verified');
      if (mfaJustVerified) {
        console.log('MFA was just verified, clearing flag and continuing');
        sessionStorage.removeItem('eventhive_mfa_just_verified');
        // Continue with login flow - MFA already passed
      } else if (typeof checkAndHandleMFA === 'function' && isNewUserLogin) {
        // Check if this is a new/untrusted device and require MFA
        const mfaPassed = await checkAndHandleMFA(userId, email);
        if (!mfaPassed) {
          // MFA modal is showing, don't continue with login flow
          // User will be redirected/reloaded after successful MFA verification
          console.log('MFA required, pausing login flow');
          processedUserIds.delete(userId); // Allow reprocessing after MFA
          return;
        }
        console.log('MFA check passed or not required');
      }

      // Check if this is an OAuth login by checking URL or processing flag
      const isOAuthLogin = isProcessingOAuthCallback ||
        window.location.hash.includes('access_token') ||
        window.location.search.includes('code=');

      let isFirstTimeSignup = false;

      // For OAuth logins, check profile creation time directly
      // For email/password logins, check localStorage flags
      if (isOAuthLogin) {
        // Wait a bit for profile to be created (if it's a new signup)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check profile creation time directly
        try {
          const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('created_at')
            .eq('id', userId)
            .single();

          if (!profileError && profile) {
            const profileCreatedAt = new Date(profile.created_at);
            const now = new Date();
            const secondsSinceCreation = (now - profileCreatedAt) / 1000;

            // If profile was created within last 30 seconds, it's likely a new signup
            if (secondsSinceCreation < 30) {
              isFirstTimeSignup = true;
              console.log('New user detected via OAuth (profile check):', secondsSinceCreation, 'seconds old');
            }
          }
        } catch (err) {
          console.warn('Could not check profile creation time:', err);
        }
      } else {
        // For email/password logins, check localStorage flags
        const signupFlag = localStorage.getItem('eventhive_just_signed_up');
        const signupEmailFlag = localStorage.getItem('eventhive_just_signed_up_email');

        isFirstTimeSignup = (signupFlag && signupFlag === userId) ||
          (signupEmailFlag && signupEmailFlag === email);
      }

      console.log('First-time signup check:', { isFirstTimeSignup, isNewUserLogin, isOAuthLogin });

      if (isFirstTimeSignup && isNewUserLogin) {
        // This is a first-time signup - show welcome message
        lastAuthenticatedUserId = userId;
        localStorage.setItem('eventhive_last_authenticated_user_id', userId);

        // For OAuth users (like Google), send them a password reset email
        // so they can set their own password for email/password login
        if (isOAuthLogin) {
          try {
            // Trigger password reset email so user can set their password
            const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin + '/eventhive-set-password.html'
            });

            if (resetError) {
              console.error('Error sending password setup email:', resetError);
              alert('Welcome to EventHive! You have been successfully authenticated with ' + email + '\n\nNote: We could not send a password setup email. You can request one later from the "Forgot Password" option.');
            } else {
              console.log('Password setup email sent to:', email);
              alert('Welcome to EventHive!\n\nYou have been successfully authenticated with ' + email + '\n\nWe have sent a "Set Your Password" email to your TUP email inbox. This allows you to log in with email and password in the future.\n\nIf you prefer, you can always use "Continue with Google" to sign in.');
            }
          } catch (err) {
            console.error('Error in password reset flow:', err);
            alert('Welcome! You have been successfully authenticated with ' + email);
          }
        } else {
          // Regular email/password signup
          alert('Welcome! You have been successfully authenticated with ' + email);
        }

        // Clear both flags so it doesn't show again on next login
        localStorage.removeItem('eventhive_just_signed_up');
        localStorage.removeItem('eventhive_just_signed_up_email');
      } else if (isNewUserLogin && !isFirstTimeSignup) {
        // This is a regular login (not first-time, and different user than last time)
        // Only show message if it's actually a new login (not just a page navigation)
        // Check if this is a page navigation by seeing if we have a stored user ID
        const storedUserId = localStorage.getItem('eventhive_last_authenticated_user_id');
        if (!storedUserId || storedUserId !== userId) {
          // This is actually a new login (different user or first login after sign out)
          lastAuthenticatedUserId = userId;
          localStorage.setItem('eventhive_last_authenticated_user_id', userId);

          // ONLY show alert for OAuth logins here
          // Email/password logins already show alert in eventhive-pop-up__log&sign.js
          if (isOAuthLogin) {
            alert('Log in successful!');
          }
        } else {
          // Same user, just navigating between pages - don't show message
          lastAuthenticatedUserId = userId;
        }
      } else {
        // Same user, just updating - don't show message
        lastAuthenticatedUserId = userId;
        localStorage.setItem('eventhive_last_authenticated_user_id', userId);
      }

      // Immediately cache auth and admin status on login (5-minute timer starts here)
      // This ensures create/update/delete operations can use cached status without database checks
      if (typeof updateDropdownAuthState === 'function') {
        // Force a fresh check to populate the cache
        updateDropdownAuthState(true).catch(err => {
          console.error('Error updating auth cache on login:', err);
        });
      }

      // Cache profile data for OAuth logins (same as email/password login does)
      // This ensures avatar and profile info persist across page reloads
      if (isOAuthLogin && typeof getUserProfile === 'function') {
        try {
          const profileResult = await getUserProfile(userId);
          if (profileResult.success && profileResult.profile) {
            // IMPORTANT: Add email from session to profile (profiles table doesn't have email column)
            const profileWithEmail = {
              ...profileResult.profile,
              email: email // email from session.user.email
            };
            const profileCache = {
              timestamp: Date.now(),
              profile: profileWithEmail
            };
            localStorage.setItem('eventhive_profile_cache', JSON.stringify(profileCache));
            console.log('Profile cached after OAuth login (with email)');

            // If profile doesn't have avatar, try to sync from session metadata
            if (!profileResult.profile.avatar_url && session?.user?.user_metadata) {
              const metadata = session.user.user_metadata;
              const sessionAvatar = metadata.avatar_url || metadata.picture;
              if (sessionAvatar) {
                // Update profile in database with avatar from session
                try {
                  await supabaseClient
                    .from('profiles')
                    .update({
                      avatar_url: sessionAvatar,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);

                  // Update local cache too
                  profileCache.profile.avatar_url = sessionAvatar;
                  localStorage.setItem('eventhive_profile_cache', JSON.stringify(profileCache));
                  console.log('Avatar synced from OAuth session to profile');
                } catch (syncErr) {
                  console.warn('Error syncing avatar from OAuth:', syncErr);
                }
              }
            }
          }
        } catch (err) {
          console.warn('Error caching profile after OAuth login:', err);
        }
      }

      // Check for pending profile URL (guest clicked profile before logging in)
      const pendingProfileUrl = sessionStorage.getItem('eventhive_pending_profile_url');
      if (pendingProfileUrl) {
        console.log('Redirecting to pending profile URL:', pendingProfileUrl);
        sessionStorage.removeItem('eventhive_pending_profile_url');
        // Use setTimeout to ensure auth state is fully updated before redirect
        setTimeout(() => {
          window.location.href = pendingProfileUrl;
        }, 100);
        return; // Skip normal UI update, we're redirecting
      }

      // TODO: Update UI to reflect logged-in state (e.g., show username in dropdown, enable dashboard link)
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
      lastAuthenticatedUserId = null; // Reset so alert shows again on next sign-in
      processedUserIds.clear(); // Clear processed users set for next sign-in

      // Clear ALL localStorage items (already cleared by logout handlers, but ensure it's done)
      // Note: The logout button handlers already clear localStorage and show the message,
      // so we just ensure cleanup here without showing duplicate messages
      try {
        localStorage.clear();
      } catch (e) {
        console.error('Error clearing localStorage on sign out:', e);
      }

      // SECURITY: Always redirect to homepage when signed out
      // Skip redirect if already on homepage or if explicit logout just triggered
      const isHomepage = window.location.pathname.includes('homepage') || window.location.pathname === '/';
      if (!isHomepage && !window.__EH_EXPLICIT_LOGOUT_IN_PROGRESS) {
        window.location.replace(window.location.origin + '/eventhive-homepage.html');
      }
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
    isProcessingOAuthCallback = true; // Prevent alert during callback session setup

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
      // Check if error is related to database/email domain restriction
      if (safeDescription && (safeDescription.toLowerCase().includes('database error') ||
        safeDescription.toLowerCase().includes('database error saving new user') ||
        safeDescription.toLowerCase().includes('tup university') ||
        safeDescription.toLowerCase().includes('email domain') ||
        safeDescription.toLowerCase().includes('use the email provided'))) {
        userMsg = 'Use the email provided by the TUP University';
      } else if (safeDescription) {
        userMsg += '\n\nDetails: ' + safeDescription;
      }
      alert(userMsg);
      try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) { /* ignore */ }
      return;
    }

    // Use Supabase v2 helper to parse the URL and obtain the session
    // This is more reliable than manually parsing the hash/query string
    if (typeof supabaseClient.auth.getSessionFromUrl === 'function') {
      const { data, error } = await supabaseClient.auth.getSessionFromUrl({ store: true });
      if (error) {
        // Check if error is due to database/email domain restriction
        const errorMsg = (error.message || '').toLowerCase();
        const errorDetails = (error.details || error.message || '').toLowerCase();
        const fullErrorText = errorMsg + ' ' + errorDetails;

        if (fullErrorText.includes('database error') ||
          fullErrorText.includes('database error saving') ||
          fullErrorText.includes('saving new user') ||
          fullErrorText.includes('tup university') ||
          fullErrorText.includes('use the email provided')) {
          alert('Use the email provided by the TUP University');
        }
        return; // Silent fail - may not be an OAuth callback
      }

      const session = data?.session;
      if (session?.user?.email) {
        const email = session.user.email;
        const userId = session.user.id;
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

        // Check if this is a first-time signup via Google OAuth
        // by checking if the profile was just created (within last 10 seconds)
        try {
          const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('created_at')
            .eq('id', userId)
            .single();

          if (!profileError && profile) {
            const profileCreatedAt = new Date(profile.created_at);
            const now = new Date();
            const secondsSinceCreation = (now - profileCreatedAt) / 1000;

            // If profile was created within last 10 seconds, it's likely a new signup
            if (secondsSinceCreation < 10) {
              localStorage.setItem('eventhive_just_signed_up', userId);
              console.log('New user detected via Google OAuth, welcome message will be shown');
            }
          }
        } catch (err) {
          console.warn('Could not check if user is new via OAuth:', err);
          // Continue anyway - not critical
        }

        console.log('OAuth callback validated for TUP user:', email);
        // Clean up URL after successful OAuth - but preserve uid parameter for profile viewing
        const currentUrl = new URL(window.location.href);
        const uidParam = currentUrl.searchParams.get('uid');
        const cleanPath = uidParam ? `${window.location.pathname}?uid=${uidParam}` : window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
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
                const userId = session.user.id;
                if (!isAllowedEmailDomain(email)) {
                  console.warn('Rejecting non-TUP email (fallback setSession):', email);
                  try { await supabaseClient.auth.signOut(); } catch (err) { console.error('Error signing out non-TUP user (fallback setSession):', err); }
                  alert('Access Denied: Only TUP email addresses (@tup.edu.ph) are allowed. Your account has been removed.');
                  // Clear URL fragment immediately
                  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                  return;
                }
                // Check if this is a first-time signup via Google OAuth (fallback path)
                try {
                  const { data: profile, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select('created_at')
                    .eq('id', userId)
                    .single();

                  if (!profileError && profile) {
                    const profileCreatedAt = new Date(profile.created_at);
                    const now = new Date();
                    const secondsSinceCreation = (now - profileCreatedAt) / 1000;

                    // If profile was created within last 10 seconds, it's likely a new signup
                    if (secondsSinceCreation < 10) {
                      localStorage.setItem('eventhive_just_signed_up', userId);
                      console.log('New user detected via Google OAuth (fallback), welcome message will be shown');
                    }
                  }
                } catch (err) {
                  console.warn('Could not check if user is new via OAuth (fallback):', err);
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
              const userId = session.user.id;
              if (!isAllowedEmailDomain(email)) {
                console.warn('Rejecting non-TUP email (fallback getSession):', email);
                try { await supabaseClient.auth.signOut(); } catch (err) { console.error('Error signing out non-TUP user (fallback getSession):', err); }
                alert('Access Denied: Only TUP email addresses (@tup.edu.ph) are allowed. Your account has been removed.');
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                return;
              }
              // Check if this is a first-time signup via Google OAuth (fallback path)
              try {
                const { data: profile, error: profileError } = await supabaseClient
                  .from('profiles')
                  .select('created_at')
                  .eq('id', userId)
                  .single();

                if (!profileError && profile) {
                  const profileCreatedAt = new Date(profile.created_at);
                  const now = new Date();
                  const secondsSinceCreation = (now - profileCreatedAt) / 1000;

                  // If profile was created within last 10 seconds, it's likely a new signup
                  if (secondsSinceCreation < 10) {
                    localStorage.setItem('eventhive_just_signed_up', userId);
                    console.log('New user detected via Google OAuth (fallback getSession), welcome message will be shown');
                  }
                }
              } catch (err) {
                console.warn('Could not check if user is new via OAuth (fallback getSession):', err);
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

  // Clean up any leftover OAuth query parameters (but preserve uid for profile viewing)
  if (window.location.search) {
    const searchParams = new URLSearchParams(window.location.search);
    const uidParam = searchParams.get('uid');
    // Only clean if there are OAuth-related params (code, error, state, etc.)
    // If only uid param exists, don't clean anything
    const hasOAuthParams = searchParams.has('code') || searchParams.has('error') || searchParams.has('state') || searchParams.has('access_token');
    if (hasOAuthParams) {
      const cleanPath = uidParam ? `${window.location.pathname}?uid=${uidParam}` : window.location.pathname;
      window.history.replaceState({}, document.title, cleanPath + window.location.hash);
    }
  }

  // Delay flag clear to ensure SIGNED_IN event fires while flag is still true
  setTimeout(() => {
    isProcessingOAuthCallback = false;
  }, 500);
}

// ===== HANDLE EMAIL VERIFICATION CALLBACK =====
// Process email verification callback when user clicks verification link
async function handleEmailVerificationCallback() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  try {
    // Check if URL contains email verification tokens
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);

    const type = hashParams.get('type') || searchParams.get('type');
    const token = hashParams.get('token') || searchParams.get('token');
    const tokenHash = hashParams.get('token_hash') || searchParams.get('token_hash');

    // Supabase email verification uses 'type=email' and 'token' or 'token_hash'
    if (type === 'email' && (token || tokenHash)) {
      console.log('Processing email verification callback...');

      // Supabase v2: Use getSessionFromUrl if available, otherwise use verifyOtp
      if (supabaseClient.auth && typeof supabaseClient.auth.getSessionFromUrl === 'function') {
        // getSessionFromUrl automatically handles email verification tokens
        const { data, error } = await supabaseClient.auth.getSessionFromUrl();

        if (error) {
          console.error('Email verification error:', error);
          alert('Email verification failed. Please try again or request a new verification email.');
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        if (data?.session?.user) {
          console.log('Email verified successfully via getSessionFromUrl:', data.session.user.email);
          // User is automatically logged in - SIGNED_IN event will fire
          // Set flag for welcome message if this is first-time signup
          const userId = data.session.user.id;

          // Check if this is a first-time signup
          try {
            const { data: profile, error: profileError } = await supabaseClient
              .from('profiles')
              .select('created_at')
              .eq('id', userId)
              .single();

            if (!profileError && profile) {
              const profileCreatedAt = new Date(profile.created_at);
              const now = new Date();
              const secondsSinceCreation = (now - profileCreatedAt) / 1000;

              // If profile was created within last 5 minutes, it's likely a new signup
              if (secondsSinceCreation < 300) {
                localStorage.setItem('eventhive_just_signed_up', userId);
                console.log('New user verified via email, welcome message will be shown');
              }
            }
          } catch (err) {
            console.warn('Could not check if user is new:', err);
          }

          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);

          // Redirect to homepage if not already there
          if (window.location.pathname !== '/eventhive-homepage.html' &&
            !window.location.pathname.endsWith('eventhive-homepage.html') &&
            window.location.pathname !== '/' &&
            !window.location.pathname.endsWith('index.html')) {
            window.location.href = 'eventhive-homepage.html';
          }
        }
      } else {
        // Fallback: Use verifyOtp for email verification
        const { data, error } = await supabaseClient.auth.verifyOtp({
          token_hash: tokenHash || token,
          type: 'email'
        });

        if (error) {
          console.error('Email verification error:', error);
          alert('Email verification failed. Please try again or request a new verification email.');
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        if (data?.user) {
          console.log('Email verified successfully via verifyOtp:', data.user.email);
          // User is now verified and logged in automatically
          // The SIGNED_IN event will be fired by Supabase
          const userId = data.user.id;

          // Check if this is a first-time signup
          try {
            const { data: profile, error: profileError } = await supabaseClient
              .from('profiles')
              .select('created_at')
              .eq('id', userId)
              .single();

            if (!profileError && profile) {
              const profileCreatedAt = new Date(profile.created_at);
              const now = new Date();
              const secondsSinceCreation = (now - profileCreatedAt) / 1000;

              if (secondsSinceCreation < 300) {
                localStorage.setItem('eventhive_just_signed_up', userId);
                console.log('New user verified via email, welcome message will be shown');
              }
            }
          } catch (err) {
            console.warn('Could not check if user is new:', err);
          }

          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);

          // Redirect to homepage if not already there
          if (window.location.pathname !== '/eventhive-homepage.html' &&
            !window.location.pathname.endsWith('eventhive-homepage.html') &&
            window.location.pathname !== '/' &&
            !window.location.pathname.endsWith('index.html')) {
            window.location.href = 'eventhive-homepage.html';
          }
        }
      }
    }
  } catch (err) {
    console.error('Error processing email verification callback:', err);
    // Clean up URL even on error
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ===== INITIALIZE ON PAGE LOAD =====
// Automatically initialize Supabase when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  // Check if we're on the set-password page - if so, skip callback handling
  // The set-password page handles tokens itself to avoid interference
  const isSetPasswordPage = window.location.pathname.includes('set-password');

  if (typeof supabase !== 'undefined') {
    initSupabase();
    setupAuthStateListener();

    // Only handle OAuth/email callbacks on other pages
    if (!isSetPasswordPage) {
      // Handle OAuth callback if present
      await handleOAuthCallback();
      // Handle email verification callback if present
      await handleEmailVerificationCallback();
    } else {
      console.log('On set-password page - skipping OAuth callback handling');
    }
  } else {
    // Retry after a short delay if Supabase library hasn't loaded yet
    setTimeout(async () => {
      if (typeof supabase !== 'undefined') {
        initSupabase();
        setupAuthStateListener();

        // Only handle OAuth/email callbacks on other pages  
        if (!isSetPasswordPage) {
          // Handle OAuth callback if present
          await handleOAuthCallback();
          // Handle email verification callback if present
          await handleEmailVerificationCallback();
        } else {
          console.log('On set-password page - skipping OAuth callback handling');
        }
      }
    }, 100);
  }
});

