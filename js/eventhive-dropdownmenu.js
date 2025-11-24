const profileIcon = document.getElementById('profile-icon');
const dropdownMenu = document.getElementById('dropdownMenu');

let isLoggedIn = false; 

profileIcon.addEventListener('click', () => {
  // Clear current menu
  dropdownMenu.innerHTML = '';

  if (isLoggedIn) {
    dropdownMenu.innerHTML = `
      <a href="/eventhive-profile.html">View Profile</a>
      <a href="/edit-profile.html">Edit Profile</a>
      <a href="/logout.html">Log Out</a>
    `;
  } else {
    dropdownMenu.innerHTML = `
      <a href="/login.html">Login</a>
      <a href="/signup.html">Sign Up</a>
      <a href="eventhive-profile.html">View Profile</a>
    `;
  }

  // Toggle dropdown
  dropdownMenu.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!profileIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.classList.remove('show');
  }
});
