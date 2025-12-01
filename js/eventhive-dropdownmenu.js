const profileIcon = document.getElementById('profile-icon');
const dropdownMenu = document.getElementById('dropdownMenu');
const guestLinks = document.getElementById('guestLinks');
const userLinks = document.getElementById('userLinks');

// Change to true to simulate logged-in view
let isLoggedIn = false; 

profileIcon.addEventListener('click', (e) => {
  e.preventDefault();

  // Toggle visible links based on auth state
  if (isLoggedIn) {
    if (guestLinks) guestLinks.style.display = 'none';
    if (userLinks) userLinks.style.display = 'block';
  } else {
    if (guestLinks) guestLinks.style.display = 'block';
    if (userLinks) userLinks.style.display = 'none';
  }

  // Toggle menu visibility
  dropdownMenu.classList.toggle('show');
});

// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
  if (profileIcon && dropdownMenu) {
    if (!profileIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove('show');
    }
  }
});