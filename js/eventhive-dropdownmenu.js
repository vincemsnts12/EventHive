const profileIcon = document.getElementById('profile-icon');
const dropdownMenu = document.getElementById('dropdownMenu');
const guestLinks = document.getElementById('guestLinks');
const userLinks = document.getElementById('userLinks');

// Update dropdown menu based on authentication state
async function updateDropdownAuthState() {
  // Check if user is logged in using Supabase
  let isLoggedIn = false;
  let isAdmin = false;
  
  if (typeof getCurrentUser === 'function') {
    const userResult = await getCurrentUser();
    isLoggedIn = userResult.success && userResult.user !== null;
    
    // Check if user is admin
    if (isLoggedIn && typeof checkIfUserIsAdmin === 'function') {
      const adminResult = await checkIfUserIsAdmin();
      isAdmin = adminResult.success && adminResult.isAdmin === true;
    }
  }
  
  // Update UI based on auth state
  if (isLoggedIn) {
    if (guestLinks) guestLinks.style.display = 'none';
    if (userLinks) userLinks.style.display = 'block';
    
    // Show/hide Dashboard link based on admin status
    const dashboardLink = document.getElementById('navDashboardBtn');
    if (dashboardLink) {
      dashboardLink.style.display = isAdmin ? 'block' : 'none';
    }
  } else {
    if (guestLinks) guestLinks.style.display = 'block';
    if (userLinks) userLinks.style.display = 'none';
    
    // Hide dashboard link for non-logged-in users
    const dashboardLink = document.getElementById('navDashboardBtn');
    if (dashboardLink) {
      dashboardLink.style.display = 'none';
    }
  }
}

profileIcon.addEventListener('click', async (e) => {
  e.preventDefault();

  // Toggle menu visibility first (so it opens immediately)
  dropdownMenu.classList.toggle('show');
  
  // Update auth state in background (non-blocking)
  updateDropdownAuthState().catch(err => {
    console.error('Error updating dropdown auth state:', err);
  });
});

// Initialize auth state on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Wait a bit for Supabase to initialize
  await new Promise(resolve => setTimeout(resolve, 200));
  await updateDropdownAuthState();
});

// Listen for auth state changes (when user logs in/out)
// Set up listener after Supabase is initialized
function setupDropdownAuthListener() {
  if (typeof getSupabaseClient === 'function') {
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.auth.onAuthStateChange(async () => {
        await updateDropdownAuthState();
        // Also update mobile menu
        if (typeof updateMobileMenuAuthState === 'function') {
          await updateMobileMenuAuthState();
        }
      });
      return true; // Successfully set up
    }
  }
  return false; // Not ready yet
}

// Try to set up auth state listener
document.addEventListener('DOMContentLoaded', () => {
  // Try immediately
  if (!setupDropdownAuthListener()) {
    // Retry after a delay if not ready
    setTimeout(() => {
      if (!setupDropdownAuthListener()) {
        // One more retry
        setTimeout(setupDropdownAuthListener, 500);
      }
    }, 300);
  }
});

// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
  if (profileIcon && dropdownMenu) {
    if (!profileIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove('show');
    }
  }
});