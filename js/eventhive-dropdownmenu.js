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

// ===== PROFILE ICON AVATAR FUNCTIONS =====
// Default SVG for profile icon (used when logged out)
const DEFAULT_PROFILE_SVG = `<svg width="27" height="27" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2.46209 26.5849C2.46209 26.5849 0.254517 26.5849 0.254517 24.4151C0.254517 22.2453 2.46209 15.7359 13.5 15.7359C24.5378 15.7359 26.7454 22.2453 26.7454 24.4151C26.7454 26.5849 24.5378 26.5849 24.5378 26.5849H2.46209ZM13.5 13.566C15.2564 13.566 16.9409 12.8802 18.1829 11.6595C19.4249 10.4387 20.1227 8.78302 20.1227 7.05661C20.1227 5.3302 19.4249 3.6745 18.1829 2.45375C16.9409 1.23299 15.2564 0.54718 13.5 0.54718C11.7435 0.54718 10.059 1.23299 8.817 2.45375C7.57499 3.6745 6.87724 5.3302 6.87724 7.05661C6.87724 8.78302 7.57499 10.4387 8.817 11.6595C10.059 12.8802 11.7435 13.566 13.5 13.566Z"/>
</svg>`;

// Update profile icon with user avatar
function updateProfileIconAvatar(avatarUrl) {
  const profileIcon = document.getElementById('profile-icon');
  if (!profileIcon) return;

  const imgUrl = avatarUrl || 'images/prof_default.svg';

  // Check if already an img element
  let img = profileIcon.querySelector('img');
  if (!img) {
    // Replace SVG with img
    profileIcon.innerHTML = '';
    img = document.createElement('img');
    img.className = 'profile-icon-avatar';
    img.alt = 'Profile';
    profileIcon.appendChild(img);
    profileIcon.classList.add('has-avatar');
  }
  img.src = imgUrl;

  // Handle image load error - fallback to default
  img.onerror = function () {
    this.src = 'images/prof_default.svg';
  };
}

// Reset profile icon to default SVG (for logged out state)
function resetProfileIconToDefault() {
  const profileIcon = document.getElementById('profile-icon');
  if (!profileIcon) return;

  profileIcon.innerHTML = DEFAULT_PROFILE_SVG;
  profileIcon.classList.remove('has-avatar');
}

// Load avatar from profile cache or fetch from Supabase
async function loadProfileAvatar() {
  // First check if logged in
  const authCache = getCachedAuthState();
  if (!authCache || !authCache.isLoggedIn) {
    resetProfileIconToDefault();
    return;
  }

  // Try to get avatar from profile cache
  try {
    const profileCacheStr = localStorage.getItem('eventhive_profile_cache');
    if (profileCacheStr) {
      const profileCache = JSON.parse(profileCacheStr);
      if (profileCache && profileCache.profile && profileCache.profile.avatar_url) {
        updateProfileIconAvatar(profileCache.profile.avatar_url);
        return;
      }
    }
  } catch (e) {
    console.warn('Error reading profile cache for avatar:', e);
  }

  // Fallback: fetch profile from Supabase
  if (typeof getUserProfile === 'function') {
    try {
      const result = await getUserProfile();
      if (result.success && result.profile) {
        updateProfileIconAvatar(result.profile.avatar_url);
      } else {
        // No avatar, use default
        updateProfileIconAvatar(null);
      }
    } catch (e) {
      console.warn('Error fetching profile for avatar:', e);
      updateProfileIconAvatar(null);
    }
  } else {
    // getUserProfile not available, use default
    updateProfileIconAvatar(null);
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

    // Load profile avatar if logged in
    if (isLoggedIn) {
      loadProfileAvatar();
    } else {
      resetProfileIconToDefault();
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

    // Load profile avatar if logged in
    if (cached.isLoggedIn) {
      loadProfileAvatar();
    }
    // DO NOT call updateDropdownAuthState - cache is absolute for 5 minutes
  } else {
    // No cache - default to guest state
    applyDropdownState('guest');
    resetProfileIconToDefault();
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
  // Reset profile icon to default SVG
  resetProfileIconToDefault();
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
