/* =========================================
   1. Password Toggle Functionality
   ========================================= */
function initPasswordToggles() {
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        const targetId = toggle.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const showIcon = toggle.querySelector('.icon-show');
        const hideIcon = toggle.querySelector('.icon-hide');
        if (input) {
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
            const tgt = document.getElementById(toggle.getAttribute('data-target'));
            if (tgt) {
                const wasPassword = tgt.type === 'password';
                tgt.type = wasPassword ? 'text' : 'password';
                if (wasPassword) {
                    if (showIcon) showIcon.style.display = 'none';
                    if (hideIcon) hideIcon.style.display = 'inline-block';
                } else {
                    if (showIcon) showIcon.style.display = 'inline-block';
                    if (hideIcon) hideIcon.style.display = 'none';
                }
            }
        });
    });
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
    const passwordFormWrapper = document.querySelector('.password-form-wrapper');
    const lockOverlay = document.getElementById('passwordLockOverlay');
    const forgotBtn = document.getElementById('lockForgotPasswordBtn');

    if (!passwordFormWrapper || !lockOverlay) return;

    // Check if user has a password set
    const cachedProfile = JSON.parse(localStorage.getItem('eventhive_profile_cache') || '{}');
    const profileData = cachedProfile.profile || cachedProfile;
    const hasPassword = profileData.has_password === true;

    // Show lock overlay if user doesn't have a password
    if (!hasPassword) {
        lockOverlay.style.display = 'flex';
        passwordFormWrapper.classList.add('locked');
    } else {
        lockOverlay.style.display = 'none';
        passwordFormWrapper.classList.remove('locked');
    }

    // Handle forgot password button click
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async function () {
            // Get user email from cache
            const authCache = JSON.parse(localStorage.getItem('eventhive_auth_cache') || '{}');
            const userEmail = profileData.email || authCache.state?.email;

            if (!userEmail) {
                alert('Could not find your email address. Please try logging in again.');
                return;
            }

            // Show loading state
            forgotBtn.disabled = true;
            forgotBtn.innerHTML = 'Sending...';

            try {
                // Get Supabase client and send password reset email
                if (typeof getSupabaseClient === 'function') {
                    const supabase = getSupabaseClient();
                    if (supabase) {
                        const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
                            redirectTo: window.location.origin + '/eventhive-set-password.html'
                        });

                        if (error) {
                            alert('Error sending email: ' + error.message);
                        } else {
                            alert('Password setup email sent to ' + userEmail + '!\n\nPlease check your inbox and click the link to set your password.');
                        }
                    }
                } else {
                    alert('Authentication service is not available. Please try again later.');
                }
            } catch (err) {
                console.error('Error sending password reset:', err);
                alert('An error occurred. Please try again.');
            } finally {
                // Restore button
                forgotBtn.disabled = false;
                forgotBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    Send Password Setup Email
                `;
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
                const authCache = JSON.parse(localStorage.getItem('eh_auth_cache') || '{}');
                const cachedProfile = JSON.parse(localStorage.getItem('eh_cached_profile') || '{}');
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
