// Hamburger Menu Toggle Script
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
const mobileGuestLinks = document.getElementById('mobileGuestLinks');
const mobileUserLinks = document.getElementById('mobileUserLinks');

// Use same cache as desktop dropdown (shared localStorage)
const AUTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY = 'eventhive_auth_cache';

// Get cached auth state from localStorage (shared with desktop)
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

// Save auth state to localStorage (shared with desktop)
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

// Apply auth state to mobile menu UI
function applyMobileAuthStateToUI(isLoggedIn, isAdmin) {
  if (mobileGuestLinks && mobileUserLinks) {
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
}

// Function to update mobile menu based on login state (uses cache)
async function updateMobileMenuAuthState(forceCheck = false) {
  // Check cache first (unless forced)
  if (!forceCheck) {
    const cached = getCachedAuthState();
    if (cached !== null) {
      // Use cached state - instant UI update
      applyMobileAuthStateToUI(cached.isLoggedIn, cached.isAdmin);
      return;
    }
  }
  
  // Perform actual auth check
  let loggedIn = false;
  let isAdmin = false;
  
  if (typeof getCurrentUser === 'function') {
    const userResult = await getCurrentUser();
    loggedIn = userResult.success && userResult.user !== null;
    
    // Check if user is admin
    if (loggedIn && typeof checkIfUserIsAdmin === 'function') {
      const adminResult = await checkIfUserIsAdmin();
      isAdmin = adminResult.success && adminResult.isAdmin === true;
    }
  }
  
  // Save to cache (shared with desktop)
  saveCachedAuthState(loggedIn, isAdmin);
  
  // Update UI
  applyMobileAuthStateToUI(loggedIn, isAdmin);
}

// Toggle mobile menu
function toggleMobileMenu() {
  hamburgerBtn.classList.toggle('active');
  mobileMenu.classList.toggle('active');
  mobileMenuOverlay.classList.toggle('active');
  
  // Update auth state from cache (instant, no delay)
  updateMobileMenuAuthState(false); // false = use cache if available
  
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
    localStorage.removeItem('eventhive_auth_cache');
    localStorage.removeItem('eventhive_profile_cache');
  } catch (e) {
    console.error('Error clearing caches:', e);
  }
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
    
    // Update menus
    await updateMobileMenuAuthState();
    closeMobileMenu();
    
    // Optionally redirect to homepage
    // window.location.href = 'eventhive-homepage.html';
  });
}

// Clear caches when tab closes
window.addEventListener('beforeunload', () => {
  clearAllCaches();
});

// Initialize: Load cached state immediately (no delay)
document.addEventListener('DOMContentLoaded', () => {
  // Apply cached state immediately if available
  const cached = getCachedAuthState();
  if (cached !== null) {
    applyMobileAuthStateToUI(cached.isLoggedIn, cached.isAdmin);
  }
  
  // Then check auth in background (only if cache expired or doesn't exist)
  updateMobileMenuAuthState(false);
});

// Listen for auth state changes (when user logs in/out)
// Force check when auth state changes (bypasses 5-minute cache)
if (typeof getSupabaseClient === 'function') {
  const supabase = getSupabaseClient();
  if (supabase) {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // User logged out - clear caches and update UI
        clearAllCaches();
        applyMobileAuthStateToUI(false, false);
      } else {
        updateMobileMenuAuthState(true); // Force check on auth state change
      }
    });
  }
}

// Set up periodic check every 5 minutes (background refresh)
setInterval(() => {
  updateMobileMenuAuthState(true); // Force check every 5 minutes
}, AUTH_CHECK_INTERVAL);

