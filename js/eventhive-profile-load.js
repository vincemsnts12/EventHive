// ===== PROFILE DATA LOADING FROM SUPABASE =====
// Loads user profile data from Supabase and displays it

// Function to apply profile data to UI
function applyProfileToUI(profile, userEmail = null) {
  // Update username
  const usernameElement = document.querySelector('.username');
  if (usernameElement) {
    usernameElement.textContent = profile.username || profile.full_name || 'User';
  }
  
  // Update email (get from auth user or parameter)
  const emailElement = document.querySelector('.email');
  if (emailElement) {
    if (userEmail) {
      emailElement.textContent = userEmail;
    } else if (typeof getCurrentUser === 'function') {
      getCurrentUser().then(userResult => {
        if (userResult.success && userResult.user) {
          emailElement.textContent = userResult.user.email || 'No email';
        }
      });
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

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Supabase to initialize
  if (typeof initSupabase === 'function') {
    initSupabase();
  }

  // Try to load from cache first (instant)
  const cachedProfile = getCachedProfile();
  if (cachedProfile) {
    // Apply cached profile immediately (no delay)
    applyProfileToUI(cachedProfile);
    console.log('Profile data loaded from cache');
  }

  // Load profile data from Supabase (in background, updates cache)
  if (typeof getUserProfile === 'function') {
    try {
      const result = await getUserProfile();
      
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
        // Show default/placeholder data
        showDefaultProfile();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Show default/placeholder data
      showDefaultProfile();
    }
  } else {
    // Supabase not available - show default
    showDefaultProfile();
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

