# 🔐 EventHive - Google OAuth & Authentication Deep Dive

## Complete Analysis of Authentication Issues

---

## ISSUE 1: Callback URL Mismatch (CRITICAL)

### The Problem
The current code uses **dynamic redirect URLs**:

```javascript
// eventhive-supabase.template.js, line 47
redirectTo: window.location.origin + window.location.pathname,
```

This means:
- User clicks sign-in on `/eventhive-homepage.html` → redirects to `eventhive-homepage.html`
- User clicks sign-in on `/eventhive-events.html` → redirects to `eventhive-events.html`
- **Supabase expects ONE callback URL configured**

### Why It Breaks
```
Step 1: User on eventhive-events.html clicks "Sign in with Google"
Step 2: redirectTo = https://mysite.com/eventhive-events.html

Step 3: Google OAuth redirect:
   Expected: https://uayvdfmkjuxnfsoavwud.supabase.co/auth/v1/callback
   Actual:   https://mysite.com/eventhive-events.html
   
Step 4: MISMATCH! OAuth fails silently or redirects incorrectly
```

### Solution: Use Single Callback

**Fix the JavaScript:**

```javascript
// eventhive-supabase.template.js, line ~40-65

async function signInWithGoogle() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) {
      alert('Supabase is not configured. Please check your configuration.');
      return;
    }
  }

  try {
    // FIXED: Use consistent redirect URL
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Use origin only (Supabase will handle the callback)
        redirectTo: window.location.origin + '/',
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
```

**Configure in Supabase Dashboard:**

```
1. Go to Supabase Dashboard
2. Settings → URL Configuration
3. Site URL: https://your-domain.com/
4. Redirect URLs:
   - https://your-domain.com/
   - https://your-domain.com/index.html
   - http://localhost:5500/ (for testing)
5. Save
```

**Configure in Google Cloud Console:**

```
1. Go to Google Cloud Console
2. APIs & Services → Credentials
3. Click your OAuth Web Application
4. Authorized redirect URIs:
   - https://uayvdfmkjuxnfsoavwud.supabase.co/auth/v1/callback
   
   (This is the ONLY one you need - Supabase handles everything else)
5. Save
```

---

## ISSUE 2: OAuth Consent Screen Not Verified

### The Problem

Your app is in **"Testing" mode**, which limits sign-ins to invited test users only.

```
Current Status:
- App Status: Testing ❌
- Only test users can sign in ❌
- Can't be used for production ❌
- Even TUP students get blocked if not added ❌
```

### Solution: Add Test Users (Temporary)

For development/testing phase:

```
1. Google Cloud Console → OAuth consent screen
2. User Type: External
3. Go to "Test users" section
4. Add emails:
   - your-email@tup.edu.ph
   - test1@tup.edu.ph
   - test2@tup.edu.ph
   - etc.
5. Save

Now these users can sign in. Others get consent screen.
```

### Solution: Prepare for Production

To make your app production-ready:

```
1. Google Cloud Console → OAuth consent screen
2. App name: EventHive
3. User support email: your-email@tup.edu.ph
4. Developer contact: your-email@tup.edu.ph
5. Complete all required scopes and information
6. Request verification:
   - You'll need:
     - Privacy Policy URL
     - Terms of Service URL
     - Detailed explanation of app purpose
     - Proof that you own the domain
   
7. After approval, change User Type to "Internal"
```

---

## ISSUE 3: Email Domain Restriction Incomplete

### Current Implementation (Problematic)

```javascript
// eventhive-supabase.template.js, line ~104-130
async function handleOAuthCallback() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  if (hashParams.has('access_token')) {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session?.user?.email) {
      const email = session.user.email;
      
      // Email check happens AFTER user is signed in
      if (!isAllowedEmailDomain(email)) {
        await supabaseClient.auth.signOut();
        alert('Only TUP email addresses (@tup.edu.ph) are allowed to sign up.');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      // ... rest of callback handling
    }
  }
}
```

### Problems

1. ❌ User is already signed in before email check
2. ❌ Confusing UX: Sign-in succeeds, then suddenly denied
3. ❌ Session data might remain in browser
4. ❌ Not secure against email spoofing

### Solution: Implement Server-Side Restriction

**Step 1: Add Supabase Hook (Before User is Signed In)**

```sql
-- This runs WHEN user is created, not after
-- Create in Supabase SQL Editor:

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  email_domain TEXT;
BEGIN
  -- Extract domain from email
  email_domain := SUBSTRING(NEW.email FROM POSITION('@' IN NEW.email) + 1);
  
  -- Only allow @tup.edu.ph
  IF email_domain != 'tup.edu.ph' THEN
    -- Raise exception to reject user creation
    RAISE EXCEPTION 'Email domain "%s" is not allowed. Only @tup.edu.ph is permitted.', email_domain;
  END IF;
  
  -- If domain is allowed, create profile
  INSERT INTO public.profiles (id, username, full_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    FALSE
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Improve Client-Side Auth Listener**

```javascript
// eventhive-supabase.template.js - Replace setupAuthStateListener()

function setupAuthStateListener() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    const errorDiv = document.getElementById('authErrorMessage');
    
    if (event === 'SIGNED_IN') {
      const email = session?.user?.email;
      
      // Double-check email domain on client side
      if (!email || !isAllowedEmailDomain(email)) {
        console.warn('Invalid email domain detected:', email);
        await supabaseClient.auth.signOut();
        
        if (errorDiv) {
          errorDiv.innerHTML = '❌ Only TUP email addresses (@tup.edu.ph) are allowed. Your email was not recognized.';
          errorDiv.style.display = 'block';
          errorDiv.style.color = '#d32f2f';
        }
        
        // Hide admin dashboard link
        document.querySelectorAll('a[href*="admin"]').forEach(el => {
          el.style.display = 'none';
        });
        
        return;
      }
      
      console.log('✅ User authenticated:', email);
      
      // Load user profile
      try {
        const profile = await loadUserProfile(session.user.id);
        
        if (profile?.is_admin) {
          // Show admin dashboard link
          document.querySelectorAll('a[href*="admin"]').forEach(el => {
            el.style.display = 'block';
          });
          console.log('✅ Admin access granted');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
      
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
      
      // Hide admin link
      document.querySelectorAll('a[href*="admin"]').forEach(el => {
        el.style.display = 'none';
      });
      
      // Clear error message
      if (errorDiv) errorDiv.style.display = 'none';
    }
  });
}

// Helper: Load user profile
async function loadUserProfile(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
}
```

**Step 3: Add Error Display HTML**

Add this to every HTML file that uses auth:

```html
<!-- Add this near the top of body, after navbar -->
<div id="authErrorMessage" style="display: none; padding: 15px; background-color: #ffebee; color: #d32f2f; border: 1px solid #ef5350; border-radius: 4px; margin: 10px; text-align: center;">
  <!-- Error message appears here -->
</div>
```

---

## ISSUE 4: OAuth Redirect Flow Confusion

### Current Problem

The callback handling is confusing because:

1. OAuth response comes in URL hash: `#access_token=...`
2. Supabase session isn't immediately available
3. Timing issues with `getSession()`
4. Multiple callbacks firing

### Solution: Simplify Callback Handling

```javascript
// eventhive-supabase.template.js - Complete rewrite of callback handling

// ===== HANDLE OAUTH CALLBACK =====
async function handleOAuthCallback() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  try {
    // Check if this is an OAuth callback
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    if (hashParams.has('access_token')) {
      console.log('OAuth callback detected');
      
      // Wait a moment for Supabase to process the token
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        return;
      }
      
      if (!session) {
        console.warn('No session found after OAuth callback');
        return;
      }
      
      const email = session.user?.email;
      console.log('OAuth session established for:', email);
      
      // Verify email domain
      if (!isAllowedEmailDomain(email)) {
        console.warn('Non-TUP email in OAuth callback:', email);
        await supabaseClient.auth.signOut();
        
        // Show error
        const errorDiv = document.getElementById('authErrorMessage');
        if (errorDiv) {
          errorDiv.innerHTML = '❌ Only TUP email addresses (@tup.edu.ph) are allowed.';
          errorDiv.style.display = 'block';
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      // Clean up URL (remove hash with token)
      window.history.replaceState({}, document.title, window.location.pathname);
      
      console.log('✅ OAuth successful and email verified');
    }
    
    // Also clean up any query parameters
    if (window.location.search.includes('code=')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
  } catch (error) {
    console.error('OAuth callback error:', error);
  }
}
```

---

## ISSUE 5: Session Persistence Not Implemented

### Problem

Users are logged out when page refreshes because session isn't restored.

### Solution: Add Session Restoration

```javascript
// eventhive-supabase.template.js - Add this function

async function restoreSessionOnPageLoad() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  try {
    // Try to get existing session from localStorage
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) {
      console.warn('No existing session:', error);
      return null;
    }
    
    if (session) {
      console.log('✅ Session restored for:', session.user.email);
      
      // Verify email domain
      if (!isAllowedEmailDomain(session.user.email)) {
        console.warn('Stored session has invalid email');
        await supabaseClient.auth.signOut();
        return null;
      }
      
      // Load user profile
      await loadUserProfile(session.user.id);
      
      return session;
    }
  } catch (error) {
    console.error('Session restoration failed:', error);
  }
  
  return null;
}

// Updated DOMContentLoaded handler:
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Page loaded, initializing auth...');
  
  if (typeof initSupabase === 'function') {
    initSupabase();
  }
  
  // Step 1: Try to restore existing session
  const existingSession = await restoreSessionOnPageLoad();
  
  // Step 2: Set up real-time auth listener for future changes
  if (typeof setupAuthStateListener === 'function') {
    setupAuthStateListener();
  }
  
  // Step 3: Handle OAuth callback if this is a redirect from Google
  if (typeof handleOAuthCallback === 'function') {
    await handleOAuthCallback();
  }
  
  console.log('Auth initialization complete');
});
```

---

## ISSUE 6: Multiple Sign-In Methods Not Coordinated

### Problem

The app has multiple ways to sign in but they're not coordinated:
- Google OAuth button
- Email/password (not implemented)
- Other providers (not implemented)

### Solution: Unified Sign-In Handler

```javascript
// eventhive-supabase.template.js - Add this function

async function handleSignInError(error) {
  const errorDiv = document.getElementById('authErrorMessage');
  
  if (!errorDiv) return;
  
  let message = 'Sign-in failed. Please try again.';
  
  if (error?.message?.includes('Email not confirmed')) {
    message = '❌ Please confirm your email before signing in.';
  } else if (error?.message?.includes('Invalid login credentials')) {
    message = '❌ Invalid email or password.';
  } else if (error?.message?.includes('User already exists')) {
    message = '❌ This email is already registered.';
  } else if (error?.message?.includes('Email domain')) {
    message = '❌ Only @tup.edu.ph emails are allowed.';
  } else if (error?.message) {
    message = `❌ ${error.message}`;
  }
  
  errorDiv.innerHTML = message;
  errorDiv.style.display = 'block';
  
  // Hide after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

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
        redirectTo: window.location.origin + '/',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Google sign-in error:', error);
      await handleSignInError(error);
    }
  } catch (err) {
    console.error('Unexpected sign-in error:', err);
    await handleSignInError(err);
  }
}
```

---

## TESTING CHECKLIST

Before deploying, test all scenarios:

### Test 1: TUP User Sign-In
```
1. Go to homepage
2. Click "Sign in with Google"
3. Use your-email@tup.edu.ph
4. Should sign in successfully
5. Dashboard link should appear
```

### Test 2: Non-TUP User Sign-In
```
1. Sign out
2. Click "Sign in with Google"
3. Use your-personal-email@gmail.com
4. Should see error message
5. Should be signed out
6. Dashboard link should NOT appear
```

### Test 3: Session Persistence
```
1. Sign in with TUP email
2. Refresh page (Ctrl+R)
3. Should still be signed in
4. Dashboard link should still appear
5. Sign out
6. Refresh page
7. Should be signed out
```

### Test 4: Admin Detection
```
1. Sign in as admin user
2. Should see dashboard link
3. Sign in as non-admin user
4. Should NOT see dashboard link
```

### Test 5: OAuth Callback
```
1. On homepage, click "Sign in with Google"
2. Complete Google login
3. Should redirect to homepage
4. URL should NOT contain access_token hash
5. Should be signed in
```

### Test 6: Error Handling
```
1. Introduce a typo in Supabase URL
2. Try to sign in
3. Should see clear error message
4. Should not crash
```

---

## Troubleshooting OAuth Issues

### Issue: "Invalid Client ID"
```
Fix:
1. Google Cloud Console → APIs & Services → Credentials
2. Copy Web Application Client ID
3. Make sure it's Web Application, not iOS/Android
4. Paste in Supabase Google Provider settings
```

### Issue: "Redirect URI Mismatch"
```
Fix:
1. Google Cloud Console → Edit OAuth
2. Authorized redirect URIs should be:
   - https://uayvdfmkjuxnfsoavwud.supabase.co/auth/v1/callback
3. Exactly as shown - no variations
4. Supabase handles everything else
```

### Issue: "Access blocked - You don't have access to this app"
```
Fix:
1. If app is in Testing mode, you're not a test user
2. Add your email to Test users
3. OR request verification from Google (production mode)
```

### Issue: OAuth works but user isn't created
```
Fix:
1. Check if Supabase trigger is working:
   - SQL Editor: SELECT * FROM profiles LIMIT 1;
2. If no profile created, check trigger function
3. Make sure handle_new_user() trigger exists
```

### Issue: User signs in but is immediately signed out
```
Fix:
1. Email domain restriction is rejecting them
2. Make sure they're using @tup.edu.ph email
3. Check isAllowedEmailDomain() function
```

---

## Production Checklist

Before deploying to production:

- [ ] Google app is verified (not in Testing mode)
- [ ] OAuth callback URL is correctly configured
- [ ] Redirect URI matches exactly in Google Console
- [ ] Email domain restriction is working
- [ ] Admin user is set correctly
- [ ] Error messages display properly
- [ ] Session persists on page refresh
- [ ] Non-TUP users are properly rejected
- [ ] No credentials are hardcoded (using env vars)
- [ ] HTTPS is enabled

---

## Final Notes

✅ **Authentication is complex but critical**  
✅ **Test thoroughly before deploying**  
✅ **Monitor auth logs for errors**  
✅ **Keep OAuth credentials safe**  
✅ **Review Supabase security docs regularly**

