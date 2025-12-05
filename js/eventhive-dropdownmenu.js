// Get elements (may be null if DOM not ready yet)
const profileIcon = document.getElementById('profile-icon');
const dropdownMenu = document.getElementById('dropdownMenu');

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

// Determine dropdown state from cached auth state
function getDropdownState() {
  const cached = getCachedAuthState();
  if (cached === null) {
    return 'guest'; // Default state if no cache
  }
  
  // IF LOGGED IN, NEVER RETURN GUEST
  if (cached.isLoggedIn && cached.isAdmin) {
    return 'admin'; // Logged in + Admin
  } else if (cached.isLoggedIn) {
    return 'user'; // Logged in + Not Admin
  } else {
    return 'guest'; // Logged out
  }
}

// Apply dropdown state by replacing content entirely
// FORCES the state - NO EXCEPTIONS - NEVER SHOW GUEST IF LOGGED IN
function applyDropdownState(state) {
  // If dropdown not ready, try again
  if (!dropdownMenu) {
    setTimeout(() => applyDropdownState(state), 10);
    return;
  }
  
  // Get all state elements
  const guestState = document.getElementById('dropdownState-guest');
  const userState = document.getElementById('dropdownState-user');
  const adminState = document.getElementById('dropdownState-admin');
  
  // FORCE HIDE ALL STATES
  if (guestState) {
    guestState.style.display = 'none';
    guestState.style.visibility = 'hidden';
  }
  if (userState) {
    userState.style.display = 'none';
    userState.style.visibility = 'hidden';
  }
  if (adminState) {
    adminState.style.display = 'none';
    adminState.style.visibility = 'hidden';
  }
  
  // FORCE SHOW ONLY THE CORRECT STATE
  switch (state) {
    case 'guest':
      if (guestState) {
        guestState.style.display = 'block';
        guestState.style.visibility = 'visible';
      }
      break;
    case 'user':
      if (userState) {
        userState.style.display = 'block';
        userState.style.visibility = 'visible';
      }
      break;
    case 'admin':
      if (adminState) {
        adminState.style.display = 'block';
        adminState.style.visibility = 'visible';
      }
      break;
  }
}

// IMMEDIATE INITIALIZATION: Apply dropdown state as soon as script loads
// This runs IMMEDIATELY to prevent showing wrong state
// FORCES the correct state based on cache - NO EXCEPTIONS
(function applyDropdownStateImmediately() {
  function applyStateNow() {
    const cached = getCachedAuthState();
    if (cached !== null) {
      // CACHE EXISTS - THIS IS THE ABSOLUTE TRUTH
      // If logged in, NEVER show guest state
      if (cached.isLoggedIn) {
        // USER IS LOGGED IN - NEVER SHOW GUEST
        const state = cached.isAdmin ? 'admin' : 'user';
        applyDropdownState(state);
      } else {
        // User is logged out
        applyDropdownState('guest');
      }
    } else {
      // No cache - default to guest
      applyDropdownState('guest');
    }
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
    
    // IMMEDIATELY apply the new state - FORCE IT
    // IF LOGGED IN, NEVER SHOW GUEST
    if (isLoggedIn) {
      const newState = isAdmin ? 'admin' : 'user';
      applyDropdownState(newState);
      // Also apply multiple times to ensure it sticks
      setTimeout(() => applyDropdownState(newState), 0);
      requestAnimationFrame(() => applyDropdownState(newState));
      setTimeout(() => applyDropdownState(newState), 50);
    } else {
      applyDropdownState('guest');
    }
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
      // IF LOGGED IN, NEVER SHOW GUEST
      if (cached.isLoggedIn) {
        const state = cached.isAdmin ? 'admin' : 'user';
        applyDropdownState(state);
      } else {
        applyDropdownState('guest');
      }
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
  // IF LOGGED IN, NEVER SHOW GUEST
  if (isLoggedIn) {
    const state = isAdmin ? 'admin' : 'user';
    applyDropdownState(state);
    // Also apply multiple times to ensure it sticks
    setTimeout(() => applyDropdownState(state), 0);
    requestAnimationFrame(() => applyDropdownState(state));
  } else {
    applyDropdownState('guest');
  }
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
  const cached = getCachedAuthState();
  if (cached !== null && cached.isLoggedIn) {
    // IF LOGGED IN, NEVER SHOW GUEST
    const state = cached.isAdmin ? 'admin' : 'user';
    applyDropdownState(state);
  } else {
    applyDropdownState('guest');
  }
});

// Initialize: Load cached state on DOM ready (backup - ensures it's applied)
document.addEventListener('DOMContentLoaded', () => {
  // Apply cached state immediately if available (base default on cache)
  const cached = getCachedAuthState();
  if (cached !== null) {
    // Use cached state immediately - ABSOLUTE DEFAULT for next 5 minutes
    // NO async checks - cache is valid for 5 minutes from login
    // This is the state from initial login check - use it absolutely
    // IF LOGGED IN, NEVER SHOW GUEST
    if (cached.isLoggedIn) {
      const state = cached.isAdmin ? 'admin' : 'user';
      applyDropdownState(state);
    } else {
      applyDropdownState('guest');
    }
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

// REPLACED: consolidated Supabase auth listener to save/clear cache immediately
if (typeof getSupabaseClient === 'function') {
  const supabase = getSupabaseClient();
  if (supabase && supabase.auth && typeof supabase.auth.onAuthStateChange === 'function') {
    supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_OUT') {
          // Clear cache and force guest UI immediately
          clearAllCaches();
          if (dropdownMenu) dropdownMenu.classList.remove('show');
          applyDropdownState('guest');
          return;
        }

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // Determine login + admin status and persist it immediately
          let isLoggedIn = false;
          let isAdmin = false;

          // Fast check: session info from the event
          if (session && (session.user || session.access_token || session.session)) {
            isLoggedIn = true;
          } else {
            // Fallback: try Supabase client user getter
            try {
              const userResp = await (supabase.auth.getUser?.() || supabase.auth.user?.());
              const user = userResp?.data?.user || userResp || null;
              if (user) isLoggedIn = true;
            } catch (e) {
              // ignore - will treat as logged out
            }
          }

          if (isLoggedIn) {
            // Prefer app-provided admin check function if available
            if (typeof checkIfUserIsAdmin === 'function') {
              try {
                const adminResult = await checkIfUserIsAdmin();
                isAdmin = !!(adminResult && adminResult.success && adminResult.isAdmin === true);
              } catch (e) { /* ignore and fallback */ }
            }

            // Fallback: inspect user metadata for a role flag
            if (!isAdmin) {
              try {
                const userResp = session?.user ? { user: session.user } : (await supabase.auth.getUser())?.data;
                const user = userResp?.user || userResp;
                if (user && (user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin')) {
                  isAdmin = true;
                }
              } catch (e) { /* ignore */ }
            }

            // Persist the auth state RIGHT AWAY so other pages read it immediately after navigation
            saveCachedAuthState(true, isAdmin);
            return;
          }

          // If we reach here, treat as logged out
          saveCachedAuthState(false, false);
          applyDropdownState('guest');
          return;
        }

        // For other events, conservative refresh
        updateDropdownAuthState(true);
      } catch (err) {
        console.error('Error handling auth state change:', err);
        // Fallback to forcing a refresh
        updateDropdownAuthState(true);
      }
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
    
    // Sign out using Supabase
    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }
    
    // Clear all caches
    clearAllCaches();
    
    // State is already applied in clearAllCaches
  });
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
