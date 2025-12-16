/**
 * EventHive Device-Based MFA
 * 
 * Implements device fingerprinting, MFA code verification, and trusted device management.
 * Triggers email verification when users log in from new devices/IPs.
 */

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
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function requestMFACode(userId, email) {
    if (!userId || !email) {
        return { success: false, error: 'User ID and email required' };
    }

    const fingerprint = generateDeviceFingerprint();
    const code = generateMFACode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const supabase = getSupabaseClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not available' };
    }

    try {
        // Delete any existing pending codes for this device
        await supabase
            .from('mfa_codes')
            .delete()
            .eq('user_id', userId)
            .eq('device_fingerprint', fingerprint)
            .eq('verified', false);

        // Insert new code
        const { error: insertError } = await supabase
            .from('mfa_codes')
            .insert({
                user_id: userId,
                code: code,
                device_fingerprint: fingerprint,
                expires_at: expiresAt.toISOString(),
                attempts: 0,
                verified: false
            });

        if (insertError) {
            console.error('Error storing MFA code:', insertError);
            return { success: false, error: 'Failed to generate code' };
        }

        // Send email via Vercel API
        const response = await fetch('/api/send-mfa-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Error sending MFA email:', errorData);
            return { success: false, error: 'Failed to send verification email' };
        }

        // Store pending state
        mfaPendingUserId = userId;
        mfaPendingEmail = email;
        mfaExpiresAt = expiresAt;

        return { success: true };
    } catch (err) {
        console.error('Exception in requestMFACode:', err);
        return { success: false, error: 'An error occurred' };
    }
}

/**
 * Verify an MFA code
 * @param {string} inputCode - Code entered by user
 * @param {boolean} trustDevice - Whether to trust this device for 7 days
 * @returns {Promise<{success: boolean, error?: string, attemptsLeft?: number}>}
 */
async function verifyMFACode(inputCode, trustDevice = false) {
    if (!mfaPendingUserId) {
        return { success: false, error: 'No pending verification' };
    }

    if (!inputCode || !/^\d{6}$/.test(inputCode)) {
        return { success: false, error: 'Please enter a valid 6-digit code' };
    }

    const fingerprint = generateDeviceFingerprint();
    const supabase = getSupabaseClient();

    if (!supabase) {
        return { success: false, error: 'Supabase not available' };
    }

    try {
        // Get pending code
        const { data: codeRecord, error: fetchError } = await supabase
            .from('mfa_codes')
            .select('*')
            .eq('user_id', mfaPendingUserId)
            .eq('device_fingerprint', fingerprint)
            .eq('verified', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) {
            console.error('Error fetching MFA code:', fetchError);
            return { success: false, error: 'Verification failed' };
        }

        if (!codeRecord) {
            return { success: false, error: 'Code expired or not found. Please request a new code.' };
        }

        // Check max attempts
        if (codeRecord.attempts >= 5) {
            return { success: false, error: 'Too many failed attempts. Please request a new code.' };
        }

        // Check code
        if (codeRecord.code !== inputCode) {
            // Increment attempts
            await supabase
                .from('mfa_codes')
                .update({ attempts: codeRecord.attempts + 1 })
                .eq('id', codeRecord.id);

            const attemptsLeft = 4 - codeRecord.attempts;
            return {
                success: false,
                error: `Invalid code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
                attemptsLeft
            };
        }

        // Code is correct! Mark as verified
        await supabase
            .from('mfa_codes')
            .update({ verified: true })
            .eq('id', codeRecord.id);

        // Trust device if requested
        if (trustDevice) {
            const trustUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            await supabase
                .from('trusted_devices')
                .upsert({
                    user_id: mfaPendingUserId,
                    device_fingerprint: fingerprint,
                    device_name: getDeviceName(),
                    user_agent: navigator.userAgent,
                    trusted_until: trustUntil.toISOString()
                }, {
                    onConflict: 'user_id,device_fingerprint'
                });
        }

        // Clear pending state
        mfaPendingUserId = null;
        mfaPendingEmail = null;
        mfaExpiresAt = null;

        return { success: true };
    } catch (err) {
        console.error('Exception in verifyMFACode:', err);
        return { success: false, error: 'Verification failed' };
    }
}

// ============================================================
// MFA MODAL UI
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
        const code = codeInput.value.trim();
        const trustDevice = document.getElementById('trustDeviceCheckbox').checked;

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
        errorEl.style.display = 'none';

        const result = await verifyMFACode(code, trustDevice);

        if (result.success) {
            hideMFAModal();
            // Refresh the page or update UI to show logged-in state
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

        const result = await requestMFACode(mfaPendingUserId, mfaPendingEmail);

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

    // Request MFA code
    const result = await requestMFACode(userId, email);

    if (!result.success) {
        console.error('Failed to request MFA code:', result.error);
        alert('Failed to send verification email. Please try again.');
        return false;
    }

    // Show MFA modal
    showMFAModal();

    // Return false to indicate MFA is pending
    return false;
}

// ============================================================
// EXPORTS
// ============================================================

// Make functions globally available
window.generateDeviceFingerprint = generateDeviceFingerprint;
window.isDeviceTrusted = isDeviceTrusted;
window.requestMFACode = requestMFACode;
window.verifyMFACode = verifyMFACode;
window.showMFAModal = showMFAModal;
window.hideMFAModal = hideMFAModal;
window.checkAndHandleMFA = checkAndHandleMFA;

console.log('EventHive Device MFA module loaded');
