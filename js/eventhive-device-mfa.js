/**
 * EventHive Device-Based MFA
 * 
 * Implements device fingerprinting, MFA code verification, and trusted device management.
 * Triggers email verification when users log in from new devices/IPs.
 */

// ============================================================
// GLOBAL MFA STATE FLAG
// This prevents race conditions with other login handlers
// ============================================================
window.__EH_MFA_PENDING = false;
// ============================================================
// DEVICE FINGERPRINTING
// ============================================================

/**
 * Generate a unique device fingerprint based on browser characteristics
 * @returns {string} Base64-encoded fingerprint
 */
function generateDeviceFingerprint() {
    const data = {
        // Screen properties
        screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        // Timezone
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        // Language
        language: navigator.language,
        // Platform
        platform: navigator.platform,
        // Hardware
        cores: navigator.hardwareConcurrency || 'unknown',
        // Touch support
        touchPoints: navigator.maxTouchPoints || 0,
        // WebGL renderer (graphics card identifier)
        webgl: getWebGLRenderer()
    };

    // Create hash-like string
    const fingerprint = btoa(JSON.stringify(data));
    // Return first 32 characters for storage efficiency
    return fingerprint.substring(0, 32);
}

/**
 * Get WebGL renderer info for fingerprinting
 * @returns {string} WebGL renderer or 'unknown'
 */
function getWebGLRenderer() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
            }
        }
    } catch (e) {
        // Ignore errors
    }
    return 'unknown';
}

/**
 * Get device name for display (e.g., "Chrome on Windows")
 * @returns {string} Human-readable device name
 */
function getDeviceName() {
    const ua = navigator.userAgent;
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Detect browser
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return `${browser} on ${os}`;
}

// ============================================================
// MFA STATE MANAGEMENT
// ============================================================

// Store MFA state
let mfaPendingUserId = null;
let mfaPendingEmail = null;
let mfaCountdownInterval = null;
let mfaExpiresAt = null;

// ============================================================
// DEVICE TRUST CHECKING
// ============================================================

/**
 * Check if the current device is trusted for a user
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if device is trusted
 */
async function isDeviceTrusted(userId) {
    if (!userId) return false;

    const fingerprint = generateDeviceFingerprint();

    if (typeof getSupabaseClient !== 'function') {
        console.error('Supabase client not available');
        return false;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
        // Check if device is in trusted_devices and not expired
        const { data, error } = await supabase
            .from('trusted_devices')
            .select('id, trusted_until')
            .eq('user_id', userId)
            .eq('device_fingerprint', fingerprint)
            .gt('trusted_until', new Date().toISOString())
            .maybeSingle();

        if (error) {
            console.error('Error checking device trust:', error);
            return false;
        }

        if (data) {
            // Update last_used_at
            await supabase
                .from('trusted_devices')
                .update({ last_used_at: new Date().toISOString() })
                .eq('id', data.id);

            return true;
        }

        return false;
    } catch (err) {
        console.error('Exception checking device trust:', err);
        return false;
    }
}

// ============================================================
// MFA CODE MANAGEMENT
// ============================================================

/**
 * Generate a 6-digit code
 * @returns {string} 6-digit code
 */
function generateMFACode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Request a new MFA code - generates code, stores in DB, sends email
 * Uses direct fetch for reliability
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function requestDeviceMFACode(userId, email) {
    if (!userId || !email) {
        return { success: false, error: 'User ID and email required' };
    }

    const fingerprint = generateDeviceFingerprint();
    console.log('Request MFA - fingerprint:', fingerprint.substring(0, 10) + '...');
    const code = generateMFACode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Get Supabase config
    const supabaseUrl = window.__EH_SUPABASE_URL;
    const supabaseKey = window.__EH_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase config not available');
        return { success: false, error: 'Configuration error' };
    }

    // Get session token from localStorage (avoid async hang)
    let authToken = supabaseKey;
    try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith('sb-') && key.includes('-auth-token')) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed?.access_token) {
                        authToken = parsed.access_token;
                        break;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Could not get session token from localStorage');
    }

    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };

    try {
        // Delete existing pending codes with timeout
        const deleteController = new AbortController();
        const deleteTimeout = setTimeout(() => deleteController.abort(), 5000);

        await fetch(
            `${supabaseUrl}/rest/v1/mfa_codes?user_id=eq.${userId}&device_fingerprint=eq.${encodeURIComponent(fingerprint)}&verified=eq.false`,
            {
                method: 'DELETE',
                headers,
                signal: deleteController.signal
            }
        ).catch(() => { }); // Ignore delete errors
        clearTimeout(deleteTimeout);

        // Insert new code with timeout
        const insertController = new AbortController();
        const insertTimeout = setTimeout(() => insertController.abort(), 5000);

        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/mfa_codes`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                user_id: userId,
                code: code,
                device_fingerprint: fingerprint,
                expires_at: expiresAt.toISOString(),
                attempts: 0,
                verified: false
            }),
            signal: insertController.signal
        });
        clearTimeout(insertTimeout);

        if (!insertResponse.ok) {
            console.error('Error storing MFA code:', await insertResponse.text());
            return { success: false, error: 'Failed to generate code' };
        }

        // Send email via Vercel API with timeout
        const emailController = new AbortController();
        const emailTimeout = setTimeout(() => emailController.abort(), 10000);

        const emailResponse = await fetch('/api/send-mfa-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code }),
            signal: emailController.signal
        });
        clearTimeout(emailTimeout);

        if (!emailResponse.ok) {
            const errorData = await emailResponse.json().catch(() => ({}));
            console.error('Error sending MFA email:', errorData);
            return { success: false, error: 'Failed to send verification email' };
        }

        // Store pending state
        mfaPendingUserId = userId;
        mfaPendingEmail = email;
        mfaExpiresAt = expiresAt;

        console.log('MFA code sent successfully');
        return { success: true };
    } catch (err) {
        console.error('Exception in requestDeviceMFACode:', err);
        if (err.name === 'AbortError') {
            return { success: false, error: 'Request timed out. Please try again.' };
        }
        return { success: false, error: 'An error occurred' };
    }
}

/**
 * Verify an MFA code using direct fetch
 * @param {string} inputCode - Code entered by user
 * @param {boolean} trustDevice - Whether to trust this device for 7 days
 * @returns {Promise<{success: boolean, error?: string, attemptsLeft?: number}>}
 */
async function verifyDeviceMFACode(inputCode, trustDevice = false) {
    console.log('verifyDeviceMFACode called with code:', inputCode ? inputCode.substring(0, 3) + '***' : 'empty');

    if (!mfaPendingUserId) {
        console.log('No pending user ID');
        return { success: false, error: 'No pending verification' };
    }

    if (!inputCode || !/^\d{6}$/.test(inputCode)) {
        console.log('Invalid code format');
        return { success: false, error: 'Please enter a valid 6-digit code' };
    }

    console.log('Starting verification for user:', mfaPendingUserId);

    const fingerprint = generateDeviceFingerprint();
    console.log('Fingerprint generated');

    // Get Supabase config
    const supabaseUrl = window.__EH_SUPABASE_URL;
    const supabaseKey = window.__EH_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.log('Missing Supabase config');
        return { success: false, error: 'Configuration error' };
    }
    console.log('Supabase config found');

    // Get session token from localStorage (avoid async hang)
    let authToken = supabaseKey;
    try {
        // Try to get token from localStorage (Supabase stores it there)
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith('sb-') && key.includes('-auth-token')) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed?.access_token) {
                        authToken = parsed.access_token;
                        console.log('Found auth token in localStorage');
                        break;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Could not get session token from localStorage:', e);
    }
    console.log('Auth token ready');

    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
    };

    try {
        // Fetch pending code with timeout
        const fetchController = new AbortController();
        const fetchTimeout = setTimeout(() => fetchController.abort(), 5000);

        const now = new Date().toISOString();
        console.log('Verify parameters:', {
            userId: mfaPendingUserId,
            fingerprint: fingerprint.substring(0, 10) + '...',
            now: now
        });

        const fetchUrl = `${supabaseUrl}/rest/v1/mfa_codes?user_id=eq.${mfaPendingUserId}&device_fingerprint=eq.${encodeURIComponent(fingerprint)}&verified=eq.false&expires_at=gt.${now}&order=created_at.desc&limit=1`;
        console.log('Fetching MFA code...');

        const fetchResponse = await fetch(fetchUrl, {
            method: 'GET',
            headers: { ...headers, 'Prefer': 'return=representation' },
            signal: fetchController.signal
        });
        clearTimeout(fetchTimeout);

        console.log('Fetch response status:', fetchResponse.status);

        if (!fetchResponse.ok) {
            console.error('Error fetching MFA code:', await fetchResponse.text());
            return { success: false, error: 'Verification failed' };
        }

        const records = await fetchResponse.json();
        console.log('MFA records found:', records.length, records);
        const codeRecord = records[0];

        if (!codeRecord) {
            console.log('No code record found - fingerprint or timing mismatch');
            return { success: false, error: 'Code expired or not found. Please request a new code.' };
        }

        // Check max attempts
        if (codeRecord.attempts >= 5) {
            return { success: false, error: 'Too many failed attempts. Please request a new code.' };
        }

        // Check code
        if (codeRecord.code !== inputCode) {
            // Increment attempts with timeout
            const updateController = new AbortController();
            const updateTimeout = setTimeout(() => updateController.abort(), 5000);

            await fetch(`${supabaseUrl}/rest/v1/mfa_codes?id=eq.${codeRecord.id}`, {
                method: 'PATCH',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ attempts: codeRecord.attempts + 1 }),
                signal: updateController.signal
            }).catch(() => { });
            clearTimeout(updateTimeout);

            const attemptsLeft = 4 - codeRecord.attempts;
            return {
                success: false,
                error: `Invalid code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
                attemptsLeft
            };
        }

        // Code is correct! Mark as verified with timeout
        const verifyController = new AbortController();
        const verifyTimeout = setTimeout(() => verifyController.abort(), 5000);

        await fetch(`${supabaseUrl}/rest/v1/mfa_codes?id=eq.${codeRecord.id}`, {
            method: 'PATCH',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ verified: true }),
            signal: verifyController.signal
        });
        clearTimeout(verifyTimeout);

        // Trust device if requested
        if (trustDevice) {
            const trustUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            const trustController = new AbortController();
            const trustTimeout = setTimeout(() => trustController.abort(), 5000);

            await fetch(`${supabaseUrl}/rest/v1/trusted_devices`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
                body: JSON.stringify({
                    user_id: mfaPendingUserId,
                    device_fingerprint: fingerprint,
                    device_name: getDeviceName(),
                    user_agent: navigator.userAgent,
                    trusted_until: trustUntil.toISOString()
                }),
                signal: trustController.signal
            }).catch(() => { });
            clearTimeout(trustTimeout);
        }

        // Clear pending state
        mfaPendingUserId = null;
        mfaPendingEmail = null;
        mfaExpiresAt = null;

        console.log('MFA verification successful');
        return { success: true };
    } catch (err) {
        console.error('Exception in verifyDeviceMFACode:', err);
        if (err.name === 'AbortError') {
            return { success: false, error: 'Request timed out. Please try again.' };
        }
        return { success: false, error: 'Verification failed' };
    }
}

// ============================================================
// NOTE: Old standalone MFA modal was removed.
// MFA is now handled inline within the login modal.
// ============================================================
/**
 * Create and inject the MFA modal into the page
 */
function createMFAModal() {
    // Check if modal already exists
    if (document.getElementById('mfaModal')) return;

    const modalHTML = `
    <div id="mfaModal" class="mfa-modal" style="display: none;">
      <div class="mfa-overlay"></div>
      <div class="mfa-content">
        <div class="mfa-header">
          <span class="mfa-icon">🔐</span>
          <h2>Verify Your Device</h2>
        </div>
        
        <p class="mfa-description">
          We noticed you're logging in from a new device. A 6-digit verification code has been sent to your email.
        </p>
        
        <div class="mfa-code-container">
          <input type="text" id="mfaCodeInput" class="mfa-code-input" 
                 maxlength="6" placeholder="000000" autocomplete="one-time-code"
                 inputmode="numeric" pattern="[0-9]*">
        </div>
        
        <div class="mfa-trust-container">
          <label class="mfa-trust-label">
            <input type="checkbox" id="trustDeviceCheckbox">
            <span>Trust this device for 7 days</span>
          </label>
        </div>
        
        <button id="verifyMFABtn" class="mfa-verify-btn">Verify</button>
        
        <p id="mfaError" class="mfa-error" style="display: none;"></p>
        
        <div class="mfa-footer">
          <p id="mfaTimer" class="mfa-timer">Code expires in: <span id="mfaCountdown">10:00</span></p>
          <button id="resendMFABtn" class="mfa-resend-btn">Resend Code</button>
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Attach event listeners
    setupMFAModalListeners();
}

/**
 * Set up event listeners for the MFA modal
 */
function setupMFAModalListeners() {
    const modal = document.getElementById('mfaModal');
    const codeInput = document.getElementById('mfaCodeInput');
    const verifyBtn = document.getElementById('verifyMFABtn');
    const resendBtn = document.getElementById('resendMFABtn');
    const errorEl = document.getElementById('mfaError');

    if (!modal || !codeInput || !verifyBtn || !resendBtn) return;

    // Auto-focus and format input
    codeInput.addEventListener('input', (e) => {
        // Only allow digits
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
        // Hide error on input
        errorEl.style.display = 'none';
    });

    // Submit on Enter
    codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            verifyBtn.click();
        }
    });

    // Verify button
    verifyBtn.addEventListener('click', async () => {
        console.log('Verify button clicked');
        const code = codeInput.value.trim();
        const trustDevice = document.getElementById('trustDeviceCheckbox').checked;

        console.log('Code entered:', code ? code.length + ' digits' : 'empty');

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
        errorEl.style.display = 'none';

        console.log('Calling verifyDeviceMFACode...');
        const result = await verifyDeviceMFACode(code, trustDevice);
        console.log('verifyDeviceMFACode returned:', result);

        if (result.success) {
            console.log('MFA verification successful, updating UI...');

            // Set flag to indicate MFA was completed
            sessionStorage.setItem('eventhive_mfa_just_verified', 'true');

            // Hide modal first
            hideMFAModal();

            // Show success message
            alert('Device verified successfully!');

            // Force a full page reload to reinitialize auth state
            // The flag above tells the auth flow that MFA is done
            window.location.reload();
        } else {
            errorEl.textContent = result.error || 'Verification failed';
            errorEl.style.display = 'block';
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify';
        }
    });

    // Resend button
    resendBtn.addEventListener('click', async () => {
        if (!mfaPendingUserId || !mfaPendingEmail) return;

        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';
        errorEl.style.display = 'none';

        const result = await requestDeviceMFACode(mfaPendingUserId, mfaPendingEmail);

        if (result.success) {
            // Reset countdown
            startMFACountdown();
            codeInput.value = '';
            codeInput.focus();
        } else {
            errorEl.textContent = result.error || 'Failed to resend code';
            errorEl.style.display = 'block';
        }

        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Code';
    });
}

/**
 * Show the MFA modal
 */
function showMFAModal() {
    createMFAModal();

    const modal = document.getElementById('mfaModal');
    const codeInput = document.getElementById('mfaCodeInput');

    if (modal) {
        modal.style.display = 'flex';
        if (codeInput) {
            codeInput.value = '';
            codeInput.focus();
        }
        startMFACountdown();
    }
}

/**
 * Hide the MFA modal
 */
function hideMFAModal() {
    const modal = document.getElementById('mfaModal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Clear countdown
    if (mfaCountdownInterval) {
        clearInterval(mfaCountdownInterval);
        mfaCountdownInterval = null;
    }
}

/**
 * Start the countdown timer in the modal
 */
function startMFACountdown() {
    if (mfaCountdownInterval) {
        clearInterval(mfaCountdownInterval);
    }

    const countdownEl = document.getElementById('mfaCountdown');
    if (!countdownEl || !mfaExpiresAt) return;

    mfaCountdownInterval = setInterval(() => {
        const now = Date.now();
        const remaining = mfaExpiresAt.getTime() - now;

        if (remaining <= 0) {
            countdownEl.textContent = 'Expired';
            clearInterval(mfaCountdownInterval);
            return;
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// ============================================================
// MAIN MFA CHECK FUNCTION
// ============================================================

/**
 * Check if MFA is required for this login and handle it
 * Call this after successful authentication
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise<boolean>} True if MFA passed or not needed, false if blocked
 */
async function checkAndHandleMFA(userId, email) {
    if (!userId || !email) {
        console.error('checkAndHandleMFA: userId and email required');
        return true; // Let through if no info
    }

    // Check if device is trusted
    const trusted = await isDeviceTrusted(userId);

    if (trusted) {
        console.log('Device is trusted, MFA not required');
        return true;
    }

    console.log('New device detected, MFA required');

    // SET GLOBAL FLAG FIRST - blocks other login handlers
    window.__EH_MFA_PENDING = true;
    console.log('MFA pending flag set to TRUE');

    // Request MFA code
    const result = await requestDeviceMFACode(userId, email);

    if (!result.success) {
        console.error('Failed to request MFA code:', result.error);
        window.__EH_MFA_PENDING = false; // Clear flag on failure
        alert('Failed to send verification email. Please try again.');
        return false;
    }

    // Show MFA modal
    showMFAModal();

    // Return false to indicate MFA is pending
    return false;
}

// ============================================================
// INLINE MFA FOR LOGIN MODAL
// ============================================================

/**
 * Show MFA verification inline within the login modal
 * Returns a Promise that resolves when MFA passes
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @param {HTMLElement} loginModal - The login modal element to replace content in
 * @returns {Promise<{success: boolean}>}
 */
async function showInlineMFA(userId, email, loginModal) {
    return new Promise(async (resolve) => {
        console.log('showInlineMFA: Starting inline MFA for', email);

        // Store reference for resolving
        window.__EH_MFA_RESOLVE = resolve;
        window.__EH_MFA_MODAL_REF = loginModal;

        // Store pending MFA state
        mfaPendingUserId = userId;
        mfaPendingEmail = email;

        // Request MFA code
        const result = await requestDeviceMFACode(userId, email);
        if (!result.success) {
            console.error('Failed to request MFA code:', result.error);
            alert('Failed to send verification email. Please try again.');
            resolve({ success: false });
            return;
        }

        // Get the modal content container - use loginModal directly
        // (Previous approach tried .login-form, .modal-content, form but may not have matched)
        const modalContent = loginModal;

        // Store original content to restore if cancelled
        const originalContent = modalContent.innerHTML;
        window.__EH_ORIGINAL_MODAL_CONTENT = originalContent;

        // Replace with MFA form - Matches auth modal design
        modalContent.innerHTML = `
            <div class="auth-modal-container" style="border: none; box-shadow: none; padding: 30px 25px;">
                <!-- Header matching auth modal -->
                <div class="auth-modal-header">
                    <h2 class="auth-modal__title">Verify Your Device</h2>
                    <button type="button" class="auth-modal__closebtn" id="inlineCancelMFABtn">&times;</button>
                </div>
                
                <!-- Description -->
                <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; text-align: center; line-height: 1.5;">
                    We noticed you're signing in from a new device.<br>
                    A 6-digit code has been sent to your email.
                </p>
                
                <!-- MFA Form -->
                <div class="auth-modal-form">
                    <label class="auth-modal__label" for="inlineMfaCodeInput">Verification Code</label>
                    <input type="text" id="inlineMfaCodeInput" 
                        class="auth-modal__input"
                        placeholder="Enter 6-digit code"
                        maxlength="6" 
                        autocomplete="one-time-code"
                        inputmode="numeric"
                        style="font-size: 20px; letter-spacing: 6px; text-align: center; font-family: monospace;">
                    
                    <div id="inlineMfaError" style="color: #B81E20; margin: 5px 0; font-size: 13px; display: none; text-align: center;"></div>
                    
                    <label style="display: flex; align-items: center; gap: 8px; margin: 10px 0; color: #333; cursor: pointer; font-size: 14px;">
                        <input type="checkbox" id="inlineTrustDeviceCheckbox" style="width: 16px; height: 16px; accent-color: #B81E20;">
                        Trust this device for 7 days
                    </label>
                    
                    <button type="button" id="inlineVerifyMFABtn" class="auth-modal__submit">
                        Verify Code
                    </button>
                </div>
                
                <!-- Divider -->
                <div class="auth-modal__divider">
                    <span>Need help?</span>
                </div>
                
                <!-- Footer actions -->
                <div style="text-align: center;">
                    <p id="inlineMfaExpiry" style="color: #666; font-size: 13px; margin: 0 0 10px 0;">Code expires in 10:00</p>
                    <button type="button" id="inlineResendMFABtn" style="background: none; border: none; color: #B81E20;
                            cursor: pointer; font-size: 14px; text-decoration: underline; padding: 0;">
                        Resend Code
                    </button>
                </div>
            </div>
        `;


        // Setup event listeners
        setupInlineMFAListeners(userId, email, resolve);

        // Start countdown timer
        mfaExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        startInlineMFACountdown();

        // Focus on input
        setTimeout(() => {
            const input = document.getElementById('inlineMfaCodeInput');
            if (input) input.focus();
        }, 100);
    });
}

/**
 * Setup event listeners for inline MFA form
 */
function setupInlineMFAListeners(userId, email, resolve) {
    const codeInput = document.getElementById('inlineMfaCodeInput');
    const verifyBtn = document.getElementById('inlineVerifyMFABtn');
    const cancelBtn = document.getElementById('inlineCancelMFABtn');
    const resendBtn = document.getElementById('inlineResendMFABtn');
    const errorEl = document.getElementById('inlineMfaError');

    if (!codeInput || !verifyBtn) return;

    // Input formatting
    codeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
        if (errorEl) errorEl.style.display = 'none';
    });

    // Enter key
    codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') verifyBtn.click();
    });

    // Verify button
    verifyBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        const trustDevice = document.getElementById('inlineTrustDeviceCheckbox')?.checked || false;

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
        if (errorEl) errorEl.style.display = 'none';

        const result = await verifyDeviceMFACode(code, trustDevice);

        if (result.success) {
            console.log('Inline MFA verification successful');
            // Restore modal and resolve
            restoreLoginModal();
            resolve({ success: true });
        } else {
            if (errorEl) {
                errorEl.textContent = result.error || 'Verification failed';
                errorEl.style.display = 'block';
            }
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify';
        }
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        console.log('MFA cancelled by user');
        restoreLoginModal();
        resolve({ success: false });
    });

    // Resend button
    resendBtn.addEventListener('click', async () => {
        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';

        const result = await requestDeviceMFACode(userId, email);

        if (result.success) {
            resendBtn.textContent = 'Code Sent!';
            // Reset timer
            mfaExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
            startInlineMFACountdown();
        } else {
            resendBtn.textContent = 'Failed - Try Again';
        }

        setTimeout(() => {
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend Code';
        }, 3000);
    });
}

/**
 * Start countdown timer for inline MFA
 */
function startInlineMFACountdown() {
    const expiryEl = document.getElementById('inlineMfaExpiry');
    if (!expiryEl || !mfaExpiresAt) return;

    const updateCountdown = () => {
        const now = Date.now();
        const remaining = mfaExpiresAt.getTime() - now;

        if (remaining <= 0) {
            expiryEl.textContent = 'Code expired';
            return;
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        expiryEl.textContent = `Code expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    updateCountdown();
    const interval = setInterval(() => {
        if (!document.getElementById('inlineMfaExpiry')) {
            clearInterval(interval);
            return;
        }
        updateCountdown();
    }, 1000);
}

/**
 * Restore original login modal content
 */
function restoreLoginModal() {
    const loginModal = window.__EH_MFA_MODAL_REF;
    const originalContent = window.__EH_ORIGINAL_MODAL_CONTENT;

    if (loginModal && originalContent) {
        const modalContent = loginModal.querySelector('.login-form, .modal-content, form') || loginModal;
        modalContent.innerHTML = originalContent;
    }

    // Clear references
    window.__EH_MFA_MODAL_REF = null;
    window.__EH_ORIGINAL_MODAL_CONTENT = null;
    window.__EH_MFA_RESOLVE = null;
    mfaPendingUserId = null;
    mfaPendingEmail = null;
}

// ============================================================
// EXPORTS
// ============================================================

// Make functions globally available
// Core functions still in use:
window.generateDeviceFingerprint = generateDeviceFingerprint;
window.isDeviceTrusted = isDeviceTrusted;
window.requestDeviceMFACode = requestDeviceMFACode;
window.verifyDeviceMFACode = verifyDeviceMFACode;
// Inline MFA for login modal:
window.showInlineMFA = showInlineMFA;
// NOTE: showMFAModal, hideMFAModal, checkAndHandleMFA are deprecated/removed

console.log('EventHive Device MFA module loaded');
