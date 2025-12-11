// ===== PASSWORD SETUP PAGE HANDLER =====
// SIMPLIFIED: Let Supabase handle token exchange automatically
// Just wait for valid session and show the form

(function () {
    // Capture tokens immediately at script load (before any processing)
    const originalHash = window.location.hash;
    const originalSearch = window.location.search;

    // Simple hash parser
    function parseHash(hash) {
        const params = {};
        if (!hash || hash.length <= 1) return params;
        const raw = hash.substring(1); // Remove leading #
        raw.split('&').forEach(pair => {
            const idx = pair.indexOf('=');
            if (idx > 0) {
                const key = pair.substring(0, idx);
                const value = decodeURIComponent(pair.substring(idx + 1).replace(/\+/g, ' '));
                params[key] = value;
            }
        });
        return params;
    }

    const hashParams = parseHash(originalHash);
    const searchParams = new URLSearchParams(originalSearch);

    // Store tokens for later use
    const capturedAccessToken = hashParams.access_token;
    const capturedRefreshToken = hashParams.refresh_token || '';
    const tokenType = hashParams.type;

    console.log('=== SET PASSWORD PAGE ===');
    console.log('Has access_token:', !!capturedAccessToken);
    console.log('Has code:', searchParams.has('code'));
    console.log('Token type:', tokenType);
    console.log('Has refresh_token:', !!capturedRefreshToken);
    if (capturedAccessToken) {
        console.log('Token preview:', capturedAccessToken.substring(0, 50) + '...');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const loadingState = document.getElementById('loadingState');
        const invalidLinkState = document.getElementById('invalidLinkState');
        const passwordFormState = document.getElementById('passwordFormState');
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');
        const passwordForm = document.getElementById('passwordForm');
        const submitBtn = document.getElementById('submitBtn');

        let formShown = false;
        let activeAccessToken = capturedAccessToken;

        function showPasswordForm() {
            if (formShown) return;
            formShown = true;
            loadingState.style.display = 'none';
            invalidLinkState.style.display = 'none';
            passwordFormState.style.display = 'block';
            console.log('✓ Password form displayed');
        }

        function showInvalidLink(reason) {
            if (formShown) return;
            loadingState.style.display = 'none';
            invalidLinkState.style.display = 'block';
            passwordFormState.style.display = 'none';
            console.log('✗ Invalid link:', reason);
        }

        function showError(msg) {
            errorMessage.textContent = msg;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        }

        function showSuccess(msg) {
            successMessage.textContent = msg;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
        }

        // Validate we have tokens
        const hasCode = searchParams.has('code');
        const errorCode = searchParams.get('error_code') || hashParams.error_code;

        if (errorCode) {
            showInvalidLink('URL contains error: ' + errorCode);
            return;
        }

        if (!capturedAccessToken && !hasCode) {
            showInvalidLink('No recovery token in URL');
            return;
        }

        // Wait for Supabase
        console.log('Waiting for Supabase client...');
        let supabase = null;
        const maxWait = 5000;
        const startTime = Date.now();

        while (!supabase && Date.now() - startTime < maxWait) {
            if (typeof getSupabaseClient === 'function') {
                supabase = getSupabaseClient();
            }
            if (!supabase && window.__EH_SUPABASE_CLIENT) {
                supabase = window.__EH_SUPABASE_CLIENT;
            }
            if (!supabase) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        if (!supabase) {
            showInvalidLink('Supabase client not available');
            return;
        }

        console.log('✓ Supabase client ready');
        console.log('Supabase URL:', window.__EH_SUPABASE_URL?.substring(0, 40) || 'not set');

        // Listen for session events
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event, '| Session:', session ? 'YES' : 'NO');

            if (session) {
                activeAccessToken = session.access_token;

                if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                    console.log('✓ Valid session from', event);
                    showPasswordForm();
                }
            }
        });

        // Try to set session from captured tokens
        if (capturedAccessToken) {
            console.log('Calling setSession with captured tokens...');

            try {
                const { data, error } = await supabase.auth.setSession({
                    access_token: capturedAccessToken,
                    refresh_token: capturedRefreshToken
                });

                if (error) {
                    console.error('setSession error:', error.message);
                    console.error('Error code:', error.code);
                    // Don't fail immediately - auth events might still work
                } else {
                    console.log('✓ setSession success');
                    if (data?.session) {
                        activeAccessToken = data.session.access_token;
                        showPasswordForm();
                    }
                }
            } catch (err) {
                console.error('setSession exception:', err);
            }
        } else if (hasCode) {
            console.log('Calling exchangeCodeForSession...');
            try {
                const { data, error } = await supabase.auth.exchangeCodeForSession(searchParams.get('code'));
                if (error) {
                    console.error('exchangeCodeForSession error:', error.message);
                } else if (data?.session) {
                    activeAccessToken = data.session.access_token;
                    showPasswordForm();
                }
            } catch (err) {
                console.error('exchangeCodeForSession exception:', err);
            }
        }

        // Check current session after a delay
        setTimeout(async () => {
            if (formShown) return;

            console.log('Checking for existing session...');
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    console.log('✓ Found existing session');
                    activeAccessToken = session.access_token;
                    showPasswordForm();
                } else {
                    console.log('No session found');
                }
            } catch (err) {
                console.error('getSession error:', err);
            }
        }, 1500);

        // Final timeout
        setTimeout(() => {
            if (!formShown) {
                showInvalidLink('Could not establish session (timeout)');
            }
        }, 7000);

        // Form submission
        passwordForm?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';

            if (newPassword !== confirmPassword) {
                showError('Passwords do not match.');
                return;
            }

            if (newPassword.length < 8) {
                showError('Password must be at least 8 characters.');
                return;
            }

            // Validate strength if function available
            if (typeof validatePasswordStrength === 'function') {
                const validation = validatePasswordStrength(newPassword);
                if (!validation.valid) {
                    showError(validation.errors.join('\n'));
                    return;
                }
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Setting Password...';

            try {
                // Get current token and URL
                const token = activeAccessToken || capturedAccessToken;
                const supabaseUrl = window.__EH_SUPABASE_URL;
                const supabaseKey = window.__EH_SUPABASE_ANON_KEY;

                if (!token) {
                    throw new Error('No valid token. Please request a new password reset link.');
                }

                if (!supabaseUrl || !supabaseKey) {
                    console.error('Missing config:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
                    throw new Error('Configuration error. Please refresh the page.');
                }

                console.log('Updating password...');
                console.log('Using URL:', supabaseUrl);
                console.log('Token length:', token.length);

                // Direct API call for reliability
                const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'apikey': supabaseKey
                    },
                    body: JSON.stringify({ password: newPassword })
                });

                console.log('Response status:', response.status);

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    console.error('Update failed:', errData);

                    // Check for same password error
                    const errorMsg = errData.message || errData.error_description || errData.msg || '';
                    if (errorMsg.toLowerCase().includes('same as') ||
                        errorMsg.toLowerCase().includes('different from') ||
                        errorMsg.toLowerCase().includes('same password') ||
                        errorMsg.toLowerCase().includes('previous password') ||
                        errData.code === 'same_password') {
                        throw new Error('Your new password cannot be the same as your previous password. Please choose a different password.');
                    }

                    throw new Error(errorMsg || `HTTP ${response.status}`);
                }

                const userData = await response.json();
                console.log('✓ Password updated successfully');

                // Update has_password flag
                try {
                    const userId = userData.id;
                    if (userId) {
                        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`,
                                'apikey': supabaseKey,
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({ has_password: true })
                        });
                        console.log('✓ has_password flag updated');
                    }
                } catch (flagErr) {
                    console.warn('Could not update has_password:', flagErr);
                }

                showSuccess('Password set successfully! Redirecting...');
                passwordForm.style.display = 'none';

                // Clear URL
                window.history.replaceState(null, '', window.location.pathname);

                setTimeout(() => {
                    window.location.href = 'eventhive-homepage.html';
                }, 2000);

            } catch (err) {
                console.error('Password update error:', err);
                showError(err.message || 'Failed to update password');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Set Password';
            }
        });
    });
})();
