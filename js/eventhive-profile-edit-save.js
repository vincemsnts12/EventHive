// ===== PROFILE EDIT SAVE FUNCTIONALITY =====
// Handles saving profile changes to Supabase

// Store original values to compare against
let originalProfileData = {
  username: '',
  bio: ''
};

// Update the confirmMainChanges function to save to Supabase
function confirmMainChanges() {
  // Get form values
  const usernameInput = document.querySelector('.user-details-edit .input-mimic-h2');
  const emailInput = document.querySelector('.user-details-edit .input-mimic-p');
  const bioTextarea = document.querySelector('.description-box .textarea-mimic-p');
  const profilePicInput = document.getElementById('profileUpload');
  const coverPhotoInput = document.getElementById('coverUpload');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const bio = bioTextarea ? bioTextarea.value.trim() : '';

  // Validate username - REQUIRED field
  if (!username) {
    alert('Username is required. Please enter a username.');
    if (usernameInput) usernameInput.focus();
    return false;
  }

  if (typeof validateUsername === 'function') {
    const validatedUsername = validateUsername(username);
    if (!validatedUsername) {
      alert('Invalid username format. Username must be 3-30 characters, alphanumeric and underscores only.');
      return false;
    }
  }

  if (bio && bio.length > 500) {
    alert('Bio cannot exceed 500 characters.');
    return false;
  }

  // Build update object - only include fields that have changed
  const updateData = {};

  // Username changed?
  if (username !== originalProfileData.username) {
    updateData.username = username;
    updateData.fullName = username; // Keep fullName in sync with username
  }

  // Bio changed? (empty means "don't change" - keep existing)
  if (bio && bio !== originalProfileData.bio) {
    updateData.bio = bio;
  }

  // Check if anything actually changed
  if (Object.keys(updateData).length === 0) {
    alert('No changes detected.');
    window.location.href = 'eventhive-profile.html';
    return false;
  }

  // Save to Supabase
  if (typeof updateUserProfile === 'function') {
    saveProfileToSupabase(updateData);
  } else {
    alert('Profile update functionality not available. Please check Supabase configuration.');
    return false;
  }

  // Don't navigate yet - wait for save to complete
  return false;
}

// Save profile data to Supabase
async function saveProfileToSupabase(profileData) {
  try {
    // Show loading state
    const confirmBtn = document.querySelector('.confirm-btn');
    if (confirmBtn) {
      confirmBtn.textContent = 'Saving...';
      confirmBtn.disabled = true;
    }

    // Check if username is being changed and if new username is taken
    if (profileData.username && profileData.username !== originalProfileData.username) {
      if (typeof getSupabaseClient === 'function') {
        const supabase = getSupabaseClient();
        if (supabase) {
          // Use localStorage cached user ID instead of getCurrentUser() to avoid auth hanging
          let currentUserId = null;
          try {
            const authCacheStr = localStorage.getItem('eventhive_auth_cache');
            if (authCacheStr) {
              const authCache = JSON.parse(authCacheStr);
              currentUserId = authCache.userId;
            }
          } catch (e) {
            console.warn('Error reading auth cache:', e);
          }

          if (currentUserId) {
            // Check if username is taken by someone else
            const { data: existingUser, error: checkError } = await supabase
              .from('profiles')
              .select('id')
              .eq('username', profileData.username)
              .neq('id', currentUserId) // Exclude current user
              .single();

            if (existingUser) {
              alert('Username Unavailable\n\nThe username "' + profileData.username + '" is already taken.\n\nPlease choose a different username.');
              if (confirmBtn) {
                confirmBtn.textContent = 'Confirm Changes';
                confirmBtn.disabled = false;
              }
              return;
            }
          }
        }
      }
    }

    const result = await updateUserProfile(profileData);

    if (result.success) {
      alert('Profile updated successfully!');
      // Navigate back to profile page
      window.location.href = 'eventhive-profile.html';
    } else {
      alert('Failed to update profile: ' + (result.error || 'Unknown error'));
      // Re-enable button
      if (confirmBtn) {
        confirmBtn.textContent = 'Confirm Changes';
        confirmBtn.disabled = false;
      }
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    alert('An error occurred while saving your profile. Please try again.');
    // Re-enable button
    const confirmBtn = document.querySelector('.confirm-btn');
    if (confirmBtn) {
      confirmBtn.textContent = 'Confirm Changes';
      confirmBtn.disabled = false;
    }
  }
}

// Load current profile data into edit form
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Supabase to initialize
  if (typeof initSupabase === 'function') {
    initSupabase();
  }

  // Load current profile data
  if (typeof getUserProfile === 'function') {
    try {
      const result = await getUserProfile();

      if (result.success && result.profile) {
        const profile = result.profile;

        // Populate username field
        const usernameInput = document.querySelector('.user-details-edit .input-mimic-h2');
        if (usernameInput) {
          usernameInput.value = profile.username || profile.full_name || '';
          usernameInput.placeholder = profile.username || profile.full_name || 'Username';
        }

        // Display email (read-only - email cannot be changed)
        const emailDisplay = document.querySelector('.email-display');
        if (emailDisplay && typeof getCurrentUser === 'function') {
          const userResult = await getCurrentUser();
          if (userResult.success && userResult.user) {
            emailDisplay.textContent = userResult.user.email || 'No email';
          } else {
            emailDisplay.textContent = profile.email || 'No email';
          }
        }

        // Populate bio textarea
        const bioTextarea = document.querySelector('.description-box .textarea-mimic-p');
        if (bioTextarea) {
          bioTextarea.value = profile.bio || '';
          bioTextarea.placeholder = 'Add a bio...';
        }

        // Load profile picture
        const profilePicElement = document.getElementById('profileImgDisplay');
        if (profilePicElement) {
          profilePicElement.src = profile.avatar_url || 'images/prof_default.svg';
        }

        // Load cover photo
        const coverPhotoElement = document.getElementById('coverImgDisplay');
        if (coverPhotoElement && profile.cover_photo_url) {
          coverPhotoElement.src = profile.cover_photo_url;
        }

        // Store original values for change detection
        originalProfileData.username = profile.username || profile.full_name || '';
        originalProfileData.bio = profile.bio || '';

        console.log('Profile data loaded into edit form');
      } else {
        console.warn('Failed to load profile for editing:', result.error);
      }
    } catch (error) {
      console.error('Error loading profile for editing:', error);
    }
  }
});

// Handle password update
document.addEventListener('DOMContentLoaded', function () {
  const savePassBtn = document.getElementById('savePassBtn');
  const modal = document.getElementById('passConfirmModal');
  const noBtn = document.getElementById('cancelPassBtn');
  const yesBtn = document.getElementById('confirmPassBtn');

  if (savePassBtn && modal && noBtn && yesBtn) {
    // OPEN Modal
    savePassBtn.addEventListener('click', (e) => {
      e.preventDefault();

      // Get password inputs
      const currentPass = document.querySelector('.pass-input[placeholder*="current"]');
      const newPass = document.querySelector('.pass-input[placeholder*="new password"]');
      const confirmPass = document.querySelector('.pass-input[placeholder*="Confirm"]');

      // Validate passwords
      if (!currentPass || !newPass || !confirmPass) {
        alert('Please fill in all password fields.');
        return;
      }

      if (newPass.value !== confirmPass.value) {
        alert('New passwords do not match.');
        return;
      }

      // Validate password strength
      if (typeof validatePasswordStrength === 'function') {
        const validation = validatePasswordStrength(newPass.value);
        if (!validation.valid) {
          alert('Password does not meet requirements:\n' + validation.errors.join('\n'));
          return;
        }
      }

      modal.style.display = 'flex';
    });

    // CLOSE Modal (No button)
    noBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // CONFIRM Password Update (Yes button)
    yesBtn.addEventListener('click', async () => {
      modal.style.display = 'none';

      const currentPass = document.querySelector('.pass-input[placeholder*="current"]');
      const newPass = document.querySelector('.pass-input[placeholder*="new password"]');

      if (typeof getSupabaseClient === 'function') {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            // Update password using Supabase Auth
            const { error } = await supabase.auth.updateUser({
              password: newPass.value
            });

            if (error) {
              alert('Failed to update password: ' + error.message);
            } else {
              alert('Password updated successfully!');
              // Clear password fields
              currentPass.value = '';
              newPass.value = '';
              document.querySelector('.pass-input[placeholder*="Confirm"]').value = '';
            }
          } catch (error) {
            console.error('Error updating password:', error);
            alert('An error occurred while updating your password. Please try again.');
          }
        }
      } else {
        alert('Password update functionality not available. Please check Supabase configuration.');
      }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
});


