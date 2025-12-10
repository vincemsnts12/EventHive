# EventHive Security Analysis Report

## Executive Summary

This analysis identifies security vulnerabilities, architectural weaknesses, and logic issues in the EventHive codebase. The application is a **client-side heavy SPA** that relies on Supabase for authentication and database. Many security controls are implemented client-side, making them **bypassable**.

---

## Repository Structure

```
EventHive/
├── 9 HTML Pages (homepage, events, profile, admin, search, etc.)
├── js/
│   ├── 24 Frontend JavaScript files
│   └── backend/
│       ├── auth-utils.js              (auth helper)
│       ├── security-services.js       (validation, logging, lockout)
│       ├── eventhive-supabase-services.js (CRUD operations)
│       ├── eventhive-events-services.js   (event management)
│       └── eventhive-storage-services.js  (file uploads)
├── css/ (9 stylesheets)
└── 12 SQL migration scripts
```

---

## 🔴 CRITICAL: OWASP-Related Vulnerabilities

### 1. **Broken Access Control (OWASP A01:2021)**

| Issue | Location | Risk |
|-------|----------|------|
| **Admin check is client-side** | `eventhive-admin-init.js:31-83` | Attacker can bypass by modifying localStorage `is_admin: true` |
| **Admin cache trusted blindly** | `eventhive-dropdownmenu.js:getCachedAuthState()` | Cache can be manipulated to show admin UI |
| **Profile edit allows any user** | `eventhive-profile-edit-save.js` | Only checks `auth.uid()` client-side |

**Root Cause**: The admin check relies on:
```javascript
const cached = localStorage.getItem('eventhive_auth_cache');
if (cached.isAdmin) { /* show admin features */ }
```

While RLS on Supabase protects the database, the **UI** shows admin options to anyone who sets `isAdmin: true` in localStorage.

**OWASP Mapping**: A01:2021 - Broken Access Control

---

### 2. **Cryptographic Failures (OWASP A02:2021)**

| Issue | Location | Risk |
|-------|----------|------|
| **Tokens stored in localStorage** | `sb-*-auth-token` keys | XSS attack can steal session |
| **Access tokens passed in URLs** | `eventhive-set-password.js:capturedAccessToken` | Tokens in browser history, logs |
| **MFA codes in memory** | `security-services.js:mfaCodes = new Map()` | Client-side MFA is bypassable |

**Root Cause**: Supabase uses localStorage by default. A single XSS vulnerability would expose all tokens.

---

### 3. **Injection (OWASP A03:2021)**

| Issue | Location | Risk |
|-------|----------|------|
| **innerHTML usage** | `eventhive-dropdownmenu.js:applyDropdownState()` | HTML injection possible |
| **Direct DOM insertion** | Multiple files with `innerHTML =` | XSS if user data not sanitized |

**Example**:
```javascript
menuItemsContainer.innerHTML = loggedOutMenuHTML; // Line 282
```

While the current code uses hardcoded HTML, any future dynamic content would be vulnerable.

---

### 4. **Insecure Design (OWASP A04:2021)**

| Issue | Location | Risk |
|-------|----------|------|
| **Client-side rate limiting** | `security-services.js:checkForgotPasswordRateLimit()` | Clear localStorage = bypass |
| **Session timeout client-side** | `security-services.js:handleSessionTimeout()` | Attacker can disable timer |
| **Email validation client-only** | `isAllowedEmailDomain()` | Supabase trigger also validates, but client can bypass UI |

**The Fundamental Problem**: The architecture trusts the client for security decisions. While Supabase RLS provides server-side protection, many security features can be bypassed from DevTools.

---

### 5. **Security Misconfiguration (OWASP A05:2021)**

| Issue | Location | Risk |
|-------|----------|------|
| **RLS allows anonymous security log inserts** | `supabase-fix-login-lockout.sql` | Attacker can flood with fake FAILED_LOGIN events |
| **Anon key exposed in client** | `window.__EH_SUPABASE_ANON_KEY` | Normal for Supabase, but enables direct API calls |
| **No CSP headers** | `vercel.json` | XSS easier to exploit |

---

### 6. **Identification and Authentication Failures (OWASP A07:2021)**

| Issue | Location | Risk |
|-------|----------|------|
| **Password reset tokens in URL hash** | `eventhive-set-password.js` | Tokens in browser history |
| **No token rotation** | Supabase default | Long-lived tokens if stolen |
| **Clock skew handling** | Console warnings seen | Token validation can fail |

---

## 🟠 HIGH: Logic and Architecture Issues

### 1. **Multiple Auth State Sources (Inconsistency Risk)**

The app retrieves auth state from **4+ different sources**:

```
Source 1: localStorage['eventhive_auth_cache']
Source 2: localStorage['sb-*-auth-token']  
Source 3: supabase.auth.getSession()
Source 4: localStorage['eventhive_last_authenticated_user_id']
```

**Problem**: These can become out of sync, causing:
- User appears logged in but session expired
- Admin status cached but revoked server-side
- Race conditions between cached and fresh state

**Files Affected**:
- `eventhive-dropdownmenu.js` (line 17)
- `eventhive-supabase-services.js` (lines 19-29)
- `eventhive-comments-likes.js` (lines 40-48)
- `eventhive-carousel.js` (lines 269-277)

---

### 2. **Hanging Operations Without Proper Timeouts**

| Operation | File | Issue |
|-----------|------|-------|
| `supabase.auth.signInWithPassword()` | `eventhive-pop-up__log&sign.js` | No timeout wrapper |
| `supabase.auth.getSession()` | Multiple files | Can hang on network issues |
| `supabase.auth.updateUser()` | `eventhive-set-password.js` | Previously caused hangs (fixed with fetch) |

**Pattern Seen**:
```javascript
const { data, error } = await supabase.auth.signInWithPassword({...});
// If Supabase never responds, UI hangs forever
```

**Files with unprotected awaits**:
- `eventhive-pop-up__log&sign.js:278`
- `eventhive-supabase.template.js:166`
- `eventhive-profile-load.js:161`

---

### 3. **Redundant Fallback Chains**

The codebase has excessive fallback logic that can mask errors:

```javascript
// Example from eventhive-comments-likes.js:40-55
currentUserId = localStorage.getItem('eventhive_last_authenticated_user_id');
if (!currentUserId) {
  const supabaseAuthKeys = Object.keys(localStorage).filter(key => 
    key.startsWith('sb-') && key.includes('-auth-token'));
  if (supabaseAuthKeys.length > 0) {
    const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
    if (authData?.user?.id) {
      currentUserId = authData.user.id;
    }
  }
}
```

**Issues**:
1. Multiple sources of truth
2. Silent failures (no logging when fallback used)
3. Hard to debug which source was used
4. Can return stale/incorrect user ID

---

### 4. **Race Conditions in Auth Flow**

```javascript
// eventhive-supabase.template.js:767-785
document.addEventListener('DOMContentLoaded', async () => {
  setTimeout(() => {
    if (!supabase) { /* init first */ }
    if (supabase) {
      setTimeout(() => {
        // Handle callbacks...
      }, 100);
    }
  }, 100);
});
```

**Problem**: Nested `setTimeout` creates race conditions where:
- Supabase may not be initialized yet
- Auth callbacks may fire before handlers attached
- URL hash/code may be cleared before parsing

---

## 🟡 MEDIUM: Performance and Reliability Issues

### 1. **Excessive localStorage Operations**

Found **50+ localStorage.getItem()** calls across the codebase. Each page load may:
- Read auth cache
- Read profile cache
- Read Supabase tokens
- Read security logs
- Read event preferences

**Files with most localStorage usage**:
| File | Count |
|------|-------|
| `eventhive-profile-edit-save.js` | 12 |
| `eventhive-comments-likes.js` | 6 |
| `eventhive-supabase-services.js` | 5 |

---

### 2. **Cache Invalidation Issues**

| Scenario | Problem |
|----------|---------|
| User logs out on another tab | This tab's cache still shows logged in |
| Admin status revoked | Cached `isAdmin: true` persists |
| Profile updated elsewhere | Old avatar/name displayed |

**No cache busting mechanism** exists for cross-tab synchronization.

---

### 3. **Error Handling Masks Failures**

```javascript
// Pattern seen throughout codebase
} catch (e) {
  // Silently fail - logging shouldn't break the app
  console.debug('...');
}
```

While preventing crashes, this makes debugging production issues very difficult.

---

## 🟢 GOOD: Security Measures That Work

1. **Supabase RLS** - Database-level protection exists
2. **TUP Email Restriction** - Server-side trigger enforces domain
3. **Password Strength Validation** - Client + Supabase enforcement
4. **HTTPS enforced** - Vercel provides by default
5. **Server-side lockout** - Recent fix stores in `security_logs` table

---

## Issue Summary Table

| Priority | Category | Issue | Files Affected |
|----------|----------|-------|----------------|
| 🔴 CRITICAL | Auth | Admin check client-side only | admin-init.js, dropdownmenu.js |
| 🔴 CRITICAL | Auth | localStorage tokens (XSS risk) | All auth files |
| 🔴 CRITICAL | Design | Security controls bypassable | security-services.js |
| 🟠 HIGH | Logic | Multiple auth state sources | 10+ files |
| 🟠 HIGH | Logic | No operation timeouts | pop-up__log&sign.js, supabase.template.js |
| 🟠 HIGH | Logic | Race conditions in init | supabase.template.js |
| 🟡 MEDIUM | Perf | Excessive localStorage reads | Most JS files |
| 🟡 MEDIUM | Logic | Redundant fallback chains | comments-likes.js, carousel.js |
| 🟡 MEDIUM | Debug | Silent error swallowing | Multiple catch blocks |

---

## Recommendations (For Future Reference)

1. **Move admin checks to server** - RPC function or API route
2. **Add CSP headers** - Prevent XSS token theft
3. **Implement token refresh** - Shorter-lived access tokens
4. **Centralize auth state** - Single source of truth with broadcast
5. **Add operation timeouts** - `Promise.race()` pattern
6. **Implement storage events** - Cross-tab synchronization
7. **Rate limit at edge** - Vercel Edge Functions
8. **Add request logging** - Server-side audit trail

---

## Conclusion

The application follows a common pattern for Supabase SPAs but has **excessive trust in client-side code**. While Supabase RLS provides database protection, the UI and many security features can be manipulated. The primary OWASP concern is **Broken Access Control (A01)** due to client-side admin checks and localStorage reliance.

The architecture would benefit from:
- Server-side admin verification
- Session storage instead of localStorage (for XSS mitigation)
- Proper timeout handling to prevent hangs
- Single source of truth for auth state

*Generated: 2025-12-10*
