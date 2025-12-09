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
});

/* =========================================
   5. Image Removal Handlers
   Shows/hides trash icons and handles clearing
   ========================================= */

// Track which images are marked for removal
window.__EH_REMOVE_AVATAR = false; // Kept for compatibility, but not used since avatar defaults to initials
window.__EH_REMOVE_COVER = false;

function initImageRemovalHandlers() {
    const removeCoverBtn = document.getElementById('removeCoverBtn');
    const coverImg = document.getElementById('coverImgDisplay');
    const coverPhoto = document.querySelector('.cover-photo');

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

// Show/hide cover remove button based on whether there's an image
function updateRemoveButtonVisibility(hasAvatar, hasCover) {
    // Note: Avatar remove button removed - avatar always defaults to initials
    const removeCoverBtn = document.getElementById('removeCoverBtn');
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
                // Avatar changed - reset removal flag (but no remove button since avatar defaults to initials)
                window.__EH_REMOVE_AVATAR = false;
                const placeholder = document.getElementById('profileInitialsPlaceholder');
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
