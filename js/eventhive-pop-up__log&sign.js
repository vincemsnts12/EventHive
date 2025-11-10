// ===== LOGIN & SIGN UP POPUP =====

// Elements
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');

const loginLink = document.querySelector('#dropdownMenu a:nth-child(2)');
const signupLink = document.querySelector('#dropdownMenu a:nth-child(3)');

const closeLoginBtn = document.getElementById('closeLoginBtn');
const closeSignupBtn = document.getElementById('closeSignupBtn');

const openSignupFromLogin = document.getElementById('openSignupFromLogin');
const openLoginFromSignup = document.getElementById('openLoginFromSignup');

// ===== OPEN POPUPS =====
loginLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginModal.style.display = 'flex';
});

signupLink.addEventListener('click', (e) => {
  e.preventDefault();
  signupModal.style.display = 'flex';
});

// ===== CLOSE POPUPS =====
closeLoginBtn.addEventListener('click', () => loginModal.style.display = 'none');
closeSignupBtn.addEventListener('click', () => signupModal.style.display = 'none');

// ===== SWITCH BETWEEN LOGIN & SIGNUP =====
openSignupFromLogin.addEventListener('click', (e) => {
  e.preventDefault();
  loginModal.style.display = 'none';
  signupModal.style.display = 'flex';
});

openLoginFromSignup.addEventListener('click', (e) => {
  e.preventDefault();
  signupModal.style.display = 'none';
  loginModal.style.display = 'flex';
});

// ===== CLOSE WHEN CLICK OUTSIDE =====
window.addEventListener('click', (e) => {
  if (e.target === loginModal) loginModal.style.display = 'none';
  if (e.target === signupModal) signupModal.style.display = 'none';
});