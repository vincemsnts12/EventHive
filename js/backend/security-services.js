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
  // Username: 3-30 characters, alphanumeric and underscores only
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) {
    return false;
  }
  
  return trimmed;
}

/**
 * Validate full name format
 * @param {string} fullName - Full name to validate
 * @returns {string|false} - Validated name or false if invalid
 */
function validateFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') return false;
  
  const trimmed = fullName.trim();
  // Full name: 2-100 characters, letters, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z\s\-']{2,100}$/.test(trimmed)) {
    return false;
  }
  
  return trimmed;
}

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

/**
 * Send log to backend (Supabase security_logs table)
 * @param {Object} logEntry - Log entry to send
 */
async function sendLogToBackend(logEntry) {
  // Send to Supabase security_logs table if available
  if (typeof getSupabaseClient === 'function') {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        // Get current user if available
        const { data: { user } } = await supabase.auth.getUser();
        
        // Extract IP address and user agent from metadata if available
        const metadata = logEntry.metadata || {};
        const ipAddress = metadata.ip || null;
        const userAgent = metadata.userAgent || logEntry.metadata?.userAgent || navigator.userAgent;
        
        // Prepare log entry for database
        const dbLogEntry = {
          event_type: logEntry.event,
          metadata: {
            ...metadata,
            // Remove userAgent from metadata as it's stored separately
            userAgent: undefined
          },
          message: logEntry.message || '',
          user_id: user?.id || metadata.userId || null,
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: logEntry.timestamp || new Date().toISOString()
        };
        
        // Insert into security_logs table
        const { error } = await supabase
          .from('security_logs')
          .insert(dbLogEntry);
        
        if (error) {
          // Silently fail - logging shouldn't break the app
          // Only log to console in development
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn('Failed to log security event to Supabase:', error);
          }
        }
      }
    } catch (e) {
      // Silently fail - logging shouldn't break the app
      // Only log to console in development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn('Error sending log to backend:', e);
      }
    }
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
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

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
  // Check if Supabase client is available
  if (typeof getSupabaseClient === 'function') {
    const supabase = getSupabaseClient();
    
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      
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
        
        // Show timeout message
        alert('Your session has timed out due to inactivity. Please log in again.');
        
        // Redirect to homepage
        window.location.href = 'eventhive-homepage.html';
      }
    }
  }
}

/**
 * Reset session timeout
 */
function resetSessionTimeout() {
  lastActivityTime = Date.now();
  updateLastActivity();
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
    
    // In production, send email via Supabase or email service
    // For now, log to console (remove in production!)
    console.log(`[MFA CODE for ${email}]: ${code}`);
    
    // TODO: Integrate with email service
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

