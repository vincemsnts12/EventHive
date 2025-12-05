const profileIcon = document.getElementById('profile-icon');
const dropdownMenu = document.getElementById('dropdownMenu');
const guestLinks = document.getElementById('guestLinks');
const userLinks = document.getElementById('userLinks');

// Cache for auth state (5 minutes) - persisted across page loads
const AUTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY = 'eventhive_auth_cache';

// Get cached auth state from localStorage
function getCachedAuthState() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const timeSinceLogin = now - parsed.timestamp;
      
      // Return cache if it's less than 5 minutes old (timer starts from login)
      if (timeSinceLogin < AUTH_CHECK_INTERVAL) {
        return parsed.state;
      }
    }
  } catch (e) {
    console.error('Error reading auth cache:', e);
  }
  return null;
}

// Save auth state to localStorage
// Made globally accessible for login script
function saveCachedAuthState(isLoggedIn, isAdmin) {
  try {
    const cache = {
      timestamp: Date.now(), // Login time - 5-minute timer starts from here
      state: { isLoggedIn, isAdmin }
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Error saving auth cache:', e);
  }
}

// Update dropdown menu based on authentication state
async function updateDropdownAuthState(forceCheck = false) {
  // Check cache first (unless forced)
  if (!forceCheck) {
    const cached = getCachedAuthState();
    if (cached !== null) {
      // Use cached state immediately - NO async checks if cache is valid (< 5 minutes)
      applyAuthStateToUI(cached.isLoggedIn, cached.isAdmin);
      return; // Exit early - no auth check needed
    }
  }
  
  // Only perform auth check if:
  // 1. Force check is requested (login/logout/auth change)
  // 2. Cache doesn't exist or is expired (> 5 minutes)
  
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
  
  // Save to cache with current timestamp (resets 5-minute timer)
  saveCachedAuthState(isLoggedIn, isAdmin);
  
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

// Make functions globally accessible for login script
if (typeof window !== 'undefined') {
  window.saveCachedAuthState = saveCachedAuthState;
  window.applyAuthStateToUI = applyAuthStateToUI;
}

profileIcon.addEventListener('click', (e) => {
  e.preventDefault();
  // Just toggle the dropdown - uses cached auth state (instant)
  dropdownMenu.classList.toggle('show');
  // Update UI from cache (no delay)
  updateDropdownAuthState(false); // false = use cache if available
});

// Initialize: Load cached state immediately (no delay, no async checks)
document.addEventListener('DOMContentLoaded', () => {
  // Apply cached state immediately if available (base default on cache)
  const cached = getCachedAuthState();
  if (cached !== null) {
    // Use cached state immediately - assume user is logged in and admin (if cached as admin)
    // NO async checks - cache is valid for 5 minutes from login
    applyAuthStateToUI(cached.isLoggedIn, cached.isAdmin);
  } else {
    // No cache - default to logged out state
    applyAuthStateToUI(false, false);
  }
  
  // Only check auth in background if cache is expired (> 5 minutes) or doesn't exist
  // This runs async and updates UI when done - no blocking
  // If cache exists and is valid, this will return early without any async operations
  updateDropdownAuthState(false).catch(err => {
    console.error('Error updating auth state:', err);
  });
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

// Set up periodic check every 5 minutes (background refresh)
// This runs continuously and automatically updates cache every 5 minutes
// Timer starts from login time (stored in cache timestamp)
let authCheckInterval = setInterval(() => {
  // Check if cache exists and if 5 minutes have passed since login
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const timeSinceLogin = Date.now() - parsed.timestamp;
      
      if (timeSinceLogin >= AUTH_CHECK_INTERVAL) {
        // 5 minutes have passed since login - refresh cache in background
        updateDropdownAuthState(true);
      }
      // If less than 5 minutes, do nothing - use cache only
    } else {
      // No cache - check auth
      updateDropdownAuthState(true);
    }
  } catch (e) {
    console.error('Error in periodic auth check:', e);
  }
}, 60000); // Check every minute to see if 5 minutes have passed since login

// Ensure interval is cleared on logout to prevent unnecessary checks
// (It will restart on next page load if user is logged in)

// Clear all caches
function clearAllCaches() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('eventhive_profile_cache');
  } catch (e) {
    console.error('Error clearing caches:', e);
  }
}

// Desktop Logout Button Handler
const logoutBtn = document.getElementById('navLogoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Close dropdown immediately
    if (dropdownMenu) {
      dropdownMenu.classList.remove('show');
    }
    
    // Sign out using Supabase
    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }
    
    // Clear all caches
    clearAllCaches();
    
    // Update UI immediately
    applyAuthStateToUI(false, false);
    
    // Also update mobile menu if function exists
    if (typeof updateMobileMenuAuthState === 'function') {
      await updateMobileMenuAuthState();
    }
  });
}

// Listen for auth state changes (when user logs in/out)
// Force check when auth state changes (bypasses 5-minute cache)
if (typeof getSupabaseClient === 'function') {
  const supabase = getSupabaseClient();
  if (supabase) {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // User logged out - clear caches and close dropdown
        clearAllCaches();
        if (dropdownMenu) {
          dropdownMenu.classList.remove('show');
        }
        applyAuthStateToUI(false, false);
      } else {
        updateDropdownAuthState(true); // Force check on auth state change
      }
    });
  }
}

// Clear caches when tab closes
window.addEventListener('beforeunload', () => {
  clearAllCaches();
});

// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
  if (profileIcon && dropdownMenu) {
    if (!profileIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove('show');
    }
  }
});