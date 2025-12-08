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
      // IMPORTANT: Clear the old profile cache so profile page loads fresh data
      localStorage.removeItem('eventhive_profile_cache');
      console.log('Profile cache cleared after update');

      // Also update the auth cache with new username if changed
      if (profileData.username) {
        try {
          const authCacheStr = localStorage.getItem('eventhive_auth_cache');
          if (authCacheStr) {
            const authCache = JSON.parse(authCacheStr);
            // Don't update timestamp - just update the data
            localStorage.setItem('eventhive_auth_cache', JSON.stringify(authCache));
          }
        } catch (e) {
          console.warn('Error updating auth cache:', e);
        }
      }

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

        // Populate username field - use username only (not full_name)
        // If no username, derive from email (e.g., axel.magallanes from axel.magallanes@tup.edu.ph)
        const usernameInput = document.querySelector('.user-details-edit .input-mimic-h2');
        if (usernameInput) {
          let usernameValue = profile.username;
          if (!usernameValue && profile.email) {
            // Derive username from email
            usernameValue = profile.email.split('@')[0];
          }
          usernameInput.value = usernameValue || '';
          usernameInput.placeholder = usernameValue || 'Username';
        }

        // Display email (read-only - email cannot be changed)
        // Use profile.email directly or fallback to localStorage cache
        const emailDisplay = document.querySelector('.email-display');
        if (emailDisplay) {
          // Try profile email first
          if (profile.email) {
            emailDisplay.textContent = profile.email;
          } else {
            // Fallback to localStorage auth/profile cache
            try {
              const profileCacheStr = localStorage.getItem('eventhive_profile_cache');
              if (profileCacheStr) {
                const cache = JSON.parse(profileCacheStr);
                if (cache.profile && cache.profile.email) {
                  emailDisplay.textContent = cache.profile.email;
                } else {
                  emailDisplay.textContent = 'No email';
                }
              } else {
                emailDisplay.textContent = 'No email';
              }
            } catch (e) {
              emailDisplay.textContent = 'No email';
            }
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

        // Store original values for change detection - username only (not full_name)
        let originalUsername = profile.username;
        if (!originalUsername && profile.email) {
          originalUsername = profile.email.split('@')[0];
        }
        originalProfileData.username = originalUsername || '';
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

      // Validate that new password fields exist and are filled
      if (!newPass || !confirmPass) {
        alert('Please fill in the new password fields.');
        return;
      }

      if (!newPass.value || !confirmPass.value) {
        alert('Please enter your new password and confirm it.');
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
      const confirmPass = document.querySelector('.pass-input[placeholder*="Confirm"]');

      if (typeof getSupabaseClient === 'function') {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const currentPassValue = currentPass ? currentPass.value.trim() : '';

            // If user provided current password, we should verify it first
            // For OAuth users (no password set), current password can be empty
            if (currentPassValue) {
              // User has existing password - get their email and verify current password
              const { data: sessionData } = await supabase.auth.getSession();
              const userEmail = sessionData?.session?.user?.email;

              if (userEmail) {
                // Try to sign in with current password to verify it
                const { error: verifyError } = await supabase.auth.signInWithPassword({
                  email: userEmail,
                  password: currentPassValue
                });

                if (verifyError) {
                  alert('Current password is incorrect. Please try again.');
                  return;
                }
              }
            }

            // Update password using Supabase Auth
            // This works for both OAuth users (setting password for first time)
            // and regular users (changing password)
            const { error } = await supabase.auth.updateUser({
              password: newPass.value
            });

            if (error) {
              // Check if it's a reauthentication error
              if (error.message.includes('reauthentication') || error.message.includes('reauth')) {
                alert('For security, please use "Forgot Password" to reset your password, or re-login and try again.');
              } else {
                alert('Failed to update password: ' + error.message);
              }
            } else {
              alert('Password updated successfully!');
              // Clear password fields
              if (currentPass) currentPass.value = '';
              if (newPass) newPass.value = '';
              if (confirmPass) confirmPass.value = '';
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
