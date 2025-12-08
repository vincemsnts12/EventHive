// Hamburger Menu Toggle Script
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
const mobileGuestLinks = document.getElementById('mobileGuestLinks');
const mobileUserLinks = document.getElementById('mobileUserLinks');

// Cache for auth state (5 minutes) - same as desktop dropdown
// Use values from dropdown menu script (loaded first) - don't redeclare const
// Just reference from window to avoid "already declared" error
const AUTH_CHECK_INTERVAL_HAMBURGER = window.AUTH_CHECK_INTERVAL || 5 * 60 * 1000;
const CACHE_KEY_HAMBURGER = window.CACHE_KEY || 'eventhive_auth_cache';

// Get cached auth state from localStorage
function getCachedAuthState() {
  try {
    const cached = localStorage.getItem(CACHE_KEY_HAMBURGER);
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const timeSinceLogin = now - parsed.timestamp;

      // Return cache if it's less than 5 minutes old (timer starts from login)
      if (timeSinceLogin < AUTH_CHECK_INTERVAL_HAMBURGER) {
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
  // Get elements fresh each time (they might not exist when script loads)
  const guestLinks = document.getElementById('mobileGuestLinks');
  const userLinks = document.getElementById('mobileUserLinks');

  if (!guestLinks || !userLinks) return;

  if (isLoggedIn) {
    guestLinks.style.display = 'none';
    userLinks.style.display = 'block';

    // Show/hide Dashboard link based on admin status
    const mobileDashboardBtn = document.getElementById('mobileDashboardBtn');
    if (mobileDashboardBtn) {
      mobileDashboardBtn.style.display = isAdmin ? 'block' : 'none';
    }
  } else {
    guestLinks.style.display = 'block';
    userLinks.style.display = 'none';

    // Hide dashboard link for non-logged-in users
    const mobileDashboardBtn = document.getElementById('mobileDashboardBtn');
    if (mobileDashboardBtn) {
      mobileDashboardBtn.style.display = 'none';
    }
  }
}

// Function to update mobile menu based on login state
function updateMobileMenuAuthState() {
  // Get login state from cache (same as desktop dropdown)
  const cached = getCachedAuthState();

  if (cached !== null) {
    // Use cached state immediately - NO async operations
    applyMobileMenuState(cached.isLoggedIn, cached.isAdmin);
  } else {
    // No cache - default to guest state
    applyMobileMenuState(false, false);
  }
}

// Removed IIFE - keeping it simple

// Toggle mobile menu
function toggleMobileMenu(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Get elements fresh each time (they might not exist when script loads)
  const btn = document.getElementById('hamburgerBtn');
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileMenuOverlay');

  if (!btn || !menu || !overlay) {
    return;
  }

  btn.classList.toggle('active');
  menu.classList.toggle('active');
  overlay.classList.toggle('active');

  // Update auth state when opening menu (use cache directly, no async)
  updateMobileMenuAuthState();

  // Prevent body scroll when menu is open
  if (menu.classList.contains('active')) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

// Close mobile menu
function closeMobileMenu() {
  // Get elements fresh each time
  const btn = document.getElementById('hamburgerBtn');
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileMenuOverlay');

  if (btn) btn.classList.remove('active');
  if (menu) menu.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Event listeners - attach when DOM is ready
function attachHamburgerListener() {
  const btn = document.getElementById('hamburgerBtn');
  if (btn) {
    // Remove any existing listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', toggleMobileMenu);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  attachHamburgerListener();
});

// Also try immediately if DOM is already ready
if (document.readyState !== 'loading') {
  attachHamburgerListener();
}

// Event delegation as ultimate backup
document.addEventListener('click', (e) => {
  if (e.target.closest('#hamburgerBtn')) {
    toggleMobileMenu(e);
  }
}, true);

// Overlay click listener - attach when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('mobileMenuOverlay');
  if (overlay) {
    overlay.addEventListener('click', closeMobileMenu);
  }
});

// Also try immediately if DOM is already ready
if (document.readyState !== 'loading') {
  const overlay = document.getElementById('mobileMenuOverlay');
  if (overlay) {
    overlay.addEventListener('click', closeMobileMenu);
  }
}

// Close menu on window resize (if screen becomes larger)
window.addEventListener('resize', () => {
  if (window.innerWidth > 576) {
    closeMobileMenu();
  }
});

// Close menu when clicking a link (except login/signup buttons)
document.addEventListener('DOMContentLoaded', () => {
  const mobileMenuLinks = document.querySelectorAll('.mobile-menu-nav a:not(#mobileLoginBtn):not(#mobileSignupBtn)');
  mobileMenuLinks.forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });
});

// Mobile Login/Signup/Logout Buttons - attach when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
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

  // Mobile Logout Button
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();

      // INSTANT: Clear ALL localStorage items FIRST (this is what actually logs out)
      try {
        localStorage.clear();
      } catch (err) {
        console.error('Error clearing localStorage:', err);
      }

      // Update menu state immediately
      applyMobileMenuState(false, false);
      closeMobileMenu();

      // Fire signOut in background (don't await - just let it run)
      if (typeof getSupabaseClient === 'function') {
        const supabase = getSupabaseClient();
        if (supabase) {
          supabase.auth.signOut().catch(err => {
            console.warn('Background signOut error (already logged out locally):', err);
          });
        }
      }

      // Show success message immediately
      alert('Log out successful');
    });
  }
});

// Removed auth state listener - keeping it simple

// Initialize auth state on page load
document.addEventListener('DOMContentLoaded', () => {
  // Apply cached state immediately if available
  const cached = getCachedAuthState();
  if (cached !== null) {
    // Use cached state immediately - ABSOLUTE DEFAULT for next 5 minutes
    // NO async checks - cache is valid for 5 minutes from login
    applyMobileMenuState(cached.isLoggedIn, cached.isAdmin);
  } else {
    // No cache - default to guest state
    applyMobileMenuState(false, false);
  }
});

// Removed periodic check - keeping it simple
