// ===== SECURITY SERVICES FOR EVENTHIVE =====
// This file contains all security-related functions: validation, logging, profanity filtering, session management

// ===== INPUT VALIDATION =====

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {string|false} - Validated username or false if invalid
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;

  const trimmed = username.trim();
  // Username: 3-30 characters, alphanumeric, underscores, hyphens, and dots
  // Dots allowed to support email-style usernames from OAuth (e.g., axel.magallanes)
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(trimmed)) {
    return false;
  }

  return trimmed;
}

// validateFullName function removed - full_name column is no longer used

/**
 * Validate bio text
 * @param {string} bio - Bio text to validate
 * @returns {string|null} - Validated bio or null if empty
 */
function validateBio(bio) {
  if (!bio || typeof bio !== 'string') return null;

  const trimmed = bio.trim();
  // Bio: max 500 characters
  if (trimmed.length > 500) {
    return trimmed.substring(0, 500);
  }

  return trimmed || null;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {string|false} - Validated URL or false if invalid
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') return null; // URLs can be optional

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

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {string|false} - Validated email or false if invalid
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;

  const trimmed = email.trim().toLowerCase();
  // Email regex: basic format check
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

/**
 * Validate event title
 * @param {string} title - Event title to validate
 * @returns {string|false} - Validated title or false if invalid
 */
function validateEventTitle(title) {
  if (!title || typeof title !== 'string') return false;

  const trimmed = title.trim();
  // Title: 3-255 characters
  if (trimmed.length < 3 || trimmed.length > 255) {
    return false;
  }

  return trimmed;
}

/**
 * Validate event description
 * @param {string} description - Event description to validate
 * @returns {string|false} - Validated description or false if invalid
 */
function validateEventDescription(description) {
  if (!description || typeof description !== 'string') return false;

  const trimmed = description.trim();
  // Description: 10-5000 characters
  if (trimmed.length < 10 || trimmed.length > 5000) {
    return false;
  }

  return trimmed;
}

/**
 * Validate event location
 * @param {string} location - Event location to validate
 * @returns {string|false} - Validated location or false if invalid
 */
function validateEventLocation(location) {
  if (!location || typeof location !== 'string') return false;

  const trimmed = location.trim();
  // Location: 3-500 characters
  if (trimmed.length < 3 || trimmed.length > 500) {
    return false;
  }

  return trimmed;
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} - True if valid UUID
 */
function validateUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// `getSafeUser()` is provided centrally in `js/backend/auth-utils.js`

// ===== PASSWORD VALIDATION =====

/**
 * Validate password strength
 * Supabase handles password hashing, but we enforce policy on frontend
 * @param {string} password - Password to validate
 * @returns {Object} - {valid: boolean, errors: string[]}
 */
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

  // Check for common passwords (basic check)
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ===== PROFANITY FILTERING =====

/**
 * List of profanity words (basic list - can be expanded)
 * In production, use a more comprehensive profanity filter library
 */
const PROFANITY_WORDS = [
  // Add your profanity list here
  // This is a basic example - use a proper library in production
];

/**
 * Filter profanity from text
 * @param {string} text - Text to filter
 * @returns {string} - Filtered text with profanity replaced
 */
function filterProfanity(text) {
  if (!text || typeof text !== 'string') return text;

  let filtered = text;

  // Basic profanity filtering (replace with asterisks)
  PROFANITY_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });

  return filtered;
}

/**
 * Check if text contains profanity
 * @param {string} text - Text to check
 * @returns {boolean} - True if profanity detected
 */
function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;

  const filtered = filterProfanity(text);
  return filtered !== text;
}

// ===== LOGGING SYSTEM =====

/**
 * Security event types
 */
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

/**
 * Log security event
 * @param {string} eventType - Type of security event
 * @param {Object} metadata - Additional metadata
 * @param {string} message - Human-readable message
 */
function logSecurityEvent(eventType, metadata = {}, message = '') {
  const logEntry = {
    event: eventType,
    timestamp: new Date().toISOString(),
    metadata: {
      ...metadata,
      userAgent: navigator.userAgent,
      url: window.location.href,
      // Note: IP address cannot be obtained client-side
    },
    message: message
  };

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

/**
 * Send log to backend (Supabase security_logs table)
 * Uses direct fetch API to work for both authenticated and anonymous users
 * @param {Object} logEntry - Log entry to send
 */
async function sendLogToBackend(logEntry) {
  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return; // Supabase not configured
  }

  try {
    // Extract metadata
    const metadata = logEntry.metadata || {};
    const userAgent = metadata.userAgent || navigator.userAgent;

    // Prepare log entry for database
    const dbLogEntry = {
      event_type: logEntry.event,
      metadata: {
        ...metadata,
        userAgent: undefined // Remove as it's stored separately
      },
      message: logEntry.message || '',
      user_id: metadata.userId || null,
      ip_address: null, // Cannot get client-side
      user_agent: userAgent,
      created_at: logEntry.timestamp || new Date().toISOString()
    };

    // Use direct fetch API (works for anonymous users)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await fetch(`${SUPABASE_URL}/rest/v1/security_logs`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(dbLogEntry),
      signal: controller.signal
    });

    clearTimeout(timeout);
  } catch (e) {
    // Silently fail - logging shouldn't break the app
    console.debug('Security log send failed (non-critical):', e.message);
  }
}

/**
 * Get security logs (for admin dashboard)
 * @returns {Array} - Array of log entries
 */
function getSecurityLogs() {
  try {
    return JSON.parse(localStorage.getItem('security_logs') || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Clear security logs
 */
function clearSecurityLogs() {
  localStorage.removeItem('security_logs');
}

// ===== SESSION MANAGEMENT =====

/**
 * Session timeout duration (30 minutes in milliseconds)
 */
const SESSION_TIMEOUT = 30 * 1000; // 30 minutes  60 *

/**
 * Last activity timestamp
 */
let lastActivityTime = Date.now();

/**
 * Session timeout timer
 */
let sessionTimeoutTimer = null;

/**
 * Initialize session management
 */
function initializeSessionManagement() {
  // Reset activity timer on user activity
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

  activityEvents.forEach(event => {
    document.addEventListener(event, updateLastActivity, true);
  });

  // Check session timeout periodically
  checkSessionTimeout();
  setInterval(checkSessionTimeout, 60000); // Check every minute
}

/**
 * Update last activity timestamp
 */
function updateLastActivity() {
  lastActivityTime = Date.now();

  // Clear existing timer
  if (sessionTimeoutTimer) {
    clearTimeout(sessionTimeoutTimer);
  }

  // Set new timer
  sessionTimeoutTimer = setTimeout(() => {
    handleSessionTimeout();
  }, SESSION_TIMEOUT);
}

/**
 * Check if session has timed out
 */
async function checkSessionTimeout() {
  const timeSinceLastActivity = Date.now() - lastActivityTime;

  if (timeSinceLastActivity >= SESSION_TIMEOUT) {
    // Verify session is still valid before timing out
    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { session }, error } = await supabase.auth.getSession();

        // Only timeout if session is actually expired or invalid
        if (!session || error) {
          handleSessionTimeout();
        } else {
          // Session is still valid, reset activity time
          lastActivityTime = Date.now();
        }
      }
    } else {
      // If we can't verify, assume timeout
      handleSessionTimeout();
    }
  }
}

/**
 * Handle session timeout
 */
async function handleSessionTimeout() {
  // Prevent multiple timeout handlers from running
  if (window.__EH_SESSION_TIMEOUT_IN_PROGRESS) {
    return;
  }
  window.__EH_SESSION_TIMEOUT_IN_PROGRESS = true;

  try {
    // Log the timeout event first (before clearing anything)
    logSecurityEvent(SECURITY_EVENT_TYPES.SESSION_TIMEOUT, {
      timeoutDuration: SESSION_TIMEOUT
    }, 'Session timed out due to inactivity');

    // Show timeout message FIRST (user sees this immediately)
    alert('Your session has timed out due to inactivity. If you are logged in, please log in again.');

    // Clear all caches
    try {
      localStorage.removeItem('eventhive_auth_cache');
      localStorage.removeItem('eventhive_profile_cache');
      localStorage.removeItem('eventhive_last_authenticated_user_id');
      localStorage.removeItem('eventhive_just_signed_up');
      localStorage.removeItem('eventhive_just_signed_up_email');

      // Clear Supabase session tokens
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Error clearing caches on timeout:', e);
    }

    // Sign out with timeout protection (don't let it hang)
    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          // Use Promise.race to prevent hanging
          await Promise.race([
            supabase.auth.signOut(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('SignOut timeout')), 3000))
          ]);
        } catch (signOutErr) {
          console.warn('SignOut during timeout failed or timed out:', signOutErr.message);
          // Continue with redirect anyway
        }
      }
    }

    // Redirect to homepage using origin for Vercel compatibility
    const redirectUrl = window.location.origin + '/eventhive-homepage.html';
    window.location.replace(redirectUrl);

  } catch (error) {
    console.error('Error during session timeout handling:', error);
    // Force redirect even if something fails
    window.location.replace(window.location.origin + '/eventhive-homepage.html');
  } finally {
    window.__EH_SESSION_TIMEOUT_IN_PROGRESS = false;
  }
}

/**
 * Reset session timeout
 */
function resetSessionTimeout() {
  lastActivityTime = Date.now();
  updateLastActivity();
}

// ===== LOGIN LOCKOUT SYSTEM =====

/**
 * Login lockout constants
 */
const LOGIN_LOCKOUT_MAX_ATTEMPTS = 8;
const LOGIN_LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const FORGOT_PASSWORD_MAX_REQUESTS = 3;
const FORGOT_PASSWORD_WINDOW = 60 * 60 * 1000; // 1 hour

/**
 * Get login attempts from server (security_logs table)
 * @param {string} email - User email
 * @returns {Promise<Object>} - {attempts: number, lockoutUntil: Date|null, locked: boolean}
 */
async function getLoginAttempts(email) {
  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase not configured for lockout check');
    return { attempts: 0, lockoutUntil: null, locked: false };
  }

  const emailLower = email.toLowerCase();
  const fiveMinutesAgo = new Date(Date.now() - LOGIN_LOCKOUT_DURATION).toISOString();

  try {
    // Check for recent ACCOUNT_LOCKED event first
    const lockController = new AbortController();
    const lockTimeout = setTimeout(() => lockController.abort(), 5000);

    const lockResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/security_logs?event_type=eq.ACCOUNT_LOCKED&metadata->>email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${encodeURIComponent(fiveMinutesAgo)}&order=created_at.desc&limit=1`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        signal: lockController.signal
      }
    );
    clearTimeout(lockTimeout);

    if (lockResponse.ok) {
      const lockEvents = await lockResponse.json();
      if (lockEvents.length > 0) {
        // Account is locked - calculate remaining time
        const lockTime = new Date(lockEvents[0].created_at);
        const lockoutUntil = new Date(lockTime.getTime() + LOGIN_LOCKOUT_DURATION);
        const remainingMs = lockoutUntil.getTime() - Date.now();

        if (remainingMs > 0) {
          return {
            attempts: LOGIN_LOCKOUT_MAX_ATTEMPTS,
            lockoutUntil: lockoutUntil,
            locked: true,
            remainingSeconds: Math.ceil(remainingMs / 1000)
          };
        }
      }
    }

    // Count recent failed login attempts (since last lockout or last 5 min)
    const attemptsController = new AbortController();
    const attemptsTimeout = setTimeout(() => attemptsController.abort(), 5000);

    const attemptsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/security_logs?event_type=eq.FAILED_LOGIN&metadata->>email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${encodeURIComponent(fiveMinutesAgo)}&select=id`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        },
        signal: attemptsController.signal
      }
    );
    clearTimeout(attemptsTimeout);

    if (attemptsResponse.ok) {
      // Get count from Content-Range header
      const contentRange = attemptsResponse.headers.get('Content-Range');
      let attempts = 0;
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) attempts = parseInt(match[1], 10);
      } else {
        // Fallback: count the returned items
        const items = await attemptsResponse.json();
        attempts = items.length;
      }

      return {
        attempts: attempts,
        lockoutUntil: null,
        locked: false,
        remainingSeconds: 0
      };
    }

    return { attempts: 0, lockoutUntil: null, locked: false, remainingSeconds: 0 };

  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('Lockout check timed out');
    } else {
      console.error('Error checking login attempts:', e);
    }
    return { attempts: 0, lockoutUntil: null, locked: false, remainingSeconds: 0 };
  }
}

/**
 * Check if login is locked out (server-side)
 * @param {string} email - User email
 * @returns {Promise<Object>} - {locked: boolean, remainingSeconds: number, attempts: number}
 */
async function checkLoginLockout(email) {
  const data = await getLoginAttempts(email);
  return {
    locked: data.locked || false,
    remainingSeconds: data.remainingSeconds || 0,
    attempts: data.attempts || 0
  };
}

/**
 * Record a failed login attempt (server-side)
 * @param {string} email - User email
 * @returns {Promise<Object>} - {locked: boolean, remainingSeconds: number, attemptsLeft: number}
 */
async function recordFailedLogin(email) {
  const emailLower = email.toLowerCase();

  try {
    // First, log the failed attempt
    await logSecurityEvent(SECURITY_EVENT_TYPES.FAILED_LOGIN, {
      email: emailLower
    }, 'Failed login attempt');

    // Get updated count (after recording this attempt)
    const data = await getLoginAttempts(emailLower);
    const attempts = data.attempts;

    // Check if we should lock out (attempt count includes the one we just logged)
    if (attempts >= LOGIN_LOCKOUT_MAX_ATTEMPTS && !data.locked) {
      // Record lockout event
      await logSecurityEvent(SECURITY_EVENT_TYPES.ACCOUNT_LOCKED, {
        email: emailLower,
        attempts: attempts,
        lockoutDuration: LOGIN_LOCKOUT_DURATION / 1000
      }, `Account locked after ${attempts} failed login attempts`);

      return {
        locked: true,
        remainingSeconds: Math.ceil(LOGIN_LOCKOUT_DURATION / 1000),
        attemptsLeft: 0
      };
    }

    const attemptsLeft = LOGIN_LOCKOUT_MAX_ATTEMPTS - attempts;

    return {
      locked: data.locked || false,
      remainingSeconds: data.remainingSeconds || 0,
      attemptsLeft: Math.max(0, attemptsLeft)
    };
  } catch (e) {
    console.error('Error recording failed login:', e);
    return { locked: false, remainingSeconds: 0, attemptsLeft: LOGIN_LOCKOUT_MAX_ATTEMPTS };
  }
}

/**
 * Clear login attempts after successful login (logs successful login event)
 * Note: Server-side lockouts expire automatically after 5 minutes
 * @param {string} email - User email
 */
async function clearLoginAttempts(email) {
  try {
    // Log successful login - this helps in tracking patterns
    await logSecurityEvent(SECURITY_EVENT_TYPES.SUCCESSFUL_LOGIN, {
      email: email.toLowerCase()
    }, 'Successful login - cleared failed attempts');
  } catch (e) {
    console.error('Error logging successful login:', e);
  }
}

/**
 * Format remaining lockout time as MM:SS
 * @param {number} seconds - Seconds remaining
 * @returns {string} - Formatted time string
 */
function formatLockoutTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===== FORGOT PASSWORD RATE LIMITING (SERVER-SIDE) =====

/**
 * Check if forgot password request is allowed (server-side rate limiting)
 * Uses RPC function to query security_logs - cannot be bypassed by clearing localStorage
 * @param {string} email - User email
 * @returns {Promise<Object>} - {allowed: boolean, remainingRequests: number, nextAllowedTime: Date|null}
 */
async function checkForgotPasswordRateLimit(email) {
  const supabase = window.getSupabase ? window.getSupabase() : null;

  if (!supabase) {
    console.warn('Supabase not available for rate limit check');
    return { allowed: true, remainingRequests: FORGOT_PASSWORD_MAX_REQUESTS, nextAllowedTime: null };
  }

  try {
    const { data, error } = await window.withTimeout(
      supabase.rpc('check_forgot_password_rate_limit', { p_email: email.toLowerCase() }),
      10000,
      'forgot password rate limit check'
    );

    if (error) {
      console.warn('Rate limit check error:', error.message);
      // Allow on error to not block legitimate users
      return { allowed: true, remainingRequests: FORGOT_PASSWORD_MAX_REQUESTS, nextAllowedTime: null };
    }

    return {
      allowed: data.allowed === true,
      remainingRequests: data.remaining || 0,
      nextAllowedTime: data.next_allowed_at ? new Date(data.next_allowed_at) : null
    };
  } catch (e) {
    console.error('Error checking forgot password rate limit:', e);
    return { allowed: true, remainingRequests: FORGOT_PASSWORD_MAX_REQUESTS, nextAllowedTime: null };
  }
}

/**
 * Record a forgot password request (server-side)
 * Uses RPC function to insert into security_logs
 * @param {string} email - User email
 * @returns {Promise<boolean>} - Success status
 */
async function recordForgotPasswordRequest(email) {
  const supabase = window.getSupabase ? window.getSupabase() : null;

  if (!supabase) {
    console.warn('Supabase not available for recording request');
    return false;
  }

  try {
    const { data, error } = await window.withTimeout(
      supabase.rpc('record_forgot_password_request', { p_email: email.toLowerCase() }),
      10000,
      'record forgot password request'
    );

    if (error) {
      console.warn('Failed to record forgot password request:', error.message);
      return false;
    }

    return data === true;
  } catch (e) {
    console.error('Error recording forgot password request:', e);
    return false;
  }
}

// ===== MULTI-FACTOR AUTHENTICATION (MFA) =====

/**
 * MFA code storage (temporary, in memory)
 * In production, store in secure backend
 */
const mfaCodes = new Map();

/**
 * Generate random MFA code
 * @returns {string} - 6-digit code
 */
function generateMFACode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send MFA code via email
 * @param {string} email - User email
 * @param {string} code - MFA code
 * @returns {Promise<boolean>} - Success status
 */
async function sendMFACode(email, code) {
  // In production, this would send via email service
  // For now, we'll use Supabase's email service or a third-party service

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
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
    });

    // Log MFA code sent
    logSecurityEvent(SECURITY_EVENT_TYPES.MFA_CODE_SENT, {
      email: email
    }, 'MFA code sent to user');

    // MFA email sending - integrate with email service when ready
    // await supabase.functions.invoke('send-mfa-email', { body: { email, code } });

    return true;
  } catch (error) {
    console.error('Error sending MFA code:', error);
    return false;
  }
}

/**
 * Verify MFA code
 * @param {string} email - User email
 * @param {string} inputCode - Code entered by user
 * @returns {boolean} - True if code is valid
 */
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

/**
 * Clean up expired MFA codes
 */
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

// ===== SECURE EVENT REQUEST PIPELINE (Google Forms) =====

/**
 * Validate event request from Google Forms
 * @param {Object} formData - Form submission data
 * @returns {Object} - {valid: boolean, errors: string[], sanitizedData: Object}
 */
function validateEventRequest(formData) {
  const errors = [];
  const sanitizedData = {};

  // Validate title
  const title = validateEventTitle(formData.title);
  if (!title) {
    errors.push('Invalid event title');
  } else {
    sanitizedData.title = title;
  }

  // Validate description
  const description = validateEventDescription(formData.description);
  if (!description) {
    errors.push('Invalid event description');
  } else {
    // Filter profanity
    sanitizedData.description = filterProfanity(description);
    if (containsProfanity(description)) {
      logSecurityEvent(SECURITY_EVENT_TYPES.PROFANITY_FILTERED, {
        field: 'description'
      }, 'Profanity filtered from event description');
    }
  }

  // Validate location
  const location = validateEventLocation(formData.location);
  if (!location) {
    errors.push('Invalid event location');
  } else {
    sanitizedData.location = location;
  }

  // Validate dates
  if (!formData.startDate || !formData.endDate) {
    errors.push('Start and end dates are required');
  } else {
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      errors.push('Invalid date format');
    } else if (endDate < startDate) {
      errors.push('End date must be after start date');
    } else {
      sanitizedData.startDate = startDate.toISOString();
      sanitizedData.endDate = endDate.toISOString();
    }
  }

  // Validate college code
  const validColleges = ['COS', 'COE', 'CAFA', 'CLA', 'CIE', 'CIT', 'TUP'];
  if (!formData.college || !validColleges.includes(formData.college)) {
    errors.push('Invalid college code');
  } else {
    sanitizedData.college = formData.college;
  }

  // Validate organization (optional but if provided, validate)
  if (formData.organization) {
    const org = formData.organization.trim();
    if (org.length > 255) {
      errors.push('Organization name too long');
    } else {
      sanitizedData.organization = org;
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    sanitizedData: sanitizedData
  };
}

/**
 * Process secure event request from Google Forms
 * @param {Object} formData - Form submission data
 * @returns {Promise<Object>} - {success: boolean, eventId?: string, error?: string}
 */
async function processSecureEventRequest(formData) {
  // Validate input
  const validation = validateEventRequest(formData);

  if (!validation.valid) {
    logSecurityEvent(SECURITY_EVENT_TYPES.INVALID_INPUT, {
      errors: validation.errors
    }, 'Invalid event request from Google Forms');

    return {
      success: false,
      error: validation.errors.join(', ')
    };
  }

  // Log the request
  logSecurityEvent(SECURITY_EVENT_TYPES.EVENT_CREATED, {
    source: 'google_forms',
    title: validation.sanitizedData.title
  }, 'Event request received from Google Forms');

  // Create event in database (via createEvent function)
  if (typeof createEvent === 'function') {
    try {
      const result = await createEvent({
        ...validation.sanitizedData,
        status: 'Pending',
        isFeatured: false,
        likes: 0
      });

      return result;
    } catch (error) {
      logSecurityEvent(SECURITY_EVENT_TYPES.DATABASE_ERROR, {
        error: error.message
      }, 'Error creating event from Google Forms');

      return {
        success: false,
        error: error.message
      };
    }
  }

  return {
    success: false,
    error: 'Event creation function not available'
  };
}

// Initialize session management on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeSessionManagement();
  });
}

