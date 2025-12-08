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

  // Username changed? (username and full_name are separate entities)
  if (username !== originalProfileData.username) {
    updateData.username = username;
    // Note: full_name is NOT synced with username - they are separate
  }

  // Bio changed? (empty means "don't change" - keep existing)
  if (bio && bio !== originalProfileData.bio) {
    updateData.bio = bio;
  }

  // Check if profile picture is being changed
  const profilePicFile = profilePicInput && profilePicInput.files && profilePicInput.files[0] ? profilePicInput.files[0] : null;

  // Check if cover photo is being changed
  const coverPhotoFile = coverPhotoInput && coverPhotoInput.files && coverPhotoInput.files[0] ? coverPhotoInput.files[0] : null;

  // Check if anything actually changed (including images)
  if (Object.keys(updateData).length === 0 && !profilePicFile && !coverPhotoFile) {
    alert('No changes detected.');
    window.location.href = 'eventhive-profile.html';
    return false;
  }

  // Save to Supabase (pass image files too)
  if (typeof updateUserProfile === 'function') {
    saveProfileToSupabase(updateData, profilePicFile, coverPhotoFile);
  } else {
    alert('Profile update functionality not available. Please check Supabase configuration.');
    return false;
  }

  // Don't navigate yet - wait for save to complete
  return false;
}

// Save profile data to Supabase
async function saveProfileToSupabase(profileData, avatarFile = null, coverFile = null) {
  try {
    // Show loading state
    const confirmBtn = document.querySelector('.confirm-btn');
    if (confirmBtn) {
      confirmBtn.textContent = 'Saving...';
      confirmBtn.disabled = true;
    }

    // Check if username is being changed and if new username is taken
    if (profileData.username && profileData.username !== originalProfileData.username) {
      // Get user ID from localStorage (fast, no async call)
      let currentUserId = localStorage.getItem('eventhive_last_authenticated_user_id');

      // Fallback: try auth cache
      if (!currentUserId) {
        try {
          const authCacheStr = localStorage.getItem('eventhive_auth_cache');
          if (authCacheStr) {
            const authCache = JSON.parse(authCacheStr);
            currentUserId = authCache.userId;
          }
        } catch (e) {
          console.warn('Error reading auth cache:', e);
        }
      }

      if (currentUserId) {
        // Use direct fetch API to check username availability (prevents hanging)
        const SUPABASE_URL = window.__EH_SUPABASE_URL;
        const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          try {
            const checkController = new AbortController();
            const checkTimeout = setTimeout(() => checkController.abort(), 10000);

            const checkResponse = await fetch(
              `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(profileData.username)}&id=neq.${currentUserId}&select=id`,
              {
                method: 'GET',
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Content-Type': 'application/json'
                },
                signal: checkController.signal
              }
            );

            clearTimeout(checkTimeout);

            if (checkResponse.ok) {
              const existingUsers = await checkResponse.json();
              if (Array.isArray(existingUsers) && existingUsers.length > 0) {
                alert('Username Unavailable\n\nThe username "' + profileData.username + '" is already taken.\n\nPlease choose a different username.');
                if (confirmBtn) {
                  confirmBtn.textContent = 'Confirm Changes';
                  confirmBtn.disabled = false;
                }
                return;
              }
            }
          } catch (checkErr) {
            if (checkErr.name === 'AbortError') {
              console.warn('Username check timed out, proceeding anyway');
            } else {
              console.warn('Error checking username availability:', checkErr);
            }
            // Continue with save even if check fails
          }
        }
      }
    }

    // Upload avatar if provided
    if (avatarFile && typeof uploadProfileImage === 'function') {
      if (confirmBtn) confirmBtn.textContent = 'Uploading avatar...';
      const avatarResult = await uploadProfileImage(avatarFile, 'avatar');
      if (avatarResult.success && avatarResult.url) {
        profileData.avatarUrl = avatarResult.url;
        console.log('Avatar uploaded:', avatarResult.url);
      } else {
        console.error('Avatar upload failed:', avatarResult.error);
        alert('Failed to upload avatar: ' + (avatarResult.error || 'Unknown error'));
        if (confirmBtn) {
          confirmBtn.textContent = 'Confirm Changes';
          confirmBtn.disabled = false;
        }
        return;
      }
    }

    // Upload cover photo if provided
    if (coverFile && typeof uploadProfileImage === 'function') {
      if (confirmBtn) confirmBtn.textContent = 'Uploading cover...';
      const coverResult = await uploadProfileImage(coverFile, 'cover');
      if (coverResult.success && coverResult.url) {
        profileData.coverPhotoUrl = coverResult.url;
        console.log('Cover photo uploaded:', coverResult.url);
      } else {
        console.error('Cover upload failed:', coverResult.error);
        alert('Failed to upload cover photo: ' + (coverResult.error || 'Unknown error'));
        if (confirmBtn) {
          confirmBtn.textContent = 'Confirm Changes';
          confirmBtn.disabled = false;
        }
        return;
      }
    }

    if (confirmBtn) confirmBtn.textContent = 'Saving...';
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

  // IMMEDIATE: Try to populate from cache first so fields aren't blank while loading
  try {
    const profileCacheStr = localStorage.getItem('eventhive_profile_cache');
    if (profileCacheStr) {
      const cache = JSON.parse(profileCacheStr);
      if (cache.profile) {
        const cachedProfile = cache.profile;

        // Populate username immediately from cache
        const usernameInput = document.querySelector('.user-details-edit .input-mimic-h2');
        if (usernameInput) {
          let usernameValue = cachedProfile.username;
          if (!usernameValue && cachedProfile.email) {
            usernameValue = cachedProfile.email.split('@')[0];
          }
          if (usernameValue) {
            usernameInput.value = usernameValue;
            usernameInput.placeholder = usernameValue;
          }
        }

        // Populate email immediately from cache
        const emailDisplay = document.querySelector('.email-display');
        if (emailDisplay && cachedProfile.email) {
          emailDisplay.textContent = cachedProfile.email;
        }

        // Populate bio immediately from cache
        const bioTextarea = document.querySelector('.description-box .textarea-mimic-p');
        if (bioTextarea && cachedProfile.bio) {
          bioTextarea.value = cachedProfile.bio;
        }
      }
    }
  } catch (e) {
    console.warn('Error loading profile from cache:', e);
  }

  // ASYNC: Load fresh profile data from Supabase (will overwrite cache values if newer)
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
        // Use profile.email directly or fallback to Supabase session
        const emailDisplay = document.querySelector('.email-display');
        if (emailDisplay) {
          let emailFound = false;

          // Try profile email first
          if (profile.email) {
            emailDisplay.textContent = profile.email;
            emailFound = true;
          }

          // Fallback 1: localStorage cache
          if (!emailFound) {
            try {
              const profileCacheStr = localStorage.getItem('eventhive_profile_cache');
              if (profileCacheStr) {
                const cache = JSON.parse(profileCacheStr);
                if (cache.profile && cache.profile.email) {
                  emailDisplay.textContent = cache.profile.email;
                  emailFound = true;
                }
              }
            } catch (e) {
              // Ignore cache errors
            }
          }

          // Fallback 2: Get from Supabase session
          if (!emailFound && typeof getSupabaseClient === 'function') {
            const supabase = getSupabaseClient();
            if (supabase) {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session && session.user && session.user.email) {
                  emailDisplay.textContent = session.user.email;
                  emailFound = true;
                }
              } catch (e) {
                console.warn('Error getting email from session:', e);
              }
            }
          }

          // Final fallback
          if (!emailFound) {
            emailDisplay.textContent = 'No email';
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
