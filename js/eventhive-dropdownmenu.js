// Get elements (may be null if DOM not ready yet)
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

// IMMEDIATE INITIALIZATION: Apply cache state as soon as script loads
// This runs IMMEDIATELY to prevent showing wrong state (Log In/Sign Up when logged in)
(function applyCacheStateImmediately() {
  const cached = getCachedAuthState();
  if (cached !== null && cached.isLoggedIn) {
    // User is logged in - hide guestLinks and show userLinks IMMEDIATELY
    // This prevents showing "Log In/Sign Up" when user is already logged in
    const gl = document.getElementById('guestLinks');
    const ul = document.getElementById('userLinks');
    const db = document.getElementById('navDashboardBtn');
    
    if (gl) gl.style.display = 'none';
    if (ul) ul.style.display = 'block';
    if (db) db.style.display = cached.isAdmin ? 'block' : 'none';
  } else if (cached !== null && !cached.isLoggedIn) {
    // User is logged out - show guestLinks and hide userLinks
    const gl = document.getElementById('guestLinks');
    const ul = document.getElementById('userLinks');
    const db = document.getElementById('navDashboardBtn');
    
    if (gl) gl.style.display = 'block';
    if (ul) ul.style.display = 'none';
    if (db) db.style.display = 'none';
  }
  // If no cache, leave HTML defaults (guestLinks visible)
})();

// IMMEDIATE INITIALIZATION: Apply cache state as soon as script loads
// This runs IMMEDIATELY to prevent showing wrong state (Log In/Sign Up when logged in)
(function applyCacheStateImmediately() {
  const cached = getCachedAuthState();
  if (cached !== null && cached.isLoggedIn) {
    // User is logged in - hide guestLinks and show userLinks IMMEDIATELY
    // This prevents showing "Log In/Sign Up" when user is already logged in
    const gl = document.getElementById('guestLinks');
    const ul = document.getElementById('userLinks');
    const db = document.getElementById('navDashboardBtn');
    
    if (gl) gl.style.display = 'none';
    if (ul) ul.style.display = 'block';
    if (db) db.style.display = cached.isAdmin ? 'block' : 'none';
  } else if (cached !== null && !cached.isLoggedIn) {
    // User is logged out - show guestLinks and hide userLinks
    const gl = document.getElementById('guestLinks');
    const ul = document.getElementById('userLinks');
    const db = document.getElementById('navDashboardBtn');
    
    if (gl) gl.style.display = 'block';
    if (ul) ul.style.display = 'none';
    if (db) db.style.display = 'none';
  }
  // If no cache, leave HTML defaults (guestLinks visible)
})();

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
  // If not forced, check cache first - if valid, use it ABSOLUTELY with NO async operations
  if (!forceCheck) {
    const cached = getCachedAuthState();
    if (cached !== null) {
      // Cache is valid (< 5 minutes from login) - use it ABSOLUTELY
      // This is the state from initial login check - NO async operations
      applyAuthStateToUI(cached.isLoggedIn, cached.isAdmin);
      return; // Exit immediately - NO async checks during 5-minute window
    }
  }
  
  // Only perform auth check if:
  // 1. Force check is requested (login/logout/auth change/5-minute refresh)
  // 2. Cache doesn't exist or is expired (> 5 minutes)
  
  // Perform actual auth check (only when forced or cache expired)
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
  // Use cache directly - NO async checks if cache is valid
  const cached = getCachedAuthState();
  if (cached !== null) {
    // Cache is valid - use it directly, no async operations
    applyAuthStateToUI(cached.isLoggedIn, cached.isAdmin);
  } else {
    // No cache - check auth
    updateDropdownAuthState(false);
  }
});

// Initialize: Load cached state on DOM ready (backup - in case IIFE didn't catch it)
document.addEventListener('DOMContentLoaded', () => {
  // Apply cached state immediately if available (base default on cache)
  const cached = getCachedAuthState();
  if (cached !== null) {
    // Use cached state immediately - ABSOLUTE DEFAULT for next 5 minutes
    // NO async checks - cache is valid for 5 minutes from login
    // This is the state from initial login check - use it absolutely
    applyAuthStateToUI(cached.isLoggedIn, cached.isAdmin);
    // DO NOT call updateDropdownAuthState - cache is absolute for 5 minutes
  } else {
    // No cache - default to logged out state
    applyAuthStateToUI(false, false);
    // Only check auth if no cache exists
    updateDropdownAuthState(false).catch(err => {
      console.error('Error updating auth state:', err);
    });
  }
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