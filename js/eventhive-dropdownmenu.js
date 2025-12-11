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
        // auth-utils.js saves flat format: {isLoggedIn, isAdmin, userId, timestamp}
        // Return parsed directly if it has isLoggedIn (new flat format)
        // Or return parsed.state for backwards compatibility (old nested format)
        if (typeof parsed.isLoggedIn !== 'undefined') {
          return parsed; // New flat format from auth-utils.js
        } else if (parsed.state && typeof parsed.state.isLoggedIn !== 'undefined') {
          return parsed.state; // Old nested format
        }
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

  // Check for null OR missing/malformed state object
  if (cached === null || typeof cached !== 'object' || typeof cached.isLoggedIn === 'undefined') {
    return 'guest'; // Default state if no cache or malformed
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

// Generate a consistent color from a string (for initials background)
function stringToColor(str) {
  if (!str) return '#B81E20'; // Default to red
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate a color in HSL with fixed saturation and lightness for readability
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
}

// Get initials from name or email
function getInitials(name, email) {
  // Try to get initials from name first
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  // Fall back to email
  if (email) {
    const localPart = email.split('@')[0];
    return localPart.substring(0, 2).toUpperCase();
  }
  return 'U';
}

// Update profile icon with user avatar image
function updateProfileIconAvatar(avatarUrl) {
  const profileIcon = document.getElementById('profile-icon');
  if (!profileIcon) return;

  // Check if already an img element
  let img = profileIcon.querySelector('img');
  if (!img) {
    // Replace SVG/initials with img
    profileIcon.innerHTML = '';
    img = document.createElement('img');
    img.className = 'profile-icon-avatar';
    img.alt = 'Profile';
    profileIcon.appendChild(img);
    profileIcon.classList.add('has-avatar');
  }
  img.src = avatarUrl;

  // Handle image load error - will be handled by caller with initials fallback
  img.onerror = null; // Reset error handler, caller handles fallback
}

// Update profile icon with initials (when no avatar available)
function updateProfileIconInitials(name, email) {
  const profileIcon = document.getElementById('profile-icon');
  if (!profileIcon) return;

  const initials = getInitials(name, email);
  const bgColor = stringToColor(email || name || 'user');

  // Create initials element
  profileIcon.innerHTML = '';
  const initialsDiv = document.createElement('div');
  initialsDiv.className = 'profile-icon-initials';
  initialsDiv.style.backgroundColor = bgColor;
  initialsDiv.textContent = initials;
  profileIcon.appendChild(initialsDiv);
  profileIcon.classList.remove('has-avatar');
  profileIcon.classList.add('has-initials');
}

// Reset profile icon to default SVG (for logged out state)
function resetProfileIconToDefault() {
  const profileIcon = document.getElementById('profile-icon');
  if (!profileIcon) return;

  profileIcon.innerHTML = DEFAULT_PROFILE_SVG;
  profileIcon.classList.remove('has-avatar');
  profileIcon.classList.remove('has-initials');
}

// Load avatar from multiple sources with fallbacks
async function loadProfileAvatar() {
  // First check if logged in
  const authCache = getCachedAuthState();
  if (!authCache || !authCache.isLoggedIn) {
    resetProfileIconToDefault();
    return;
  }

  let avatarUrl = null;
  let userName = null;
  let userEmail = null;

  // Source 1: Try profile cache first (fastest)
  try {
    const profileCacheStr = localStorage.getItem('eventhive_profile_cache');
    if (profileCacheStr) {
      const profileCache = JSON.parse(profileCacheStr);
      if (profileCache && profileCache.profile) {
        avatarUrl = profileCache.profile.avatar_url;
        userName = profileCache.profile.username;
        userEmail = profileCache.profile.email;

        if (avatarUrl) {
          updateProfileIconAvatar(avatarUrl);
          return;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading profile cache for avatar:', e);
  }

  // Source 2: Try Supabase session for Google OAuth picture
  if (typeof getSupabaseClient === 'function') {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const user = data.session.user;
          userEmail = userEmail || user.email;

          // Check user_metadata for 'avatar_url' (Google) or 'picture' (other providers)
          const metadata = user.user_metadata || {};
          const sessionAvatar = metadata.avatar_url || metadata.picture;
          userName = userName || metadata.name;

          if (sessionAvatar && !avatarUrl) {
            avatarUrl = sessionAvatar;
            updateProfileIconAvatar(avatarUrl);

            // AUTO-SYNC: Update profile in database if it has NULL avatar
            // This fixes existing users who signed up before the trigger was added
            try {
              const { error } = await supabase
                .from('profiles')
                .update({
                  avatar_url: sessionAvatar,
                  updated_at: new Date().toISOString()
                })
                .eq('id', user.id)
                .is('avatar_url', null); // Only update if avatar_url is NULL

              if (!error) {
                console.log('Profile avatar synced from session to database');
                // Update local cache too
                try {
                  const profileCacheStr = localStorage.getItem('eventhive_profile_cache');
                  if (profileCacheStr) {
                    const profileCache = JSON.parse(profileCacheStr);
                    if (profileCache && profileCache.profile) {
                      profileCache.profile.avatar_url = sessionAvatar;
                      // username is already in profile, no need to update full_name
                      localStorage.setItem('eventhive_profile_cache', JSON.stringify(profileCache));
                    }
                  }
                } catch (cacheErr) {
                  console.warn('Error updating profile cache:', cacheErr);
                }
              }
            } catch (syncErr) {
              console.warn('Error syncing avatar to database:', syncErr);
            }

            return;
          }
        }
      }
    } catch (e) {
      console.warn('Error getting session for avatar:', e);
    }
  }

  // Source 3: Fetch profile from Supabase database
  if (typeof getUserProfile === 'function' && !avatarUrl) {
    try {
      const result = await getUserProfile();
      if (result.success && result.profile) {
        avatarUrl = result.profile.avatar_url;
        userName = userName || result.profile.username;
        userEmail = userEmail || result.profile.email;

        if (avatarUrl) {
          updateProfileIconAvatar(avatarUrl);
          return;
        }
      }
    } catch (e) {
      console.warn('Error fetching profile for avatar:', e);
    }
  }

  // Fallback: Show initials if no avatar URL found
  if (userName || userEmail) {
    updateProfileIconInitials(userName, userEmail);
  } else {
    // Last resort: show default
    resetProfileIconToDefault();
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
  // Check for valid cache object with expected properties
  if (cached !== null && typeof cached === 'object' && typeof cached.isLoggedIn !== 'undefined') {
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
// NOTE: onAuthStateChange is registered once below (around line 550) to avoid duplicate subscriptions

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

// Clear all caches - use centralized function if available
function clearAllCaches() {
  // Use centralized clearAuthState if available
  if (typeof window.clearAuthState === 'function') {
    window.clearAuthState();
  } else {
    // Fallback to local implementation
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem('eventhive_profile_cache');
    } catch (e) {
      console.error('Error clearing caches:', e);
    }
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

    // Mark explicit logout in progress (prevents double-redirect from onAuthStateChange)
    window.__EH_EXPLICIT_LOGOUT_IN_PROGRESS = true;

    // Show loading spinner
    if (typeof showLoading === 'function') showLoading();

    // Close dropdown immediately
    if (dropdownMenu) {
      dropdownMenu.classList.remove('show');
    }

    // Step 1: Try to sign out from Supabase with timeout (don't let it hang)
    try {
      if (typeof getSupabaseClient === 'function') {
        const supabase = getSupabaseClient();
        if (supabase) {
          // Use Promise.race with timeout to prevent hanging
          const signOutPromise = supabase.auth.signOut();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SignOut timeout')), 3000)
          );

          await Promise.race([signOutPromise, timeoutPromise]);
          console.log('Supabase signOut completed');
        }
      }
    } catch (err) {
      console.warn('SignOut error (continuing with logout):', err);
      // Continue with logout even if signOut fails/times out
    }

    // Step 2: Clear ALL localStorage items
    try {
      localStorage.clear();
      console.log('localStorage cleared');
    } catch (err) {
      console.error('Error clearing localStorage:', err);
    }

    // Step 3: Clear session storage too
    try {
      sessionStorage.clear();
    } catch (err) {
      console.warn('Error clearing sessionStorage:', err);
    }

    // Step 4: Clear all caches (for backward compatibility)
    clearAllCaches();

    // Hide loading and show success message, then redirect to homepage
    if (typeof hideLoading === 'function') hideLoading();
    alert('Log out successful');
    window.location.href = 'eventhive-homepage.html';
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

        // SECURITY: Always redirect to homepage when signed out
        // Skip redirect if already on homepage or if explicit logout just triggered
        const isHomepage = window.location.pathname.includes('homepage') || window.location.pathname === '/';
        if (!isHomepage && !window.__EH_EXPLICIT_LOGOUT_IN_PROGRESS) {
          window.location.replace(window.location.origin + '/eventhive-homepage.html');
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
