// ===== PASSWORD SETUP PAGE HANDLER =====
// This handles setting password for users who click the password reset link
// Works with eventhive-supabase.js (which skips OAuth callback on this page)

(function () {
    // Capture hash immediately before any processing
    const originalHash = window.location.hash;
    const originalSearch = window.location.search;

    // Parse hash fragment into object
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

    // Store parsed tokens immediately (before any other script can clear URL)
    const hashParams = parseHash(originalHash);
    const searchParams = new URLSearchParams(originalSearch);

    console.log('Set-password: Captured URL tokens:', {
        hasAccessToken: !!hashParams.access_token,
        hasCode: searchParams.has('code'),
        tokenType: hashParams.type
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
        const errorDescription = searchParams.get('error_description') || hashParams.error_description;

        if (errorCode || errorDescription) {
            console.warn('Error in URL:', errorCode, errorDescription);
            showInvalidLink('Link error');
            return;
        }

        // Check for recovery tokens
        const hasCode = searchParams.has('code');
        const accessToken = hashParams.access_token;
        const refreshToken = hashParams.refresh_token || '';

        if (!hasCode && !accessToken) {
            showInvalidLink('No recovery token found');
            return;
        }

        console.log('Recovery tokens found, waiting for Supabase...');

        // Wait for Supabase client from eventhive-supabase.js
        let supabaseClient = null;
        const maxWait = 5000;
        const startTime = Date.now();

        while (!supabaseClient && Date.now() - startTime < maxWait) {
            // Try getSupabaseClient from eventhive-supabase.js
            if (typeof getSupabaseClient === 'function') {
                supabaseClient = getSupabaseClient();
            }
            // Also try window global
            if (!supabaseClient && window.__EH_SUPABASE_CLIENT) {
                supabaseClient = window.__EH_SUPABASE_CLIENT;
            }
            if (!supabaseClient) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        if (!supabaseClient) {
            showInvalidLink('Supabase not initialized');
            return;
        }

        console.log('Supabase client ready');

        // Set up auth state listener
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event, session ? 'has session' : 'no session');

            if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
                showPasswordForm();
            }
        });

        // Set session from tokens
        if (accessToken) {
            console.log('Setting session from hash access_token...');

            try {
                const { data, error } = await supabaseClient.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });

                if (error) {
                    console.error('setSession error:', error);
                    if (error.message?.includes('expired') || error.message?.includes('invalid')) {
                        showInvalidLink('Token expired');
                        return;
                    }
                } else if (data?.session) {
                    console.log('Session established from tokens');
                    showPasswordForm();
                }
            } catch (err) {
                console.error('Error setting session:', err);
            }
        } else if (hasCode) {
            const code = searchParams.get('code');
            console.log('Exchanging PKCE code...');

            try {
                const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);

                if (error) {
                    console.error('Code exchange error:', error);
                    if (error.message?.includes('expired') || error.message?.includes('invalid')) {
                        showInvalidLink('Code expired');
                        return;
                    }
                } else if (data?.session) {
                    console.log('Session established from code');
                    showPasswordForm();
                }
            } catch (err) {
                console.error('Error exchanging code:', err);
            }
        }

        // Fallback: check for existing session
        setTimeout(async () => {
            if (formShown) return;

            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session) {
                    console.log('Found existing session');
                    showPasswordForm();
                }
            } catch (err) {
                console.warn('Session check error:', err);
            }
        }, 1500);

        // Final timeout
        setTimeout(() => {
            if (!formShown) {
                supabaseClient.auth.getSession().then(({ data: { session } }) => {
                    if (session) {
                        showPasswordForm();
                    } else {
                        showInvalidLink('Session timeout');
                    }
                }).catch(() => showInvalidLink('Session failed'));
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
                    const { data, error } = await supabaseClient.auth.updateUser({
                        password: newPassword
                    });

                    if (error) throw error;

                    console.log('Password updated');

                    // Update has_password flag
                    try {
                        const userId = data?.user?.id;
                        if (userId) {
                            await supabaseClient
                                .from('profiles')
                                .update({ has_password: true })
                                .eq('id', userId);
                            console.log('has_password updated');
                        }
                    } catch (e) {
                        console.warn('Could not update has_password:', e);
                    }

                    showSuccess('Password set! Redirecting...');
                    passwordForm.style.display = 'none';
                    window.history.replaceState(null, null, window.location.pathname);

                    setTimeout(() => {
                        window.location.href = 'eventhive-homepage.html';
                    }, 2000);

                } catch (err) {
                    console.error('Password error:', err);

                    let msg = 'Failed to set password.';
                    if (err.message?.includes('expired') || err.message?.includes('session')) {
                        msg = 'Session expired. Please request a new reset link.';
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
