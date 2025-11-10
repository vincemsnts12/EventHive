const profileIcon = document.getElementById('profile-icon');
const dropdownMenu = document.getElementById('dropdownMenu');

profileIcon.addEventListener('click', () => {
  dropdownMenu.classList.toggle('show');
});

// Optional: close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!profileIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.classList.remove('show');
  }
});
