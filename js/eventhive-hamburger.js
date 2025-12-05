// Hamburger Menu Toggle Script
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
const mobileGuestLinks = document.getElementById('mobileGuestLinks');
const mobileUserLinks = document.getElementById('mobileUserLinks');

// Function to update mobile menu based on login state
async function updateMobileMenuAuthState() {
  // Check if user is logged in using Supabase
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
  
  if (mobileGuestLinks && mobileUserLinks) {
    if (loggedIn) {
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
  
  console.log('Mobile menu auth state updated:', { loggedIn, isAdmin });
}

// Toggle mobile menu
async function toggleMobileMenu() {
  hamburgerBtn.classList.toggle('active');
  mobileMenu.classList.toggle('active');
  mobileMenuOverlay.classList.toggle('active');
  
  // Update auth state when opening menu
  await updateMobileMenuAuthState();
  
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

// Note: We do NOT clear caches on beforeunload because:
// 1. It fires on navigation between HTML pages (we want cache to persist)
// 2. The Supabase auth token persists across navigation, so our cache should too
// 3. Cache is already cleared on explicit logout and SIGNED_OUT events

// Listen for auth state changes (when user logs in/out)
if (typeof getSupabaseClient === 'function') {
  const supabase = getSupabaseClient();
  if (supabase) {
    supabase.auth.onAuthStateChange(() => {
      updateMobileMenuAuthState();
    });
  }
}

// Initialize auth state on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Wait a bit for Supabase to initialize
  await new Promise(resolve => setTimeout(resolve, 200));
  await updateMobileMenuAuthState();
});

