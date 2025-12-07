// Get elements (may be null if DOM not ready yet)
const profileIcon = document.getElementById('profile-icon');
const dropdownMenu = document.getElementById('dropdownMenu');

// Cache for auth state (5 minutes) - persisted across page loads
// Expose to window so hamburger menu can use them too
const AUTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY = 'eventhive_auth_cache';
if (typeof window !== 'undefined') {
  window.AUTH_CHECK_INTERVAL = AUTH_CHECK_INTERVAL;
  window.CACHE_KEY = CACHE_KEY;
}

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

// Determine dropdown state from cached auth state
function getDropdownState() {
  const cached = getCachedAuthState();
  if (cached === null) {
    return 'guest'; // Default state if no cache
  }
  
  if (cached.isLoggedIn && cached.isAdmin) {
    return 'admin'; // Logged in + Admin
  } else if (cached.isLoggedIn) {
    return 'user'; // Logged in + Not Admin
  } else {
    return 'guest'; // Logged out
  }
}

// Apply dropdown state by replacing content entirely
function applyDropdownState(state) {
  if (!dropdownMenu) return;
  
  // Hide all states
  const guestState = document.getElementById('dropdownState-guest');
  const userState = document.getElementById('dropdownState-user');
  const adminState = document.getElementById('dropdownState-admin');
  
  if (guestState) guestState.style.display = 'none';
  if (userState) userState.style.display = 'none';
  if (adminState) adminState.style.display = 'none';
  
  // Show only the correct state
  switch (state) {
    case 'guest':
      if (guestState) guestState.style.display = 'block';
      break;
    case 'user':
      if (userState) userState.style.display = 'block';
      break;
    case 'admin':
      if (adminState) adminState.style.display = 'block';
      break;
  }
}

// IMMEDIATE INITIALIZATION: Apply dropdown state as soon as script loads
// This runs IMMEDIATELY to prevent showing wrong state
(function applyDropdownStateImmediately() {
  function applyStateNow() {
    const state = getDropdownState();
    applyDropdownState(state);
  }
  
  // Try immediately (if DOM is ready)
  applyStateNow();
  
  // Try when DOM is interactive (earlier than DOMContentLoaded)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyStateNow, { once: true });
  } else {
    // DOM already loaded, apply immediately
    applyStateNow();
  }
  
  // Also try on next frame (catches elements added dynamically)
  requestAnimationFrame(applyStateNow);
  
  // Also try after a tiny delay (catches late-loading elements)
  setTimeout(applyStateNow, 0);
  
  // Use MutationObserver to catch elements as soon as they're added to DOM
  const observer = new MutationObserver(() => {
    applyStateNow();
  });
  
  // Observe the document body for changes
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Stop observing after 2 seconds (elements should be loaded by then)
    setTimeout(() => {
      observer.disconnect();
    }, 2000);
  }
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
    
    // Immediately apply the new state
    const newState = isLoggedIn && isAdmin ? 'admin' : (isLoggedIn ? 'user' : 'guest');
    applyDropdownState(newState);
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
      const state = cached.isLoggedIn && cached.isAdmin ? 'admin' : (cached.isLoggedIn ? 'user' : 'guest');
      applyDropdownState(state);
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
  
  // State is already applied in saveCachedAuthState
}

// Apply auth state to UI (for compatibility with other scripts)
function applyAuthStateToUI(isLoggedIn, isAdmin) {
  const state = isLoggedIn && isAdmin ? 'admin' : (isLoggedIn ? 'user' : 'guest');
  applyDropdownState(state);
}

// Make functions globally accessible for login script
if (typeof window !== 'undefined') {
  window.saveCachedAuthState = saveCachedAuthState;
  window.applyAuthStateToUI = applyAuthStateToUI;
}

profileIcon.addEventListener('click', (e) => {
  e.preventDefault();
  // Just toggle the dropdown - state is already set correctly
  dropdownMenu.classList.toggle('show');
  // Ensure state is correct (use cache directly, no async)
  const state = getDropdownState();
  applyDropdownState(state);
});

// Initialize: Load cached state on DOM ready (backup - ensures it's applied)
document.addEventListener('DOMContentLoaded', () => {
  // Apply cached state immediately if available (base default on cache)
  const cached = getCachedAuthState();
  if (cached !== null) {
    // Use cached state immediately - ABSOLUTE DEFAULT for next 5 minutes
    // NO async checks - cache is valid for 5 minutes from login
    // This is the state from initial login check - use it absolutely
    const state = cached.isLoggedIn && cached.isAdmin ? 'admin' : (cached.isLoggedIn ? 'user' : 'guest');
    applyDropdownState(state);
    // DO NOT call updateDropdownAuthState - cache is absolute for 5 minutes
  } else {
    // No cache - default to guest state
    applyDropdownState('guest');
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

// Clear all caches
function clearAllCaches() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('eventhive_profile_cache');
  } catch (e) {
    console.error('Error clearing caches:', e);
  }
  // Apply guest state after clearing cache
  applyDropdownState('guest');
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
    
    // Sign out using Supabase immediately
    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }
    
    // Clear ALL localStorage items
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }
    
    // Clear all caches (for backward compatibility)
    clearAllCaches();
    
    // Show success message
    alert('Log out successful');
    
    // State is already applied in clearAllCaches
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
      } else {
        updateDropdownAuthState(true); // Force check on auth state change
      }
    });
  }
}

// Note: We do NOT clear caches on beforeunload because:
// 1. It fires on navigation between HTML pages (we want cache to persist)
// 2. The Supabase auth token persists across navigation, so our cache should too
// 3. Cache is already cleared on explicit logout and SIGNED_OUT events

// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
  if (profileIcon && dropdownMenu) {
    if (!profileIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove('show');
    }
  }
});
