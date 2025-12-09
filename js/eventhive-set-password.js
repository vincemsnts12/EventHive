// ===== PASSWORD SETUP PAGE HANDLER =====
// Handles password reset for users clicking the reset link
// Compatible with eventhive-supabase.js (which skips OAuth callback on this page)

(function () {
    // Capture hash immediately at script load
    const originalHash = window.location.hash;
    const originalSearch = window.location.search;

    function parseHash(hash) {
        const params = {};
        if (!hash) return params;
        const raw = hash.startsWith('#') ? hash.slice(1) : hash;
        raw.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
            }
        });
        return params;
    }

    const hashParams = parseHash(originalHash);
    const searchParams = new URLSearchParams(originalSearch);

    // Store the access token for direct API calls if needed
    const capturedAccessToken = hashParams.access_token || null;
    const capturedRefreshToken = hashParams.refresh_token || '';

    console.log('Set-password: Captured tokens:', {
        hasAccessToken: !!capturedAccessToken,
        hasCode: searchParams.has('code')
    });

    document.addEventListener('DOMContentLoaded', async () => {
        const loadingState = document.getElementById('loadingState');
        const invalidLinkState = document.getElementById('invalidLinkState');
        const passwordFormState = document.getElementById('passwordFormState');
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');
        const passwordForm = document.getElementById('passwordForm');
        const submitBtn = document.getElementById('submitBtn');

        let formShown = false;
        let supabaseClient = null;
        let activeSession = null; // Store the session when it's valid

        function showPasswordForm() {
            if (formShown) return;
            formShown = true;
            loadingState.style.display = 'none';
            invalidLinkState.style.display = 'none';
            passwordFormState.style.display = 'block';
            console.log('Password form displayed');
        }

        function showInvalidLink(reason = '') {
            if (formShown) return;
            loadingState.style.display = 'none';
            invalidLinkState.style.display = 'block';
            passwordFormState.style.display = 'none';
            console.log('Invalid link:', reason);
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

        // Check for errors in URL
        const errorCode = searchParams.get('error_code') || hashParams.error_code;
        if (errorCode) {
            showInvalidLink('Link error');
            return;
        }

        // Need either code or access token
        if (!searchParams.has('code') && !capturedAccessToken) {
            showInvalidLink('No recovery token');
            return;
        }

        // Wait for Supabase client
        const maxWait = 5000;
        const startTime = Date.now();

        while (!supabaseClient && Date.now() - startTime < maxWait) {
            if (typeof getSupabaseClient === 'function') {
                supabaseClient = getSupabaseClient();
            }
            if (!supabaseClient && window.__EH_SUPABASE_CLIENT) {
                supabaseClient = window.__EH_SUPABASE_CLIENT;
            }
            if (!supabaseClient) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        if (!supabaseClient) {
            showInvalidLink('Supabase not ready');
            return;
        }

        console.log('Supabase ready');

        // Listen for auth events and STORE the session when valid
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event, session ? 'has session' : 'no session');

            // Store the session whenever we get a valid one
            if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                activeSession = session;
                showPasswordForm();
            }
        });

        // Set session from tokens
        if (capturedAccessToken) {
            console.log('Setting session from access_token...');

            try {
                const { data, error } = await supabaseClient.auth.setSession({
                    access_token: capturedAccessToken,
                    refresh_token: capturedRefreshToken
                });

                if (error) {
                    console.error('setSession error:', error.message);
                    // Don't immediately fail - wait for auth events
                } else if (data?.session) {
                    activeSession = data.session;
                    console.log('Session set, stored for form submission');
                    showPasswordForm();
                }
            } catch (err) {
                console.error('Error in setSession:', err);
            }
        } else if (searchParams.has('code')) {
            console.log('Exchanging PKCE code...');
            try {
                const { data, error } = await supabaseClient.auth.exchangeCodeForSession(searchParams.get('code'));
                if (!error && data?.session) {
                    activeSession = data.session;
                    showPasswordForm();
                }
            } catch (err) {
                console.error('Code exchange error:', err);
            }
        }

        // Fallback check
        setTimeout(async () => {
            if (!formShown) {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session) {
                    activeSession = session;
                    showPasswordForm();
                }
            }
        }, 1500);

        // Final timeout
        setTimeout(() => {
            if (!formShown) {
                showInvalidLink('Session timeout');
            }
        }, 6000);

        // Handle form submission
        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;

                hideMessages();

                if (newPassword !== confirmPassword) {
                    showError('Passwords do not match.');
                    return;
                }

                if (newPassword.length < 8) {
                    showError('Password must be at least 8 characters.');
                    return;
                }

                if (typeof validatePasswordStrength === 'function') {
                    const validation = validatePasswordStrength(newPassword);
                    if (!validation.valid) {
                        showError('Password requirements:\n' + validation.errors.join('\n'));
                        return;
                    }
                }

                submitBtn.disabled = true;
                submitBtn.textContent = 'Setting Password...';

                try {
                    // Try direct API call with stored access token (more reliable if session expired)
                    const tokenToUse = activeSession?.access_token || capturedAccessToken;
                    const supabaseUrl = window.__EH_SUPABASE_URL;
                    const supabaseKey = window.__EH_SUPABASE_ANON_KEY;

                    if (!tokenToUse) {
                        throw new Error('No valid session. Please request a new password reset link.');
                    }

                    console.log('Updating password via direct API...');

                    // Use direct fetch with timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);

                    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${tokenToUse}`,
                            'apikey': supabaseKey
                        },
                        body: JSON.stringify({ password: newPassword }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.message || errorData.error_description || `Failed (${response.status})`);
                    }

                    const userData = await response.json();
                    console.log('Password updated successfully');

                    // Update has_password flag
                    try {
                        const userId = userData?.id || activeSession?.user?.id;
                        if (userId && supabaseUrl && supabaseKey) {
                            await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${tokenToUse}`,
                                    'apikey': supabaseKey,
                                    'Prefer': 'return=minimal'
                                },
                                body: JSON.stringify({ has_password: true })
                            });
                            console.log('has_password flag updated');
                        }
                    } catch (flagErr) {
                        console.warn('Could not update has_password:', flagErr);
                    }

                    showSuccess('Password set successfully! Redirecting...');
                    passwordForm.style.display = 'none';
                    window.history.replaceState(null, null, window.location.pathname);

                    setTimeout(() => {
                        window.location.href = 'eventhive-homepage.html';
                    }, 2000);

                } catch (err) {
                    console.error('Password update error:', err);

                    let msg = 'Failed to set password.';
                    if (err.name === 'AbortError') {
                        msg = 'Request timed out. Please try again.';
                    } else if (err.message?.includes('expired') || err.message?.includes('invalid') || err.message?.includes('session')) {
                        msg = 'Session expired. Please request a new password reset link.';
                    } else if (err.message) {
                        msg = err.message;
                    }

                    showError(msg);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Set Password';
                }
            });
        }
    });
})();
