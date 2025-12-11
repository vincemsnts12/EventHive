/* =========================================
   1. Password Toggle Functionality
   Only initialize if not already done by another script
   ========================================= */
function initPasswordToggles() {
    // Skip if already initialized by another script (e.g., eventhive-pop-up__log&sign.js)
    if (window.__passwordTogglesInitialized) {
        console.log('Password toggles already initialized by another script');
        return;
    }

    const passwordToggles = document.querySelectorAll('.password-toggle');
    if (passwordToggles.length === 0) return;

    passwordToggles.forEach(toggle => {
        // Skip if this toggle already has a click handler
        if (toggle.dataset.initialized === 'true') return;

        const targetId = toggle.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const showIcon = toggle.querySelector('.icon-show');
        const hideIcon = toggle.querySelector('.icon-hide');

        if (input) {
            // Initialize icon visibility based on current input type
            if (input.type === 'text') {
                if (showIcon) showIcon.style.display = 'none';
                if (hideIcon) hideIcon.style.display = 'inline-block';
            } else {
                if (showIcon) showIcon.style.display = 'inline-block';
                if (hideIcon) hideIcon.style.display = 'none';
            }
        }

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tgt = document.getElementById(toggle.getAttribute('data-target'));
            if (tgt) {
                const wasPassword = tgt.type === 'password';
                tgt.type = wasPassword ? 'text' : 'password';

                // Get fresh references to icons
                const showI = toggle.querySelector('.icon-show');
                const hideI = toggle.querySelector('.icon-hide');

                if (wasPassword) {
                    if (showI) showI.style.display = 'none';
                    if (hideI) hideI.style.display = 'inline-block';
                } else {
                    if (showI) showI.style.display = 'inline-block';
                    if (hideI) hideI.style.display = 'none';
                }
            }
        });

        // Mark as initialized
        toggle.dataset.initialized = 'true';
    });

    // Mark global initialization complete
    window.__passwordTogglesInitialized = true;
}

/* =========================================
   2. Image Preview Logic
   Triggered via onchange="previewImage(...)" in HTML
   ========================================= */
function previewImage(input, imgId) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function (e) {
            const imgElement = document.getElementById(imgId);
            if (imgElement) {
                imgElement.src = e.target.result;
            }
        }

        reader.readAsDataURL(input.files[0]);
    }
}

/* =========================================
   3. Main Profile "Confirm Changes" Logic
   Triggered via onclick="return confirmMainChanges()" in HTML
   ========================================= */
// confirmMainChanges is now defined in eventhive-profile-edit-save.js
// This function is kept for backward compatibility but will be overridden
function confirmMainChanges() {
    // This will be handled by eventhive-profile-edit-save.js
    return false;
}

/* =========================================
   4. Password Toggle Initialization
   The actual save password logic is handled by
   eventhive-profile-edit-save.js
   ========================================= */
document.addEventListener('DOMContentLoaded', function () {
    // Initialize password toggles
    initPasswordToggles();

    // Initialize image removal handlers
    initImageRemovalHandlers();

    // Initialize OAuth user password blocking
    initOAuthPasswordBlocking();
});

/* =========================================
   4b. OAuth User Password Field Blocking
   Blocks OAuth users who haven't set a password
   from accessing password update fields
   ========================================= */
function initOAuthPasswordBlocking() {
    const passwordSection = document.getElementById('passwordSection') || document.querySelector('.password-container');
    const lockOverlay = document.getElementById('passwordLockOverlay');
    const forgotBtn = document.getElementById('lockForgotPasswordBtn');

    if (!passwordSection || !lockOverlay) {
        console.log('Password section or lock overlay not found');
        return;
    }

    // Check if user has a password set - try multiple cache locations
    let hasPassword = false;
    let userEmail = null;

    // Try eventhive_profile_cache first
    const cachedProfile = JSON.parse(localStorage.getItem('eventhive_profile_cache') || '{}');
    const profileData = cachedProfile.profile || cachedProfile;
    hasPassword = profileData.has_password === true;
    userEmail = profileData.email;

    // Check eventhive_profile_cache (standardized key)

    console.log('OAuth Password Blocking - hasPassword:', hasPassword, 'email:', userEmail);

    // Show lock overlay if user doesn't have a password
    if (!hasPassword) {
        lockOverlay.style.display = 'flex';
        passwordSection.classList.add('locked');
    } else {
        lockOverlay.style.display = 'none';
        passwordSection.classList.remove('locked');
    }

    // Handle forgot password button click
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async function () {
            // Get user email from multiple cache sources at click time
            let emailToUse = null;

            // Try eventhive_profile_cache
            try {
                const profCache = JSON.parse(localStorage.getItem('eventhive_profile_cache') || '{}');
                emailToUse = profCache.profile?.email || profCache.email;
            } catch (e) { }

            // Try to get from Supabase session directly
            if (!emailToUse && typeof getSupabaseClient === 'function') {
                try {
                    const supabase = getSupabaseClient();
                    if (supabase) {
                        const { data: { session } } = await supabase.auth.getSession();
                        emailToUse = session?.user?.email;
                    }
                } catch (e) {
                    console.error('Error getting session:', e);
                }
            }

            console.log('Forgot password - email found:', emailToUse);

            if (!emailToUse) {
                alert('Could not find your email address. Please try logging in again.');
                return;
            }

            // Check rate limiting (server-side)
            if (typeof checkForgotPasswordRateLimit === 'function') {
                const rateLimit = await checkForgotPasswordRateLimit(emailToUse);
                if (!rateLimit.allowed) {
                    const waitMins = rateLimit.nextAllowedTime
                        ? Math.ceil((rateLimit.nextAllowedTime.getTime() - Date.now()) / 60000)
                        : 60;
                    alert(`Too many password reset requests.\n\nPlease wait ${waitMins} minutes before trying again.`);
                    return;
                }
            }

            // Show loading state
            forgotBtn.disabled = true;
            const originalHTML = forgotBtn.innerHTML;
            forgotBtn.innerHTML = 'Sending...';

            try {
                // Get Supabase client and send password reset email
                if (typeof getSupabaseClient === 'function') {
                    const supabase = getSupabaseClient();
                    if (supabase) {
                        const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
                            redirectTo: window.location.origin + '/eventhive-set-password.html'
                        });

                        if (error) {
                            console.error('Password reset error:', error);
                            const errorMsg = (error.message || '').toLowerCase();
                            if (errorMsg.includes('rate limit') || errorMsg.includes('too many')) {
                                alert('Too Many Requests\n\nPlease wait a few minutes before requesting another password reset email.');
                            } else if (errorMsg.includes('not found') || errorMsg.includes('no user')) {
                                alert('Email Not Found\n\nNo account is associated with this email address.\n\nPlease check your email or sign up for a new account.');
                            } else {
                                alert('Error Sending Email\n\nWe couldn\'t send the password reset email.\n\nPlease try again later or contact support if the problem persists.');
                            }
                        } else {
                            // Record the request for rate limiting (server-side)
                            if (typeof recordForgotPasswordRequest === 'function') {
                                await recordForgotPasswordRequest(emailToUse);
                            }
                            alert('Password setup email sent to ' + emailToUse + '!\n\nPlease check your inbox and click the link to set your password.\n\nNote: The link expires in 1 hour.');
                        }
                    } else {
                        alert('Could not connect to authentication service.');
                    }
                } else {
                    alert('Authentication service is not available. Please try again later.');
                }
            } catch (err) {
                console.error('Error sending password reset:', err);
                alert('An error occurred: ' + err.message);
            } finally {
                // Restore button
                forgotBtn.disabled = false;
                forgotBtn.innerHTML = originalHTML;
            }
        });
    }
}

/* =========================================
   5. Image Removal Handlers
   Shows/hides trash icons and handles clearing
   ========================================= */

// Track which images are marked for removal
window.__EH_REMOVE_AVATAR = false;
window.__EH_REMOVE_COVER = false;

function initImageRemovalHandlers() {
    const removeAvatarBtn = document.getElementById('removeAvatarBtn');
    const removeCoverBtn = document.getElementById('removeCoverBtn');
    const profileImg = document.getElementById('profileImgDisplay');
    const coverImg = document.getElementById('coverImgDisplay');
    const profilePlaceholder = document.getElementById('profileInitialsPlaceholder');
    const coverPhoto = document.querySelector('.cover-photo');

    // Avatar removal handler
    if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Mark avatar for removal
            window.__EH_REMOVE_AVATAR = true;

            // Hide the image and show initials placeholder
            if (profileImg) {
                profileImg.style.display = 'none';
            }

            // Generate initials and show placeholder
            if (profilePlaceholder) {
                const authCache = JSON.parse(localStorage.getItem('eventhive_auth_cache') || '{}');
                const cachedProfile = JSON.parse(localStorage.getItem('eventhive_profile_cache') || '{}');
                const username = cachedProfile.username || authCache.username || 'U';
                const initials = username.substring(0, 2).toUpperCase();
                const bgColor = stringToColorForEdit(username);

                profilePlaceholder.textContent = initials;
                profilePlaceholder.style.backgroundColor = bgColor;
                profilePlaceholder.style.display = 'flex';
            }

            // Hide the trash button
            removeAvatarBtn.style.display = 'none';

            // Reset file input
            const profileInput = document.getElementById('profileUpload');
            if (profileInput) profileInput.value = '';

            console.log('Avatar marked for removal');
        });
    }

    // Cover removal handler
    if (removeCoverBtn) {
        removeCoverBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Mark cover for removal
            window.__EH_REMOVE_COVER = true;

            // Hide the image and show placeholder color
            if (coverImg) {
                coverImg.style.display = 'none';
            }
            if (coverPhoto) {
                coverPhoto.classList.add('no-cover');
            }

            // Hide the trash button
            removeCoverBtn.style.display = 'none';

            // Reset file input
            const coverInput = document.getElementById('coverUpload');
            if (coverInput) coverInput.value = '';

            console.log('Cover photo marked for removal');
        });
    }
}

// Helper function to generate color from string (same as in dropdownmenu.js)
function stringToColorForEdit(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 45%, 45%)`;
}

// Show/hide remove buttons based on whether there's an image
function updateRemoveButtonVisibility(hasAvatar, hasCover) {
    const removeAvatarBtn = document.getElementById('removeAvatarBtn');
    const removeCoverBtn = document.getElementById('removeCoverBtn');

    if (removeAvatarBtn) {
        removeAvatarBtn.style.display = hasAvatar ? 'flex' : 'none';
    }
    if (removeCoverBtn) {
        removeCoverBtn.style.display = hasCover ? 'flex' : 'none';
    }
}

// Override previewImage to show remove button when new image selected
const originalPreviewImage = window.previewImage;
function previewImage(input, imgId) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function (e) {
            const imgElement = document.getElementById(imgId);
            if (imgElement) {
                imgElement.src = e.target.result;
                imgElement.style.display = 'block';
            }

            // Show the remove button and reset removal flag
            if (imgId === 'profileImgDisplay') {
                // Avatar changed - show remove button
                window.__EH_REMOVE_AVATAR = false;
                const removeBtn = document.getElementById('removeAvatarBtn');
                const placeholder = document.getElementById('profileInitialsPlaceholder');
                if (removeBtn) removeBtn.style.display = 'flex';
                if (placeholder) placeholder.style.display = 'none';
            } else if (imgId === 'coverImgDisplay') {
                // Cover photo changed - show remove button
                window.__EH_REMOVE_COVER = false;
                const removeBtn = document.getElementById('removeCoverBtn');
                const coverPhoto = document.querySelector('.cover-photo');
                if (removeBtn) removeBtn.style.display = 'flex';
                if (coverPhoto) coverPhoto.classList.remove('no-cover');
            }
        }

        reader.readAsDataURL(input.files[0]);
    }
}
