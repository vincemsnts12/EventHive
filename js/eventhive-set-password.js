// ===== PASSWORD SETUP PAGE HANDLER =====
// This handles setting password for users who click the password reset link
// FIXED: Uses Supabase's automatic code exchange and session handling instead of manual exchange

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
    let sessionEstablished = false;

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
        if (formShown) return; // Don't show invalid if form already shown
        loadingState.style.display = 'none';
        invalidLinkState.style.display = 'block';
        passwordFormState.style.display = 'none';
        console.log('Invalid link state displayed', reason ? '- ' + reason : '');
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

    // Wait for Supabase to be ready
    async function waitForSupabase(maxWaitMs = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            if (typeof getSupabaseClient === 'function') {
                const client = getSupabaseClient();
                if (client) return client;
            }
            // Also try window.__EH_SUPABASE_CLIENT
            if (window.__EH_SUPABASE_CLIENT) {
                return window.__EH_SUPABASE_CLIENT;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    // Parse URL for any error parameters first
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const errorCode = searchParams.get('error_code') || hashParams.get('error_code');
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

    // Handle error from Supabase (expired link, etc.)
    if (errorCode || errorDescription) {
        console.warn('Password reset error from URL:', errorCode, errorDescription);
        showInvalidLink('URL error: ' + (errorDescription || errorCode));
        return;
    }

    // Check if there's a recovery code in URL (PKCE flow)
    const hasCode = searchParams.has('code');
    // Legacy: check hash for access_token and recovery type
    const accessToken = hashParams.get('access_token');
    const tokenType = hashParams.get('type');
    const isLegacyRecovery = accessToken && tokenType === 'recovery';

    console.log('Set-password page loaded:', {
        hasCode,
        hasLegacyRecovery: isLegacyRecovery,
        pathname: window.location.pathname
    });

    // If no recovery indicators in URL, show invalid link
    if (!hasCode && !isLegacyRecovery) {
        showInvalidLink('No recovery code in URL');
        return;
    }

    // Wait for Supabase client to be available
    const supabase = await waitForSupabase();
    if (!supabase) {
        console.error('Supabase client not available after waiting');
        showInvalidLink('Supabase not loaded');
        return;
    }

    console.log('Supabase client ready');

    // IMPORTANT: Supabase JS library automatically exchanges the code for a session
    // when it initializes. We just need to wait for the session to be established
    // and listen for the PASSWORD_RECOVERY event.

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth event on set-password page:', event, session ? 'has session' : 'no session');

        if (event === 'PASSWORD_RECOVERY') {
            // This is the ideal event - Supabase recognized this as a password recovery
            console.log('PASSWORD_RECOVERY event received');
            sessionEstablished = true;
            showPasswordForm();
        } else if (event === 'SIGNED_IN' && session) {
            // Sometimes recovery comes as SIGNED_IN
            console.log('SIGNED_IN event with session received');
            sessionEstablished = true;
            showPasswordForm();
        } else if (event === 'TOKEN_REFRESHED' && session) {
            // Token refresh means valid session
            console.log('TOKEN_REFRESHED event received');
            sessionEstablished = true;
            showPasswordForm();
        } else if (event === 'INITIAL_SESSION' && session) {
            // Initial session means code was already processed
            console.log('INITIAL_SESSION event with session');
            sessionEstablished = true;
            showPasswordForm();
        }
    });

    // Also check if there's already a valid session
    // (in case the event already fired before we attached the listener)
    setTimeout(async () => {
        if (formShown) return; // Already showing form

        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.warn('getSession error:', error.message);
            }

            if (session) {
                console.log('Found existing session, showing password form');
                sessionEstablished = true;
                showPasswordForm();
            }
        } catch (err) {
            console.warn('Error checking session:', err);
        }
    }, 500);

    // Longer timeout fallback - Supabase may take a moment to process the code
    setTimeout(() => {
        if (!formShown) {
            // Last attempt: check session one more time
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    console.log('Late session found, showing form');
                    sessionEstablished = true;
                    showPasswordForm();
                } else {
                    console.warn('Timeout - no valid session established');
                    showInvalidLink('Session timeout');
                }
            }).catch(() => {
                showInvalidLink('Session check failed');
            });
        }
    }, 4000);

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
                // Use Supabase's updateUser to change password
                // This is the recommended approach and works with the current session
                console.log('Updating password via updateUser...');

                const { data, error } = await supabase.auth.updateUser({
                    password: newPassword
                });

                if (error) {
                    console.error('updateUser error:', error);
                    throw error;
                }

                console.log('Password updated successfully via updateUser');

                // Update has_password flag in the profiles table
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const userId = session?.user?.id || data?.user?.id;

                    if (userId) {
                        const { error: updateError } = await supabase
                            .from('profiles')
                            .update({ has_password: true })
                            .eq('id', userId);

                        if (updateError) {
                            console.warn('Could not update has_password flag:', updateError);
                        } else {
                            console.log('has_password flag updated successfully');
                        }

                        // Also update local cache if it exists
                        try {
                            const cachedProfile = JSON.parse(localStorage.getItem('eventhive_profile_cache') || '{}');
                            if (cachedProfile.profile) {
                                cachedProfile.profile.has_password = true;
                            } else {
                                cachedProfile.has_password = true;
                            }
                            localStorage.setItem('eventhive_profile_cache', JSON.stringify(cachedProfile));
                        } catch (cacheErr) {
                            console.warn('Could not update local cache:', cacheErr);
                        }
                    }
                } catch (flagErr) {
                    // Non-critical - password was still set successfully
                    console.warn('Error updating has_password flag:', flagErr);
                }

                showSuccess('Your password has been set successfully! Redirecting to login...');
                passwordForm.style.display = 'none';

                // Clean up URL tokens
                if (window.history.replaceState) {
                    window.history.replaceState(null, null, window.location.pathname);
                }

                // Clean up subscription
                if (subscription) {
                    subscription.unsubscribe();
                }

                // Redirect to homepage
                setTimeout(() => {
                    window.location.href = 'eventhive-homepage.html';
                }, 2500);

            } catch (err) {
                console.error('Error setting password:', err);

                let errorMsg = 'Failed to set password.';

                if (err.message) {
                    const msg = err.message.toLowerCase();
                    if (msg.includes('session') || msg.includes('expired') || msg.includes('invalid')) {
                        errorMsg = 'Your password reset link has expired or is invalid. Please request a new one from the Profile Edit page.';
                    } else if (msg.includes('password') && msg.includes('weak')) {
                        errorMsg = 'Password is too weak. Please choose a stronger password.';
                    } else if (msg.includes('network')) {
                        errorMsg = 'Network error. Please check your connection and try again.';
                    } else {
                        errorMsg = 'Failed to set password: ' + err.message;
                    }
                }

                showError(errorMsg);

                submitBtn.disabled = false;
                submitBtn.textContent = 'Set Password';
            }
        });
    }
});
