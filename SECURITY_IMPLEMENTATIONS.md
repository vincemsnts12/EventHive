# EventHive Security Implementations

A concise overview of security features implemented in EventHive.

---

## Table of Contents

1. [Input Validation](#1-input-validation)
2. [Email Domain Restriction](#2-email-domain-restriction)
3. [Password Validation](#3-password-validation)
4. [Profanity Filtering](#4-profanity-filtering)
5. [Comment Rate Limiting](#5-comment-rate-limiting)
6. [Security Logging](#6-security-logging)
7. [Session Management](#7-session-management)
8. [Authentication & Auth Cache](#8-authentication--auth-cache)
9. [Database RLS Policies](#9-database-rls-policies)
10. [Admin Access Control](#10-admin-access-control)
11. [Login Lockout System](#11-login-lockout-system)
12. [Password Reset Security](#12-password-reset-security)
13. [Device MFA (Multi-Factor Authentication)](#13-device-mfa-multi-factor-authentication)

---

## 1. Input Validation

**File:** `js/backend/security-services.js`

All user inputs are validated before database operations:

| Function | Rules |
|----------|-------|
| `validateUsername()` | 3-30 chars, alphanumeric + `_.-` |
| `validateEmail()` | Valid format + `@tup.edu.ph` domain |
| `validateBio()` | Max 500 chars, auto-truncates |
| `validateUrl()` | Only `http://` or `https://` protocols |
| `validateEventTitle()` | 3-255 chars |
| `validateEventDescription()` | 10-5000 chars |

```javascript
function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(trimmed)) return false;
  return trimmed;
}
```

---

## 2. Email Domain Restriction

**Enforced at 3 levels:**

1. **Client-side** (`eventhive-pop-up__log&sign.js`)
2. **Auth listener** (`eventhive-supabase.template.js`)
3. **Database trigger** (`handle_new_user()`)

```javascript
// Client-side check
function isAllowedEmailDomain(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith('@tup.edu.ph');
}
```

```sql
-- Database-level enforcement
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NULL OR LOWER(NEW.email) NOT LIKE '%@tup.edu.ph' THEN
    RAISE EXCEPTION 'Only @tup.edu.ph emails are allowed.';
  END IF;
  -- Create profile...
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Password Validation

**File:** `js/backend/security-services.js`

**Requirements:**
- 8-128 characters
- At least 1 lowercase, 1 uppercase, 1 number, 1 special character
- Not a common password (password123, qwerty, etc.)

```javascript
function validatePasswordStrength(password) {
  const errors = [];
  if (password.length < 8) errors.push('Min 8 characters');
  if (!/[a-z]/.test(password)) errors.push('Need lowercase');
  if (!/[A-Z]/.test(password)) errors.push('Need uppercase');
  if (!/[0-9]/.test(password)) errors.push('Need number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('Need special char');
  return { valid: errors.length === 0, errors };
}
```

---

## 4. Profanity Filtering

**File:** `js/eventhive-profanity-filter.js`

### Features:
- **Leet speak normalization** (`@` → `a`, `0` → `o`, `3` → `e`)
- **Filipino + English word lists** with severity levels
- **Visayan/Cebuano support** (puday, yawa, buang)
- **Whitelist** for false positives (class, passport, therapist)
- **Server-side backup** via SQL triggers

### Severity Levels:

| Level | Action |
|-------|--------|
| Severe | Blocked immediately |
| Moderate | Blocked with warning |
| Mild | Confirmation prompt, allows posting |

```javascript
const LEET_MAP = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', 
  '5': 's', '@': 'a', '$': 's', '!': 'i'
};

const FILIPINO_PROFANITY = {
  severe: ['putangina', 'puta', 'tite', 'puke', 'puday', 'dede', ...],
  moderate: ['gago', 'bobo', 'tanga', 'ulol', ...],
  mild: ['epal', 'plastik', 'feeling', ...]
};
```

### Server-Side Enforcement (SQL):

```sql
CREATE OR REPLACE FUNCTION validate_comment_content()
RETURNS TRIGGER AS $$
BEGIN
  SELECT * INTO check_result FROM check_profanity(NEW.content);
  IF check_result.has_profanity AND check_result.p_severity = 'severe' THEN
    RAISE EXCEPTION 'Comment contains inappropriate content.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Comment Rate Limiting

**File:** `js/backend/security-services.js`

Prevents spam by limiting comment submissions.

**Limits:** 5 comments per minute per user

```javascript
const COMMENT_RATE_LIMIT = { maxComments: 5, windowMs: 60000 };

function checkCommentRateLimit(userId) {
  const key = `comment_rate_${userId}`;
  const data = JSON.parse(localStorage.getItem(key) || '{"count":0,"windowStart":0}');
  const now = Date.now();
  
  if (now - data.windowStart > COMMENT_RATE_LIMIT.windowMs) {
    return { allowed: true, remaining: COMMENT_RATE_LIMIT.maxComments };
  }
  
  return {
    allowed: data.count < COMMENT_RATE_LIMIT.maxComments,
    remaining: Math.max(0, COMMENT_RATE_LIMIT.maxComments - data.count)
  };
}
```

---

## 6. Security Logging

**File:** `js/backend/security-services.js`

Logs security events to console (dev) and `security_logs` table (production).

**Event Types:**
- `FAILED_LOGIN`, `SUCCESSFUL_LOGIN`, `LOGOUT`
- `SESSION_TIMEOUT`, `ACCOUNT_LOCKED`
- `PROFANITY_FILTERED`, `COMMENT_RATE_LIMITED`
- `INVALID_INPUT`, `SUSPICIOUS_ACTIVITY`

```javascript
function logSecurityEvent(eventType, metadata = {}, message = '') {
  const logEntry = {
    event: eventType,
    timestamp: new Date().toISOString(),
    metadata: { ...metadata, userAgent: navigator.userAgent }
  };
  // Store locally + send to Supabase security_logs table
}
```

---

## 7. Session Management

**File:** `js/backend/security-services.js`

**Features:**
- 30-minute inactivity timeout
- Activity tracked via mouse, keyboard, scroll events
- Auto-logout with cache clearing

```javascript
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function initializeSessionManagement() {
  ['mousedown', 'keypress', 'scroll', 'click'].forEach(event => {
    document.addEventListener(event, updateLastActivity, true);
  });
  setInterval(checkSessionTimeout, 60000);
}

async function handleSessionTimeout() {
  localStorage.removeItem('eventhive_auth_cache');
  await supabase.auth.signOut();
  alert('Session timed out. Please log in again.');
  window.location.href = 'eventhive-homepage.html';
}
```

---

## 8. Authentication & Auth Cache

**File:** `js/eventhive-dropdownmenu.js`

### Auth Cache Behavior:
- **No time-based expiry** - trusts the session
- Cleared only on logout or `SIGNED_OUT` event
- Stores: `isLoggedIn`, `isAdmin`, `timestamp`

```javascript
function getCachedAuthState() {
  const cached = localStorage.getItem('eventhive_auth_cache');
  if (cached) {
    const parsed = JSON.parse(cached);
    // No expiry check - trust session, cleared on logout
    if (typeof parsed.isLoggedIn !== 'undefined') {
      return parsed;
    }
  }
  return null;
}
```

### Auth State Listener:
- Handles `SIGNED_IN` and `SIGNED_OUT` events
- Enforces TUP email domain on OAuth logins
- Prevents duplicate alert processing

---

## 9. Database RLS Policies

**File:** Various SQL files

All tables have Row Level Security enabled:

| Table | Guest | User | Admin |
|-------|-------|------|-------|
| events | Read | Read | Full CRUD |
| comments | Read | Create/Delete own | Delete any |
| event_likes | - | Create/Delete | Create/Delete |
| profiles | Read | Update own | Update any |
| security_logs | - | Insert | Full access |

```sql
-- Example: Users can only delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 10. Admin Access Control

**Database Function:** `is_admin()`

Fast, indexed lookup for admin status.

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT is_admin INTO admin_status FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(admin_status, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Index for fast lookups
CREATE INDEX idx_profiles_id_is_admin ON profiles(id, is_admin);
```

**Client-Side:**

```javascript
// js/eventhive-admin-init.js
const cachedAuth = window.getCachedAuthState();
if (cachedAuth?.isAdmin) {
  hasAdminAccess = true;  // Fast path
} else {
  hasAdminAccess = await window.checkIsAdmin();  // Server verification
}
if (!hasAdminAccess) {
  window.location.href = 'eventhive-homepage.html';
}
```

---

## 11. Login Lockout System

**File:** `js/backend/security-services.js`

**Rules:**
- 8 failed attempts → 5-minute lockout
- Server-side tracking (cannot bypass by clearing localStorage)
- Countdown timer displayed

```javascript
async function checkLoginLockout(email) {
  // Query security_logs for recent ACCOUNT_LOCKED events
  const { data } = await supabase
    .from('security_logs')
    .select('created_at')
    .eq('event_type', 'ACCOUNT_LOCKED')
    .ilike('metadata->>email', email)
    .gte('created_at', fiveMinutesAgo);
    
  if (data?.length > 0) {
    return { locked: true, remainingSeconds: calculateRemaining(data[0]) };
  }
  return { locked: false };
}
```

---

## 12. Password Reset Security

**Files:** `js/eventhive-set-password.js`, `js/eventhive-profile-edit.js`

**Features:**
- Rate limited: 3 requests per email per hour
- OAuth users can set password for email/password login
- Direct API call with captured tokens (bypasses session issues)

```javascript
// Direct password update with captured token
const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${capturedAccessToken}`,
    'apikey': supabaseKey
  },
  body: JSON.stringify({ password: newPassword })
});
```

---

## 13. Device MFA (Multi-Factor Authentication)

**Files:** 
- `js/eventhive-device-mfa.js` - Core MFA logic
- `js/backend/security-services.js` - API calls
- `email-templates/device-verification.html` - Email template
- `supabase-device-mfa.sql` - Database schema

### Overview

When a user logs in from an unrecognized device or IP address, a 6-digit verification code is sent to their email. The user must enter this code before completing authentication.

### Key Components

| Component | Purpose |
|-----------|---------|
| Device Fingerprinting | Generates unique device ID using browser data |
| IP Detection | Tracks user's IP via external API |
| Email Verification | Sends 6-digit code with 10-minute expiry |
| Trust Device | Optional 7-day trust period to skip MFA |

### Device Fingerprint Generation

```javascript
async function generateDeviceFingerprint() {
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0
  ];
  
  const data = components.join('|');
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### MFA Flow

```
1. User logs in with email/password
2. System checks trusted_devices table
3. If device/IP not trusted → Request MFA code
4. Email sent with 6-digit code (10 min expiry)
5. User enters code in inline modal
6. Code verified → Login completes
7. Optional: Device trusted for 7 days
```

### Database Schema

```sql
-- Stores active MFA verification codes
CREATE TABLE device_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stores trusted devices (skip MFA)
CREATE TABLE trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  device_fingerprint TEXT NOT NULL,
  ip_address INET,
  trusted_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Email Verification Code

```javascript
async function sendDeviceVerificationEmail(email, code) {
  // Uses SMTP via Vercel API route
  const response = await fetch('/api/send-mfa-code', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  });
}
```

### Trust Device Feature

When enabled, the device is trusted for 7 days:

```javascript
async function trustCurrentDevice(userId, deviceFingerprint, ipAddress) {
  const trustUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await supabase.from('trusted_devices').upsert({
    user_id: userId,
    device_fingerprint: deviceFingerprint,
    ip_address: ipAddress,
    trusted_until: trustUntil
  });
}
```

### UI Integration

The MFA form appears inline within the existing login modal, using the same styling:

- Uses `.auth-modal__input` for code input
- Uses `.auth-modal__submit` for verify button
- Red accent color (`#B81E20`) matches auth modal
- Close button allows cancellation

---

## Summary Table

| Feature | Location | Description |
|---------|----------|-------------|
| Input Validation | `security-services.js` | Sanitizes all user inputs |
| Email Restriction | Client + DB | `@tup.edu.ph` only |
| Password Policy | `security-services.js` | 8+ chars, mixed case, special |
| Profanity Filter | `eventhive-profanity-filter.js` | Filipino + English, leet speak |
| Comment Rate Limit | `security-services.js` | 5/minute |
| Session Timeout | `security-services.js` | 30 min inactivity |
| Auth Cache | `eventhive-dropdownmenu.js` | No expiry, session-based |
| RLS Policies | Supabase | Row-level access control |
| Admin Check | `is_admin()` | Indexed DB function |
| Login Lockout | `security-services.js` | 5 min after 8 failures |
| Password Reset | `eventhive-set-password.js` | Rate-limited, token-based |
| **Device MFA** | `eventhive-device-mfa.js` | Email code on new device/IP |

---

*© EventHive Group 2 - TUP Manila*
