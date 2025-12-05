const profileIcon = document.getElementById('profile-icon');
const dropdownMenu = document.getElementById('dropdownMenu');
const guestLinks = document.getElementById('guestLinks');
const userLinks = document.getElementById('userLinks');

// Cache for auth state (5 minutes) - persisted across page loads in same tab (localStorage for instant access)
const AUTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY = 'eventhive_auth_cache';

// Get cached auth state from localStorage
function getCachedAuthState() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const timeSinceLastCheck = now - parsed.timestamp;
      
      // Return cache if it's less than 5 minutes old
      if (timeSinceLastCheck < AUTH_CHECK_INTERVAL) {
        return parsed.state;
      }
    }
  } catch (e) {
    console.error('Error reading auth cache:', e);
  }
  return null;
}

// Save auth state to localStorage
function saveCachedAuthState(isLoggedIn, isAdmin) {
  try {
    const cache = {
      timestamp: Date.now(),
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
      // Use cached state - instant UI update
      applyAuthStateToUI(cached.isLoggedIn, cached.isAdmin);
      return;
    }
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
  
  // Save to cache
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

profileIcon.addEventListener('click', (e) => {
  e.preventDefault();
  // Just toggle the dropdown - uses cached auth state (instant)
  dropdownMenu.classList.toggle('show');
  // Update UI from cache (no delay)
  updateDropdownAuthState(false); // false = use cache if available
});

// Initialize: Load cached state immediately (no delay)
document.addEventListener('DOMContentLoaded', () => {
  // Apply cached state immediately if available (instant UI update)
  const cached = getCachedAuthState();
  if (cached !== null) {
    // Cache exists and is valid - use it immediately
    applyAuthStateToUI(cached.isLoggedIn, cached.isAdmin);
    // Don't check auth - cache persists across HTML pages in same tab
    // Background refresh will happen every 5 minutes via setInterval
    return; // Exit early, cache is valid
  }
  
  // Only check auth if cache is expired or doesn't exist
  // This will save to cache for future page loads
  updateDropdownAuthState(false);
});

// Listen for auth state changes (when user logs in/out)
// Only update on actual auth state changes, not on page load
let isInitialAuthCheck = true;

// Set up auth state listener after DOM loads (ensures Supabase is ready)
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for Supabase to initialize
  setTimeout(() => {
    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
          // Skip the initial check on page load (it's just Supabase initializing)
          // This prevents overwriting cache when switching HTML pages
          if (isInitialAuthCheck) {
            isInitialAuthCheck = false;
            // Only update if we don't have a valid cache
            // If cache exists, it means we just switched HTML pages - keep using cache
            const cached = getCachedAuthState();
            if (cached === null) {
              // No cache - do initial check
              updateDropdownAuthState(true);
            }
            // If cache exists, do nothing - it persists across HTML pages
            return;
          }
          
          // Actual auth state change (login/logout) - not just page navigation
          if (event === 'SIGNED_OUT') {
            clearAllCaches();
            if (dropdownMenu) {
              dropdownMenu.classList.remove('show');
            }
            applyAuthStateToUI(false, false);
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            updateDropdownAuthState(true); // Force check on login
          }
        });
      }
    }
  }, 100);
});

// Set up periodic check every 5 minutes (background refresh)
setInterval(() => {
  updateDropdownAuthState(true); // Force check every 5 minutes
}, AUTH_CHECK_INTERVAL);

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

// Duplicate listener removed - handled above

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