// ===== PASSWORD SETUP PAGE HANDLER =====
// This handles setting password for users who click the password reset link
// Uses URL code parsing + auth event listener - no blocking getSession() calls

document.addEventListener('DOMContentLoaded', async () => {
    const loadingState = document.getElementById('loadingState');
    const invalidLinkState = document.getElementById('invalidLinkState');
    const passwordFormState = document.getElementById('passwordFormState');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const passwordForm = document.getElementById('passwordForm');
    const submitBtn = document.getElementById('submitBtn');

    // Track if we've shown the form (to prevent double-showing)
    let formShown = false;
    let authListenerCalled = false;

    // Helper functions
    function showPasswordForm() {
        if (formShown) return;
        formShown = true;
        loadingState.style.display = 'none';
        invalidLinkState.style.display = 'none';
        passwordFormState.style.display = 'block';
        console.log('Password form displayed');
    }

    function showInvalidLink() {
        if (formShown) return; // Don't show invalid if form already shown
        loadingState.style.display = 'none';
        invalidLinkState.style.display = 'block';
        passwordFormState.style.display = 'none';
        console.log('Invalid link state displayed');
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }

    function hideMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }

    // Initialize Supabase
    if (typeof initSupabase === 'function') {
        initSupabase();
    }

    const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (!supabase) {
        console.error('Supabase client not available');
        showInvalidLink();
        return;
    }

    // Parse URL for recovery tokens/codes
    // Supabase uses PKCE flow - the URL contains a 'code' parameter
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const code = searchParams.get('code');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    // Legacy: check hash for access_token (older Supabase versions)
    const accessToken = hashParams.get('access_token');
    const tokenType = hashParams.get('type');
    const refreshToken = hashParams.get('refresh_token');

    console.log('URL params:', {
        code: code ? 'present' : 'missing',
        accessToken: accessToken ? 'present' : 'missing',
        tokenType,
        errorCode
    });

    // Handle error from Supabase
    if (errorCode || errorDescription) {
        console.warn('Password reset error:', errorCode, errorDescription);
        showInvalidLink();
        return;
    }

    // No recovery code/token in URL = invalid link
    if (!code && !accessToken) {
        console.warn('No recovery code or access token in URL');
        showInvalidLink();
        return;
    }

    // Set up auth state listener FIRST (before any exchange)
    // This catches the PASSWORD_RECOVERY or SIGNED_IN event when Supabase processes the token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state change on set-password page:', event);
        authListenerCalled = true;

        if (event === 'PASSWORD_RECOVERY') {
            // This is the ideal event for password reset
            console.log('PASSWORD_RECOVERY event - showing form');
            showPasswordForm();
        } else if (event === 'SIGNED_IN' && session) {
            // Sometimes recovery comes as SIGNED_IN with active session
            console.log('SIGNED_IN event with session - showing form');
            showPasswordForm();
        } else if (event === 'TOKEN_REFRESHED' && session) {
            // Token refreshed also means valid session
            console.log('TOKEN_REFRESHED event - showing form');
            showPasswordForm();
        }
    });

    // Try to exchange the code for a session (PKCE flow)
    if (code) {
        console.log('Attempting to exchange code for session...');
        try {
            // Use exchangeCodeForSession with a timeout wrapper
            const exchangePromise = supabase.auth.exchangeCodeForSession(code);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Exchange timeout')), 8000)
            );

            const { data, error } = await Promise.race([exchangePromise, timeoutPromise])
                .catch(err => ({ data: null, error: err }));

            if (error) {
                console.warn('Code exchange error:', error.message);
                // Don't immediately show invalid - wait for auth listener
                // The listener might still fire
            } else if (data?.session) {
                console.log('Code exchange successful');
                showPasswordForm();
            }
        } catch (err) {
            console.warn('Code exchange failed:', err.message);
        }
    }

    // Legacy: try to set session from hash tokens (older flow)
    if (accessToken && tokenType === 'recovery' && !formShown) {
        console.log('Attempting legacy token-based session...');
        try {
            const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
            });

            if (error) {
                console.warn('Legacy session error:', error.message);
            } else if (data?.session) {
                console.log('Legacy session successful');
                showPasswordForm();
            }
        } catch (err) {
            console.warn('Legacy session failed:', err.message);
        }
    }

    // Timeout fallback - if nothing worked after 6 seconds, show invalid
    setTimeout(() => {
        if (!formShown) {
            console.warn('Timeout reached - no valid session established');
            showInvalidLink();
        }
    }, 6000);

    // Handle form submission
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            hideMessages();

            // Validate passwords match
            if (newPassword !== confirmPassword) {
                showError('Passwords do not match. Please try again.');
                return;
            }

            // Validate password strength
            if (typeof validatePasswordStrength === 'function') {
                const validation = validatePasswordStrength(newPassword);
                if (!validation.valid) {
                    showError('Password does not meet requirements:\n' + validation.errors.join('\n'));
                    return;
                }
            } else {
                // Fallback validation
                if (newPassword.length < 8) {
                    showError('Password must be at least 8 characters long.');
                    return;
                }
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Setting Password...';

            try {
                // Update password using direct fetch API with timeout
                const accessToken = localStorage.getItem('sb-access-token') ||
                    JSON.parse(localStorage.getItem(`sb-${window.__EH_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`) || '{}')?.access_token;

                if (!accessToken) {
                    // Fallback: try using supabase client (might work if session was established)
                    const { error } = await supabase.auth.updateUser({ password: newPassword });

                    if (error) {
                        throw error;
                    }
                } else {
                    // Use direct API call with timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const response = await fetch(`${window.__EH_SUPABASE_URL}/auth/v1/user`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                            'apikey': window.__EH_SUPABASE_ANON_KEY
                        },
                        body: JSON.stringify({ password: newPassword }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.message || errorData.error_description || 'Failed to update password');
                    }
                }

                // Success! Now update has_password in the database
                try {
                    const userId = JSON.parse(localStorage.getItem(`sb-${window.__EH_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`) || '{}')?.user?.id;

                    if (userId && accessToken) {
                        // Update has_password flag in profiles table
                        const updateController = new AbortController();
                        const updateTimeout = setTimeout(() => updateController.abort(), 10000);

                        await fetch(`${window.__EH_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken}`,
                                'apikey': window.__EH_SUPABASE_ANON_KEY,
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({ has_password: true }),
                            signal: updateController.signal
                        });

                        clearTimeout(updateTimeout);
                        console.log('has_password flag updated successfully');
                    }
                } catch (flagErr) {
                    // Non-critical - password was still set successfully
                    console.warn('Could not update has_password flag:', flagErr);
                }

                showSuccess('Your password has been set successfully! Redirecting to login...');
                passwordForm.style.display = 'none';

                // Clear URL tokens
                if (window.history.replaceState) {
                    window.history.replaceState(null, null, window.location.pathname);
                }

                // Redirect to homepage
                setTimeout(() => {
                    window.location.href = 'eventhive-homepage.html';
                }, 2500);

            } catch (err) {
                console.error('Error setting password:', err);

                if (err.message.includes('session') || err.message.includes('expired')) {
                    showError('Your password reset link has expired. Please request a new one.');
                } else if (err.name === 'AbortError') {
                    showError('Request timed out. Please try again.');
                } else {
                    showError('Failed to set password: ' + err.message);
                }

                submitBtn.disabled = false;
                submitBtn.textContent = 'Set Password';
            }
        });
    }
});
