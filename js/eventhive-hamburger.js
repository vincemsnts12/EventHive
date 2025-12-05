// Hamburger Menu Toggle Script
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
const mobileGuestLinks = document.getElementById('mobileGuestLinks');
const mobileUserLinks = document.getElementById('mobileUserLinks');

// Cache for auth state (5 minutes) - same as desktop dropdown
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

// Apply mobile menu state based on cached auth
function applyMobileMenuState(isLoggedIn, isAdmin) {
  if (!mobileGuestLinks || !mobileUserLinks) return;
  
  if (isLoggedIn) {
    mobileGuestLinks.style.display = 'none';
    mobileUserLinks.style.display = 'block';
    
    // Show/hide Dashboard link based on admin status
    const mobileDashboardBtn = document.getElementById('mobileDashboardBtn');
    if (mobileDashboardBtn) {
      mobileDashboardBtn.style.display = isAdmin ? 'block' : 'none';
    }
  } else {
    mobileGuestLinks.style.display = 'block';
    mobileUserLinks.style.display = 'none';
    
    // Hide dashboard link for non-logged-in users
    const mobileDashboardBtn = document.getElementById('mobileDashboardBtn');
    if (mobileDashboardBtn) {
      mobileDashboardBtn.style.display = 'none';
    }
  }
}

// IMMEDIATE INITIALIZATION: Apply mobile menu state as soon as script loads
// This runs IMMEDIATELY to prevent showing wrong state
(function applyMobileMenuStateImmediately() {
  function applyStateNow() {
    const cached = getCachedAuthState();
    if (cached !== null) {
      // Cache exists - use it immediately (NO async operations)
      applyMobileMenuState(cached.isLoggedIn, cached.isAdmin);
    } else {
      // No cache - default to guest state
      applyMobileMenuState(false, false);
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

// Function to update mobile menu based on login state
async function updateMobileMenuAuthState(forceCheck = false) {
  // If not forced, check cache first - if valid, use it ABSOLUTELY with NO async operations
  if (!forceCheck) {
    const cached = getCachedAuthState();
    if (cached !== null) {
      // Cache is valid (< 5 minutes from login) - use it ABSOLUTELY
      // This is the state from initial login check - NO async operations
      applyMobileMenuState(cached.isLoggedIn, cached.isAdmin);
      return; // Exit immediately - NO async checks during 5-minute window
    }
  }
  
  // Only perform auth check if:
  // 1. Force check is requested (login/logout/auth change/5-minute refresh)
  // 2. Cache doesn't exist or is expired (> 5 minutes)
  
  // Perform actual auth check (only when forced or cache expired)
  let loggedIn = false;
  let isAdmin = false;
  
  try {
    // Method 1: Try using getCurrentUser function
    if (typeof getCurrentUser === 'function') {
      const userResult = await getCurrentUser();
      loggedIn = userResult.success && userResult.user !== null;
      
      // Check if user is admin
      if (loggedIn && typeof checkIfUserIsAdmin === 'function') {
        const adminResult = await checkIfUserIsAdmin();
        isAdmin = adminResult.success && adminResult.isAdmin === true;
      }
    } 
    // Method 2: Fallback - check Supabase session directly
    else if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { session }, error } = await supabase.auth.getSession();
        loggedIn = !!(session && session.user);
        
        // Check if user is admin
        if (loggedIn && typeof checkIfUserIsAdmin === 'function') {
          const adminResult = await checkIfUserIsAdmin();
          isAdmin = adminResult.success && adminResult.isAdmin === true;
        }
      }
    }
  } catch (error) {
    console.error('Error checking mobile menu auth state:', error);
    // Default to logged out on error
    loggedIn = false;
    isAdmin = false;
  }
  
  // Save to cache (if saveCachedAuthState function exists from dropdown menu)
  if (typeof window.saveCachedAuthState === 'function') {
    window.saveCachedAuthState(loggedIn, isAdmin);
  } else {
    // Fallback: save directly
    try {
      const cache = {
        timestamp: Date.now(),
        state: { isLoggedIn: loggedIn, isAdmin: isAdmin }
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error('Error saving auth cache:', e);
    }
  }
  
  // Apply the state
  applyMobileMenuState(loggedIn, isAdmin);
}

// Toggle mobile menu
async function toggleMobileMenu() {
  hamburgerBtn.classList.toggle('active');
  mobileMenu.classList.toggle('active');
  mobileMenuOverlay.classList.toggle('active');
  
  // When opening menu, ensure state is correct (use cache directly, no async)
  const cached = getCachedAuthState();
  if (cached !== null) {
    // Use cached state immediately - NO async operations
    applyMobileMenuState(cached.isLoggedIn, cached.isAdmin);
  } else {
    // No cache - check auth (only if menu is opening)
    if (mobileMenu.classList.contains('active')) {
      await updateMobileMenuAuthState(false);
    }
  }
  
  // Prevent body scroll when menu is open
  if (mobileMenu.classList.contains('active')) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

// Close mobile menu
function closeMobileMenu() {
  hamburgerBtn.classList.remove('active');
  mobileMenu.classList.remove('active');
  mobileMenuOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Event listeners
if (hamburgerBtn) {
  hamburgerBtn.addEventListener('click', toggleMobileMenu);
}

if (mobileMenuOverlay) {
  mobileMenuOverlay.addEventListener('click', closeMobileMenu);
}

// Close menu on window resize (if screen becomes larger)
window.addEventListener('resize', () => {
  if (window.innerWidth > 576) {
    closeMobileMenu();
  }
});

// Close menu when clicking a link (except login/signup buttons)
const mobileMenuLinks = document.querySelectorAll('.mobile-menu-nav a:not(#mobileLoginBtn):not(#mobileSignupBtn)');
mobileMenuLinks.forEach(link => {
  link.addEventListener('click', closeMobileMenu);
});

// Mobile Login Button - opens login modal
const mobileLoginBtn = document.getElementById('mobileLoginBtn');
if (mobileLoginBtn) {
  mobileLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeMobileMenu();
    // Open login modal (from eventhive-pop-up__log&sign.js)
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      loginModal.style.display = 'flex';
    }
  });
}

// Mobile Signup Button - opens signup modal
const mobileSignupBtn = document.getElementById('mobileSignupBtn');
if (mobileSignupBtn) {
  mobileSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeMobileMenu();
    // Open signup modal (from eventhive-pop-up__log&sign.js)
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
      signupModal.style.display = 'flex';
    }
  });
}

// Clear all caches function
function clearAllCaches() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('eventhive_profile_cache');
  } catch (e) {
    console.error('Error clearing caches:', e);
  }
  // Apply guest state after clearing cache
  applyMobileMenuState(false, false);
}

// Mobile Logout Button
const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
if (mobileLogoutBtn) {
  mobileLogoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Sign out using Supabase
    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }
    
    // Clear all caches
    clearAllCaches();
    
    // Update menu state
    applyMobileMenuState(false, false);
    closeMobileMenu();
    
    // Optionally redirect to homepage
    // window.location.href = 'eventhive-homepage.html';
  });
}

// Note: We do NOT clear caches on beforeunload because:
// 1. It fires on navigation between HTML pages (we want cache to persist)
// 2. The Supabase auth token persists across navigation, so our cache should too
// 3. Cache is already cleared on explicit logout and SIGNED_OUT events

// Listen for auth state changes (when user logs in/out)
// Force check when auth state changes (bypasses 5-minute cache)
if (typeof getSupabaseClient === 'function') {
  const supabase = getSupabaseClient();
  if (supabase) {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // User logged out - clear caches and update menu
        clearAllCaches();
        applyMobileMenuState(false, false);
      } else {
        updateMobileMenuAuthState(true); // Force check on auth state change
      }
    });
  }
}

// Initialize: Load cached state on DOM ready (backup - ensures it's applied)
document.addEventListener('DOMContentLoaded', () => {
  // Apply cached state immediately if available (base default on cache)
  const cached = getCachedAuthState();
  if (cached !== null) {
    // Use cached state immediately - ABSOLUTE DEFAULT for next 5 minutes
    // NO async checks - cache is valid for 5 minutes from login
    // This is the state from initial login check - use it absolutely
    applyMobileMenuState(cached.isLoggedIn, cached.isAdmin);
    // DO NOT call updateMobileMenuAuthState - cache is absolute for 5 minutes
  } else {
    // No cache - default to guest state
    applyMobileMenuState(false, false);
    // Only check auth if no cache exists
    updateMobileMenuAuthState(false).catch(err => {
      console.error('Error updating mobile menu auth state:', err);
    });
  }
});

// Set up periodic check every 5 minutes (background refresh)
// This runs continuously and automatically updates cache every 5 minutes
// Timer starts from login time (stored in cache timestamp)
let mobileAuthCheckInterval = setInterval(() => {
  // Check if cache exists and if 5 minutes have passed since login
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const timeSinceLogin = Date.now() - parsed.timestamp;
      
      if (timeSinceLogin >= AUTH_CHECK_INTERVAL) {
        // 5 minutes have passed since login - refresh cache in background
        updateMobileMenuAuthState(true);
      }
      // If less than 5 minutes, do nothing - use cache only
    } else {
      // No cache - check auth
      updateMobileMenuAuthState(true);
    }
  } catch (e) {
    console.error('Error in periodic mobile auth check:', e);
  }
}, 60000); // Check every minute to see if 5 minutes have passed since login
