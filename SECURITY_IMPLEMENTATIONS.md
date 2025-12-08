# EventHive Security Implementations

This document contains all security-related code snippets from the EventHive repository.

---

## Table of Contents

1. [Input Validation](#1-input-validation)
2. [Email Domain Restriction](#2-email-domain-restriction)
3. [Password Validation](#3-password-validation)
4. [Profanity Filtering](#4-profanity-filtering)
5. [Security Logging](#5-security-logging)
6. [Session Management](#6-session-management)
7. [Multi-Factor Authentication](#7-multi-factor-authentication)
8. [Authentication State Listener](#8-authentication-state-listener)
9. [OAuth Callback Security](#9-oauth-callback-security)
10. [Database RLS Policies](#10-database-rls-policies)
11. [Admin Check Function](#11-admin-check-function)
12. [New User Handler (Email Restriction)](#12-new-user-handler)

---

## 1. Input Validation

**File:** `js/backend/security-services.js`

```javascript
// Validate username format
function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  // Username: 3-30 characters, alphanumeric and underscores only
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) {
    return false;
  }
  return trimmed;
}

// Validate full name format
function validateFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') return false;
  const trimmed = fullName.trim();
  // Full name: 2-100 characters, letters, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z\s\-']{2,100}$/.test(trimmed)) {
    return false;
  }
  return trimmed;
}

// Validate bio text
function validateBio(bio) {
  if (!bio || typeof bio !== 'string') return null;
  const trimmed = bio.trim();
  // Bio: max 500 characters
  if (trimmed.length > 500) {
    return trimmed.substring(0, 500);
  }
  return trimmed || null;
}

// Validate URL format
function validateUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  try {
    const urlObj = new URL(trimmed);
    // Only allow http/https protocols
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return false;
    }
    return trimmed;
  } catch (e) {
    // If it's a relative path (starts with /), allow it
    if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
      return trimmed;
    }
    return false;
  }
}

// Validate email format with TUP domain restriction
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return false;
  }
  // Check TUP domain restriction
  if (!trimmed.endsWith('@tup.edu.ph')) {
    return false;
  }
  return trimmed;
}

// Validate UUID format
function validateUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Validate event title
function validateEventTitle(title) {
  if (!title || typeof title !== 'string') return false;
  const trimmed = title.trim();
  // Title: 3-255 characters
  if (trimmed.length < 3 || trimmed.length > 255) {
    return false;
  }
  return trimmed;
}

// Validate event description
function validateEventDescription(description) {
  if (!description || typeof description !== 'string') return false;
  const trimmed = description.trim();
  // Description: 10-5000 characters
  if (trimmed.length < 10 || trimmed.length > 5000) {
    return false;
  }
  return trimmed;
}

// Validate event location
function validateEventLocation(location) {
  if (!location || typeof location !== 'string') return false;
  const trimmed = location.trim();
  // Location: 3-500 characters
  if (trimmed.length < 3 || trimmed.length > 500) {
    return false;
  }
  return trimmed;
}
```

---

## 2. Email Domain Restriction

**File:** `js/eventhive-supabase.template.js`

```javascript
// Only allow TUP email addresses (@tup.edu.ph)
function isAllowedEmailDomain(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith('@tup.edu.ph');
}
```

---

## 3. Password Validation

**File:** `js/backend/security-services.js`

```javascript
function validatePasswordStrength(password) {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common passwords
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}
```

---

## 4. Profanity Filtering

**File:** `js/backend/security-services.js`

```javascript
const PROFANITY_WORDS = [
  // Add your profanity list here
  // This is a basic example - use a proper library in production
];

function filterProfanity(text) {
  if (!text || typeof text !== 'string') return text;
  
  let filtered = text;
  
  PROFANITY_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  
  return filtered;
}

function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  const filtered = filterProfanity(text);
  return filtered !== text;
}
```

---

## 5. Security Logging

**File:** `js/backend/security-services.js`

```javascript
const SECURITY_EVENT_TYPES = {
  FAILED_LOGIN: 'FAILED_LOGIN',
  SUCCESSFUL_LOGIN: 'SUCCESSFUL_LOGIN',
  LOGOUT: 'LOGOUT',
  SESSION_TIMEOUT: 'SESSION_TIMEOUT',
  INVALID_INPUT: 'INVALID_INPUT',
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  PROFANITY_FILTERED: 'PROFANITY_FILTERED',
  COMMENT_CREATED: 'COMMENT_CREATED',
  COMMENT_DELETED: 'COMMENT_DELETED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  EVENT_CREATED: 'EVENT_CREATED',
  EVENT_UPDATED: 'EVENT_UPDATED',
  EVENT_DELETED: 'EVENT_DELETED',
  EVENT_APPROVED: 'EVENT_APPROVED',
  EVENT_REJECTED: 'EVENT_REJECTED',
  MFA_CODE_SENT: 'MFA_CODE_SENT',
  MFA_CODE_VERIFIED: 'MFA_CODE_VERIFIED',
  MFA_CODE_FAILED: 'MFA_CODE_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY'
};

function logSecurityEvent(eventType, metadata = {}, message = '') {
  const logEntry = {
    event: eventType,
    timestamp: new Date().toISOString(),
    metadata: {
      ...metadata,
      userAgent: navigator.userAgent,
      url: window.location.href,
    },
    message: message
  };
  
  // Log to console in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[SECURITY LOG]', logEntry);
  }
  
  // Store in localStorage for client-side tracking (limited storage)
  try {
    const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    logs.push(logEntry);
    
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.shift();
    }
    
    localStorage.setItem('security_logs', JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to store security log:', e);
  }
  
  // Send to backend logging endpoint (if available)
  sendLogToBackend(logEntry);
}

async function sendLogToBackend(logEntry) {
  if (typeof getSupabaseClient === 'function') {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const user = await getSafeUser();
        
        const metadata = logEntry.metadata || {};
        const ipAddress = metadata.ip || null;
        const userAgent = metadata.userAgent || navigator.userAgent;
        
        const dbLogEntry = {
          event_type: logEntry.event,
          metadata: { ...metadata, userAgent: undefined },
          message: logEntry.message || '',
          user_id: user?.id || metadata.userId || null,
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: logEntry.timestamp || new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('security_logs')
          .insert(dbLogEntry);
        
        if (error) {
          // Silently fail in production
        }
      }
    } catch (e) {
      // Silently fail in production
    }
  }
}
```

---

## 6. Session Management

**File:** `js/backend/security-services.js`

```javascript
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

let lastActivityTime = Date.now();
let sessionTimeoutTimer = null;

function initializeSessionManagement() {
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  
  activityEvents.forEach(event => {
    document.addEventListener(event, updateLastActivity, true);
  });
  
  checkSessionTimeout();
  setInterval(checkSessionTimeout, 60000); // Check every minute
}

function updateLastActivity() {
  lastActivityTime = Date.now();
  
  if (sessionTimeoutTimer) {
    clearTimeout(sessionTimeoutTimer);
  }
  
  sessionTimeoutTimer = setTimeout(() => {
    handleSessionTimeout();
  }, SESSION_TIMEOUT);
}

async function checkSessionTimeout() {
  const timeSinceLastActivity = Date.now() - lastActivityTime;
  
  if (timeSinceLastActivity >= SESSION_TIMEOUT) {
    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!session || error) {
          handleSessionTimeout();
        } else {
          lastActivityTime = Date.now();
        }
      }
    } else {
      handleSessionTimeout();
    }
  }
}

async function handleSessionTimeout() {
  if (typeof getSupabaseClient === 'function') {
    const supabase = getSupabaseClient();
    
    if (supabase) {
      const user = await getSafeUser();

      if (user) {
        logSecurityEvent(SECURITY_EVENT_TYPES.SESSION_TIMEOUT, {
          userId: user.id,
          timeoutDuration: SESSION_TIMEOUT
        }, 'Session timed out due to inactivity');
        
        // Clear all caches
        try {
          localStorage.removeItem('eventhive_auth_cache');
          localStorage.removeItem('eventhive_profile_cache');
        } catch (e) {
          console.error('Error clearing caches on timeout:', e);
        }
        
        // Sign out user
        await supabase.auth.signOut();
        
        alert('Your session has timed out due to inactivity. Please log in again.');
        window.location.href = 'eventhive-homepage.html';
      }
    }
  }
}
```

---

## 7. Multi-Factor Authentication

**File:** `js/backend/security-services.js`

```javascript
const mfaCodes = new Map();

function generateMFACode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendMFACode(email, code) {
  if (typeof getSupabaseClient !== 'function') {
    return false;
  }
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }
  
  try {
    // Store code temporarily (5 minutes expiry)
    mfaCodes.set(email, {
      code: code,
      expiresAt: Date.now() + (5 * 60 * 1000)
    });
    
    logSecurityEvent(SECURITY_EVENT_TYPES.MFA_CODE_SENT, {
      email: email
    }, 'MFA code sent to user');
    
    // TODO: Integrate with email service
    console.log(`[MFA CODE for ${email}]: ${code}`);
    
    return true;
  } catch (error) {
    console.error('Error sending MFA code:', error);
    return false;
  }
}

function verifyMFACode(email, inputCode) {
  const stored = mfaCodes.get(email);
  
  if (!stored) {
    logSecurityEvent(SECURITY_EVENT_TYPES.MFA_CODE_FAILED, {
      email: email,
      reason: 'No code found'
    }, 'MFA verification failed: no code found');
    return false;
  }
  
  // Check if code expired
  if (Date.now() > stored.expiresAt) {
    mfaCodes.delete(email);
    logSecurityEvent(SECURITY_EVENT_TYPES.MFA_CODE_FAILED, {
      email: email,
      reason: 'Code expired'
    }, 'MFA verification failed: code expired');
    return false;
  }
  
  // Verify code
  if (stored.code !== inputCode) {
    logSecurityEvent(SECURITY_EVENT_TYPES.MFA_CODE_FAILED, {
      email: email,
      reason: 'Invalid code'
    }, 'MFA verification failed: invalid code');
    return false;
  }
  
  // Code is valid - remove it
  mfaCodes.delete(email);
  
  logSecurityEvent(SECURITY_EVENT_TYPES.MFA_CODE_VERIFIED, {
    email: email
  }, 'MFA code verified successfully');
  
  return true;
}

function cleanupExpiredMFACodes() {
  const now = Date.now();
  for (const [email, data] of mfaCodes.entries()) {
    if (now > data.expiresAt) {
      mfaCodes.delete(email);
    }
  }
}

// Clean up expired codes every minute
setInterval(cleanupExpiredMFACodes, 60000);
```

---

## 8. Authentication State Listener

**File:** `js/eventhive-supabase.template.js`

```javascript
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
  const processedUserIds = new Set();
  
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user?.email) {
      const userId = session?.user?.id;
      const email = session.user.email;
      
      // Prevent duplicate processing
      if (processedUserIds.has(userId)) {
        return;
      }
      processedUserIds.add(userId);
      
      // Enforce email domain restriction
      if (!isAllowedEmailDomain(email)) {
        console.warn('Non-TUP email attempted sign-in:', email);
        try {
          await supabaseClient.auth.signOut();
        } catch (err) {
          console.error('Error signing out non-TUP user:', err);
        }
        alert('Access Denied: Only TUP email addresses (@tup.edu.ph) are allowed.');
        processedUserIds.delete(userId);
        return;
      }
      
      // Check if email is verified
      if (!session.user.email_confirmed_at) {
        try {
          await supabaseClient.auth.signOut();
        } catch (err) {
          console.error('Error signing out unverified user:', err);
        }
        alert('Please verify before logging in.');
        processedUserIds.delete(userId);
        return;
      }
      
      // ... rest of login handling
    } else if (event === 'SIGNED_OUT') {
      lastAuthenticatedUserId = null;
      processedUserIds.clear();
      try {
        localStorage.clear();
      } catch (e) {
        console.error('Error clearing localStorage on sign out:', e);
      }
    }
  });
}
```

---

## 9. OAuth Callback Security

**File:** `js/eventhive-supabase.template.js`

```javascript
async function handleOAuthCallback() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
    if (!supabaseClient) return;
  }

  try {
    isProcessingOAuthCallback = true;

    // Early check: provider returned an error
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = (window.location.hash || '').startsWith('#') 
      ? new URLSearchParams(window.location.hash.slice(1)) : null;
    const oauthError = searchParams.get('error') || (hashParams && hashParams.get('error'));
    const oauthErrorDesc = searchParams.get('error_description') || 
      (hashParams && hashParams.get('error_description'));
    
    if (oauthError) {
      const safeDescription = oauthErrorDesc 
        ? decodeURIComponent(oauthErrorDesc).replace(/[^\w\s\-.,:;()<>@!?'"/\\]/g, '') 
        : '';
      
      let userMsg = 'Authentication failed. Please try signing in again.';
      
      // Check if error is related to database/email domain restriction
      if (safeDescription && (
        safeDescription.toLowerCase().includes('database error') || 
        safeDescription.toLowerCase().includes('tup university') ||
        safeDescription.toLowerCase().includes('email domain')
      )) {
        userMsg = 'Use the email provided by the TUP University';
      }
      
      alert(userMsg);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    // Process session and enforce email domain restriction
    // ... (see full implementation in source file)
    
  } catch (err) {
    console.error('Error handling OAuth callback:', err);
  }

  // Clean up URL after processing
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  setTimeout(() => {
    isProcessingOAuthCallback = false;
  }, 500);
}
```

---

## 10. Database RLS Policies

**File:** `supabase-nuclear-reset.sql`

```sql
-- PERMISSION MATRIX:
-- ┌───────────────────┬────────┬───────────────┬─────────┐
-- │ Action            │ Guest  │ Authenticated │ Admin   │
-- ├───────────────────┼────────┼───────────────┼─────────┤
-- │ View Events       │ ✅     │ ✅            │ ✅      │
-- │ Like/Unlike       │ ❌     │ ✅            │ ✅      │
-- │ Comment           │ ❌     │ ✅            │ ✅      │
-- │ Delete Comment    │ ❌     │ ✅ (own only) │ ✅ (own)│
-- │ Create Event      │ ❌     │ ❌            │ ✅      │
-- │ Update Event      │ ❌     │ ❌            │ ✅      │
-- │ Delete Event      │ ❌     │ ❌            │ ✅      │
-- │ Manage Images     │ ❌     │ ❌            │ ✅      │
-- │ Manage Orgs       │ ❌     │ ❌            │ ✅      │
-- │ View Sec Logs     │ ❌     │ ❌            │ ✅      │
-- └───────────────────┴────────┴───────────────┴─────────┘

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- EVENTS POLICIES
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  USING (is_admin());

-- COMMENTS POLICIES
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- SECURITY_LOGS POLICIES
CREATE POLICY "Admins can view security logs"
  ON security_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "Authenticated users can insert security logs"
  ON security_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

---

## 11. Admin Check Function

**File:** `supabase-nuclear-reset.sql`

```sql
-- This function is SECURITY DEFINER and uses the index for fast lookups
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  admin_status BOOLEAN;
BEGIN
  -- Quick return if not authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Use indexed lookup - this is fast because of idx_profiles_id_is_admin
  SELECT is_admin INTO admin_status
  FROM profiles
  WHERE id = auth.uid();
  
  -- Return false if no profile found or not admin
  RETURN COALESCE(admin_status, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Critical index for fast admin lookups
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;
CREATE INDEX idx_profiles_id_is_admin ON profiles(id, is_admin);

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;
```

---

## 12. New User Handler

**File:** `supabase-nuclear-reset.sql`

```sql
-- Auto-creates profile when user signs up
-- Enforces TUP email domain restriction at database level
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Enforce email domain restriction: Only allow @tup.edu.ph emails
  IF NEW.email IS NULL OR LOWER(NEW.email) NOT LIKE '%@tup.edu.ph' THEN
    RAISE EXCEPTION 'Email domain not allowed. Only @tup.edu.ph email addresses are permitted.';
  END IF;
  
  INSERT INTO public.profiles (id, email, username, full_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Summary

| Security Feature | Location | Description |
|-----------------|----------|-------------|
| Input Validation | `security-services.js` | Validates usernames, emails, URLs, event data |
| Email Restriction | Client + Database | `@tup.edu.ph` domain only |
| Password Policy | `security-services.js` | Enforces complexity requirements |
| Profanity Filter | `security-services.js` | Filters inappropriate content |
| Security Logging | Client + Supabase | Logs security events to `security_logs` table |
| Session Timeout | `security-services.js` | Auto-logout after 30 min inactivity |
| MFA | `security-services.js` | 6-digit code verification (TODO: email integration) |
| RLS Policies | Supabase | Row-level security for all tables |
| Admin Function | Supabase | Fast indexed `is_admin()` check |

