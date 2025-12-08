// ===== PASSWORD SETUP PAGE HANDLER =====
// This handles setting password for OAuth users who click the password reset link
// The page detects the recovery token from URL and uses it to set the password

document.addEventListener('DOMContentLoaded', async () => {
    const loadingState = document.getElementById('loadingState');
    const invalidLinkState = document.getElementById('invalidLinkState');
    const passwordFormState = document.getElementById('passwordFormState');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const passwordForm = document.getElementById('passwordForm');
    const submitBtn = document.getElementById('submitBtn');

    // Initialize Supabase
    if (typeof initSupabase === 'function') {
        initSupabase();
    }

    // Check if we have a recovery session from the URL
    // Supabase password reset links contain access_token in the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const tokenType = hashParams.get('type');
    const refreshToken = hashParams.get('refresh_token');

    // Also check URL search params (some Supabase versions use this)
    const searchParams = new URLSearchParams(window.location.search);
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    // Handle error from Supabase
    if (errorCode || errorDescription) {
        showInvalidLink();
        console.warn('Password reset error:', errorCode, errorDescription);
        return;
    }

    // Check if this is a valid recovery link
    if (tokenType === 'recovery' && accessToken) {
        // Valid recovery link - set up the session
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                showInvalidLink();
                return;
            }

            // Set the session from the recovery tokens
            const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
            });

            if (error) {
                console.warn('Error setting recovery session:', error.message);
                showInvalidLink();
                return;
            }

            // Session set successfully - show password form
            showPasswordForm();
        } catch (err) {
            console.error('Error processing recovery link:', err);
            showInvalidLink();
        }
    } else {
        // Check if user already has an active session (maybe they navigated here directly)
        try {
            const supabase = getSupabaseClient();
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    // User is logged in - they can set password
                    showPasswordForm();
                } else {
                    // No session and no recovery token - invalid link
                    showInvalidLink();
                }
            } else {
                showInvalidLink();
            }
        } catch (err) {
            console.error('Error checking session:', err);
            showInvalidLink();
        }
    }

    // Handle form submission
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Clear previous messages
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
                // Fallback validation if security-services.js not loaded
                if (newPassword.length < 8) {
                    showError('Password must be at least 8 characters long.');
                    return;
                }
            }

            // Disable button and show loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Setting Password...';

            try {
                const supabase = getSupabaseClient();
                if (!supabase) {
                    showError('Unable to connect to authentication service. Please try again.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Set Password';
                    return;
                }

                // Update the user's password
                const { data, error } = await supabase.auth.updateUser({
                    password: newPassword
                });

                if (error) {
                    console.error('Password update error:', error);

                    if (error.message.includes('session') || error.message.includes('expired')) {
                        showError('Your password reset link has expired. Please request a new one.');
                    } else {
                        showError('Failed to set password: ' + error.message);
                    }

                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Set Password';
                    return;
                }

                // Success!
                showSuccess('Your password has been set successfully! You can now log in with your email and password.');

                // Clear the form
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';

                // Hide the form and show success
                passwordForm.style.display = 'none';

                // Clear the URL hash (remove tokens)
                if (window.history.replaceState) {
                    window.history.replaceState(null, null, window.location.pathname);
                }

                // Redirect to homepage after a delay
                setTimeout(() => {
                    window.location.href = 'eventhive-homepage.html';
                }, 3000);

            } catch (err) {
                console.error('Error setting password:', err);
                showError('An unexpected error occurred. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Set Password';
            }
        });
    }

    // Helper functions
    function showPasswordForm() {
        loadingState.style.display = 'none';
        invalidLinkState.style.display = 'none';
        passwordFormState.style.display = 'block';
    }

    function showInvalidLink() {
        loadingState.style.display = 'none';
        invalidLinkState.style.display = 'block';
        passwordFormState.style.display = 'none';
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
});
