// ===== PROFILE DATA LOADING FROM SUPABASE =====
// Loads user profile data from Supabase and displays it

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Supabase to initialize
  if (typeof initSupabase === 'function') {
    initSupabase();
  }

  // Load profile data from Supabase
  if (typeof getUserProfile === 'function') {
    try {
      const result = await getUserProfile();
      
      if (result.success && result.profile) {
        const profile = result.profile;
        
        // Update username
        const usernameElement = document.querySelector('.username');
        if (usernameElement) {
          usernameElement.textContent = profile.username || profile.full_name || 'User';
        }
        
        // Update email (get from auth user)
        const emailElement = document.querySelector('.email');
        if (emailElement && typeof getCurrentUser === 'function') {
          const userResult = await getCurrentUser();
          if (userResult.success && userResult.user) {
            emailElement.textContent = userResult.user.email || 'No email';
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

