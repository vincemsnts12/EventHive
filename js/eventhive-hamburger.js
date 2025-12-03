// Hamburger Menu Toggle Script
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
const mobileGuestLinks = document.getElementById('mobileGuestLinks');
const mobileUserLinks = document.getElementById('mobileUserLinks');

// Function to update mobile menu based on login state
function updateMobileMenuAuthState() {
  // Get login state from the dropdown menu script (isLoggedIn variable)
  // This checks if the global isLoggedIn variable exists
  const loggedIn = (typeof isLoggedIn !== 'undefined') ? isLoggedIn : false;
  
  if (mobileGuestLinks && mobileUserLinks) {
    if (loggedIn) {
      mobileGuestLinks.style.display = 'none';
      mobileUserLinks.style.display = 'block';
    } else {
      mobileGuestLinks.style.display = 'block';
      mobileUserLinks.style.display = 'none';
    }
  }
}

// Toggle mobile menu
function toggleMobileMenu() {
  hamburgerBtn.classList.toggle('active');
  mobileMenu.classList.toggle('active');
  mobileMenuOverlay.classList.toggle('active');
  
  // Update auth state when opening menu
  updateMobileMenuAuthState();
  
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

// Mobile Logout Button
const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
if (mobileLogoutBtn) {
  mobileLogoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // Set logged out state
    if (typeof isLoggedIn !== 'undefined') {
      isLoggedIn = false;
    }
    // Update both menus
    updateMobileMenuAuthState();
    closeMobileMenu();
    // Optionally redirect to homepage
    // window.location.href = 'eventhive-homepage.html';
  });
}

// Initialize auth state on page load
document.addEventListener('DOMContentLoaded', updateMobileMenuAuthState);

