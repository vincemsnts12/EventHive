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
            if(imgElement) {
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
   4. Password Confirmation Modal Logic
   Waits for DOM to load to ensure elements exist
   ========================================= */
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize password toggles
    initPasswordToggles();
    
    const savePassBtn = document.getElementById('savePassBtn');
    const modal = document.getElementById('passConfirmModal');
    const noBtn = document.getElementById('cancelPassBtn');
    const yesBtn = document.getElementById('confirmPassBtn');

    // Only run if elements exist (prevents errors on other pages)
    if (savePassBtn && modal && noBtn && yesBtn) {
        
        // OPEN Modal
        savePassBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default form submission if inside a form tag
            modal.style.display = 'flex';
        });

        // CLOSE Modal (No)
        noBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'none';
        });

        // CONFIRM Action (Yes)
        yesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert("Password updated successfully!");
            modal.style.display = 'none';
            
            // Clear inputs for UX
            document.querySelectorAll('.pass-input').forEach(input => input.value = '');
        });

        // CLOSE Modal (Click Outside)
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        }
    }
});