const profileIcon = document.getElementById('profile-icon');
const dropdownMenu = document.getElementById('dropdownMenu');
const guestLinks = document.getElementById('guestLinks');
const userLinks = document.getElementById('userLinks');

// Cache for auth state (5 minutes)
let lastAuthCheck = 0;
let cachedAuthState = { isLoggedIn: false, isAdmin: false };
const AUTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Update dropdown menu based on authentication state
async function updateDropdownAuthState(forceCheck = false) {
  const now = Date.now();
  const timeSinceLastCheck = now - lastAuthCheck;
  
  // Only check if forced or if 5 minutes have passed
  if (!forceCheck && timeSinceLastCheck < AUTH_CHECK_INTERVAL) {
    // Use cached state
    applyAuthStateToUI(cachedAuthState.isLoggedIn, cachedAuthState.isAdmin);
    return;
  }
  
  // Perform actual auth check
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
  
  // Update cache
  lastAuthCheck = now;
  cachedAuthState = { isLoggedIn, isAdmin };
  
  // Update UI
  applyAuthStateToUI(isLoggedIn, isAdmin);
}

// Apply auth state to UI
function applyAuthStateToUI(isLoggedIn, isAdmin) {
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

profileIcon.addEventListener('click', (e) => {
  e.preventDefault();
  // Just toggle the dropdown - auth state is already checked on page load
  dropdownMenu.classList.toggle('show');
});

// Initialize auth state on page load (when HTML loads)
document.addEventListener('DOMContentLoaded', async () => {
  await updateDropdownAuthState();
});

// Listen for auth state changes (when user logs in/out)
// Force check when auth state changes (bypasses 5-minute cache)
if (typeof getSupabaseClient === 'function') {
  const supabase = getSupabaseClient();
  if (supabase) {
    supabase.auth.onAuthStateChange(() => {
      updateDropdownAuthState(true); // Force check on auth state change
    });
  }
}

// Set up periodic check every 5 minutes
setInterval(() => {
  updateDropdownAuthState(true); // Force check every 5 minutes
}, AUTH_CHECK_INTERVAL);

// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
  if (profileIcon && dropdownMenu) {
    if (!profileIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove('show');
    }
  }
});