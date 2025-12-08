// ===== PROFILE DATA LOADING FROM SUPABASE =====
// Loads user profile data from Supabase and displays it

// Function to apply profile data to UI
function applyProfileToUI(profile, userEmail = null) {
  // Update username
  const usernameElement = document.querySelector('.username');
  if (usernameElement) {
    usernameElement.textContent = profile.username || profile.full_name || 'User';
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

  // Update profile picture
  const profilePicElement = document.querySelector('.profile-picture img');
  if (profilePicElement) {
    profilePicElement.src = profile.avatar_url || 'images/prof_default.svg';
    profilePicElement.alt = profile.username || profile.full_name || 'Profile Picture';
  }

  // Update cover photo
  const coverPhotoElement = document.querySelector('.cover-photo img');
  if (coverPhotoElement && profile.cover_photo_url) {
    coverPhotoElement.src = profile.cover_photo_url;
  }
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
    getUserProfile().then(result => {
      if (result.success && result.profile) {
        const profile = result.profile;

        // Update UI with fresh data
        applyProfileToUI(profile);

        // Update cache
        try {
          const profileCache = {
            timestamp: Date.now(),
            profile: profile
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

