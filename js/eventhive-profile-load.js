// ===== PROFILE DATA LOADING FROM SUPABASE =====
// Loads user profile data from Supabase and displays it

// Function to apply profile data to UI
function applyProfileToUI(profile, userEmail = null) {
  // Update username - show username only (not full_name)
  // If no username, derive from email (e.g., axel.magallanes from axel.magallanes@tup.edu.ph)
  const usernameElement = document.querySelector('.username');
  if (usernameElement) {
    let displayName = profile.username;
    if (!displayName && profile.email) {
      // Derive username from email
      displayName = profile.email.split('@')[0];
    } else if (!displayName && userEmail) {
      displayName = userEmail.split('@')[0];
    }
    usernameElement.textContent = displayName || 'User';
  }

  // Update email - try profile.email first, then parameter, then fetch from auth
  const emailElement = document.querySelector('.email');
  if (emailElement) {
    // Priority: 1. profile.email, 2. userEmail parameter, 3. fetch from getCurrentUser
    const emailToShow = profile.email || userEmail;
    if (emailToShow) {
      emailElement.textContent = emailToShow;
    } else if (typeof getCurrentUser === 'function') {
      getCurrentUser().then(userResult => {
        if (userResult.success && userResult.user) {
          emailElement.textContent = userResult.user.email || 'No email';
        } else {
          emailElement.textContent = 'No email';
        }
      }).catch(() => {
        emailElement.textContent = 'No email';
      });
    } else {
      emailElement.textContent = 'No email';
    }
  }

  // Update bio/description
  const descriptionElement = document.querySelector('.description-box p');
  if (descriptionElement) {
    descriptionElement.textContent = profile.bio || 'No bio yet. Click "Edit Profile" to add one!';
  }

  // Update profile picture - show initials if no avatar
  const profilePicImg = document.getElementById('profilePicImg') || document.querySelector('.profile-picture img');
  const profileInitials = document.getElementById('profileInitials');

  if (profile.avatar_url) {
    // Show avatar image
    if (profilePicImg) {
      profilePicImg.src = profile.avatar_url;
      profilePicImg.alt = profile.username || 'Profile Picture';
      profilePicImg.style.display = 'block';
    }
    if (profileInitials) {
      profileInitials.style.display = 'none';
    }
  } else {
    // No avatar - show initials
    if (profilePicImg) {
      profilePicImg.style.display = 'none';
    }
    if (profileInitials) {
      const displayName = profile.username || profile.email || userEmail || 'U';
      const initials = getInitialsFromName(displayName);
      const bgColor = stringToColorProfile(displayName);

      profileInitials.textContent = initials;
      profileInitials.style.backgroundColor = bgColor;
      profileInitials.style.display = 'flex';
    }
  }

  // Update cover photo - show placeholder if null
  const coverPhotoImg = document.getElementById('coverPhotoImg') || document.querySelector('.cover-photo img');
  const coverPhotoContainer = document.getElementById('profileCoverPhoto') || document.querySelector('.cover-photo');

  if (profile.cover_photo_url) {
    // Show cover photo
    if (coverPhotoImg) {
      coverPhotoImg.src = profile.cover_photo_url;
      coverPhotoImg.style.display = 'block';
    }
    if (coverPhotoContainer) {
      coverPhotoContainer.classList.remove('no-cover');
    }
  } else {
    // No cover - show placeholder background
    if (coverPhotoImg) {
      coverPhotoImg.style.display = 'none';
    }
    if (coverPhotoContainer) {
      coverPhotoContainer.classList.add('no-cover');
    }
  }
}

// Helper function to generate initials
function getInitialsFromName(name) {
  if (!name) return 'U';
  const parts = name.split(/[\s@]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Helper function to generate color from string
function stringToColorProfile(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 45%, 45%)`;
}

// Get cached profile data
function getCachedProfile() {
  try {
    const cached = localStorage.getItem('eventhive_profile_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const timeSinceCache = now - parsed.timestamp;

      // Return cache if it's less than 5 minutes old
      if (timeSinceCache < 5 * 60 * 1000) {
        return parsed.profile;
      }
    }
  } catch (e) {
    console.error('Error reading profile cache:', e);
  }
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  // Wait for Supabase to initialize (non-blocking)
  if (typeof initSupabase === 'function') {
    initSupabase();
  }

  // Try to load from cache first (instant, synchronous)
  const cachedProfile = getCachedProfile();
  if (cachedProfile) {
    // Apply cached profile immediately (no delay, no async)
    applyProfileToUI(cachedProfile);
    console.log('Profile data loaded from cache');
  } else {
    // No cache - show default immediately
    showDefaultProfile();
  }

  // Load profile data from Supabase (in background, async - doesn't block)
  // This updates the UI when done, but doesn't cause delay
  if (typeof getUserProfile === 'function') {
    getUserProfile().then(async result => {
      if (result.success && result.profile) {
        const profile = result.profile;

        // Get email from localStorage (profiles table doesn't have email column)
        let userEmail = null;
        try {
          // Try to get email from auth token in localStorage
          const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
            key.startsWith('sb-') && key.includes('auth-token')
          );
          if (supabaseAuthKeys.length > 0) {
            const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
            userEmail = authData?.user?.email;

            // If not in user object, try to decode from JWT
            if (!userEmail && authData?.access_token) {
              try {
                const payload = JSON.parse(atob(authData.access_token.split('.')[1]));
                userEmail = payload.email;
              } catch (e) {
                // Ignore decode errors
              }
            }
          }
        } catch (e) {
          console.warn('Error getting email from localStorage:', e);
        }

        // Update UI with fresh data (pass email as second param)
        applyProfileToUI(profile, userEmail);

        // Update cache - include email in cached profile
        try {
          const profileWithEmail = {
            ...profile,
            email: userEmail || profile.email
          };
          const profileCache = {
            timestamp: Date.now(),
            profile: profileWithEmail
          };
          localStorage.setItem('eventhive_profile_cache', JSON.stringify(profileCache));
        } catch (e) {
          console.error('Error caching profile:', e);
        }

        console.log('Profile data loaded from Supabase');
      } else {
        console.warn('Failed to load profile:', result.error);
        // Only show default if we didn't have cache
        if (!cachedProfile) {
          showDefaultProfile();
        }
      }
    }).catch(error => {
      console.error('Error loading profile:', error);
      // Only show default if we didn't have cache
      if (!cachedProfile) {
        showDefaultProfile();
      }
    });
  } else {
    // Supabase not available - only show default if no cache
    if (!cachedProfile) {
      showDefaultProfile();
    }
  }
});

// Show default/placeholder profile data
function showDefaultProfile() {
  const usernameElement = document.querySelector('.username');
  const emailElement = document.querySelector('.email');
  const descriptionElement = document.querySelector('.description-box p');

  if (usernameElement) {
    usernameElement.textContent = 'User';
  }

  if (emailElement) {
    emailElement.textContent = 'No email';
  }

  if (descriptionElement) {
    descriptionElement.textContent = 'No bio yet. Click "Edit Profile" to add one!';
  }
}

