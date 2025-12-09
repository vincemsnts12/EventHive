// ===== PASSWORD SETUP PAGE HANDLER =====
// This handles setting password for users who click the password reset link
// Handles both PKCE code flow (?code=) and legacy implicit flow (#access_token=)

document.addEventListener('DOMContentLoaded', async () => {
    const loadingState = document.getElementById('loadingState');
    const invalidLinkState = document.getElementById('invalidLinkState');
    const passwordFormState = document.getElementById('passwordFormState');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const passwordForm = document.getElementById('passwordForm');
    const submitBtn = document.getElementById('submitBtn');

    // Track state
    let formShown = false;

    // Helper functions
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
        console.log('Invalid link displayed:', reason);
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

    // Wait for Supabase with retries
    async function waitForSupabase(maxWaitMs = 8000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            if (window.__EH_SUPABASE_CLIENT) {
                return window.__EH_SUPABASE_CLIENT;
            }
            if (typeof getSupabaseClient === 'function') {
                const client = getSupabaseClient();
                if (client) return client;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    // Parse URL parameters
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = parseHash(window.location.hash);

    console.log('Set-password page loaded:', {
        hasCode: searchParams.has('code'),
        hasAccessToken: !!hashParams.access_token,
        tokenType: hashParams.type,
        hash: window.location.hash ? 'present' : 'none'
    });

    // Check for errors in URL
    const errorCode = searchParams.get('error_code') || hashParams.error_code;
    const errorDescription = searchParams.get('error_description') || hashParams.error_description;

    if (errorCode || errorDescription) {
        console.warn('Error in URL:', errorCode, errorDescription);
        showInvalidLink('URL error');
        return;
    }

    // Check if we have recovery tokens
    const hasCode = searchParams.has('code');
    const hasAccessToken = !!hashParams.access_token;
    const tokenType = hashParams.type;

    // Must have either PKCE code or access_token in hash
    if (!hasCode && !hasAccessToken) {
        showInvalidLink('No recovery token in URL');
        return;
    }

    // Wait for Supabase
    const supabase = await waitForSupabase();
    if (!supabase) {
        showInvalidLink('Supabase not loaded');
        return;
    }

    console.log('Supabase client ready, setting up session...');

    // Set up auth state change listener FIRST
    let sessionEstablished = false;

    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event, session ? 'has session' : 'no session');

        if (event === 'PASSWORD_RECOVERY' ||
            event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'INITIAL_SESSION') {
            if (session) {
                console.log('Session established via event:', event);
                sessionEstablished = true;
                showPasswordForm();
            }
        }
    });

    // For legacy flow with access_token in hash, we need to set the session manually
    if (hasAccessToken) {
        console.log('Legacy flow detected - setting session from hash tokens...');

        try {
            const accessToken = hashParams.access_token;
            const refreshToken = hashParams.refresh_token || '';

            // Try to set the session using the tokens from the hash
            const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            if (error) {
                console.warn('setSession error:', error.message);
                // Don't fail immediately - the auth listener might still fire
            } else if (data?.session) {
                console.log('Session set successfully from hash tokens');
                sessionEstablished = true;
                showPasswordForm();
            }
        } catch (err) {
            console.warn('Error setting session from hash:', err);
        }
    }

    // For PKCE flow, Supabase auto-handles code exchange
    // Wait a bit and then check for session
    if (hasCode && !sessionEstablished) {
        console.log('PKCE flow - waiting for automatic code exchange...');

        // Give Supabase time to process the code
        await new Promise(r => setTimeout(r, 1500));

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log('Session found after PKCE exchange');
                sessionEstablished = true;
                showPasswordForm();
            }
        } catch (err) {
            console.warn('Error checking session:', err);
        }
    }

    // Check for existing session if not already shown
    if (!formShown) {
        setTimeout(async () => {
            if (formShown) return;

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    console.log('Found existing session on delayed check');
                    showPasswordForm();
                }
            } catch (err) {
                console.warn('Delayed session check error:', err);
            }
        }, 1000);
    }

    // Final timeout - show invalid if nothing worked
    setTimeout(() => {
        if (!formShown) {
            // Last attempt
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    showPasswordForm();
                } else {
                    showInvalidLink('No session after timeout');
                }
            }).catch(() => {
                showInvalidLink('Session check failed');
            });
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
                showError('Passwords do not match. Please try again.');
                return;
            }

            // Basic validation
            if (newPassword.length < 8) {
                showError('Password must be at least 8 characters long.');
                return;
            }

            // Password strength validation if available
            if (typeof validatePasswordStrength === 'function') {
                const validation = validatePasswordStrength(newPassword);
                if (!validation.valid) {
                    showError('Password does not meet requirements:\n' + validation.errors.join('\n'));
                    return;
                }
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Setting Password...';

            try {
                console.log('Updating password...');

                const { data, error } = await supabase.auth.updateUser({
                    password: newPassword
                });

                if (error) {
                    throw error;
                }

                console.log('Password updated successfully');

                // Update has_password flag
                try {
                    const userId = data?.user?.id;
                    if (userId) {
                        await supabase
                            .from('profiles')
                            .update({ has_password: true })
                            .eq('id', userId);
                        console.log('has_password flag updated');

                        // Update local cache
                        try {
                            const cached = JSON.parse(localStorage.getItem('eventhive_profile_cache') || '{}');
                            if (cached.profile) cached.profile.has_password = true;
                            else cached.has_password = true;
                            localStorage.setItem('eventhive_profile_cache', JSON.stringify(cached));
                        } catch (e) { /* ignore */ }
                    }
                } catch (flagErr) {
                    console.warn('Could not update has_password:', flagErr);
                }

                showSuccess('Password set successfully! Redirecting...');
                passwordForm.style.display = 'none';

                // Clean URL
                window.history.replaceState(null, null, window.location.pathname);

                // Redirect
                setTimeout(() => {
                    window.location.href = 'eventhive-homepage.html';
                }, 2000);

            } catch (err) {
                console.error('Password update error:', err);

                let msg = 'Failed to set password.';
                if (err.message) {
                    if (err.message.toLowerCase().includes('session') ||
                        err.message.toLowerCase().includes('expired')) {
                        msg = 'Your session has expired. Please request a new password reset link.';
                    } else {
                        msg = 'Error: ' + err.message;
                    }
                }

                showError(msg);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Set Password';
            }
        });
    }
});
