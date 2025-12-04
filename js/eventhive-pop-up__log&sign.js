document.addEventListener('DOMContentLoaded', () => {

  // ===== ELEMENTS =====
  const loginModal = document.getElementById('loginModal');
  const signupModal = document.getElementById('signupModal');

  const loginLink = document.getElementById('navLoginBtn');
  const signupLink = document.getElementById('navSignupBtn');

  const closeLoginBtn = document.getElementById('closeLoginBtn');
  const closeSignupBtn = document.getElementById('closeSignupBtn');

  const openSignupFromLogin = document.getElementById('openSignupFromLogin');
  const openLoginFromSignup = document.getElementById('openLoginFromSignup');

  // ===== OPEN POPUPS =====
  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginModal.style.display = 'flex';
    });
  }

  if (signupLink) {
    signupLink.addEventListener('click', (e) => {
      e.preventDefault();
      signupModal.style.display = 'flex';
    });
  }

  // ===== CLOSE POPUPS =====
  if (closeLoginBtn) {
    closeLoginBtn.addEventListener('click', () => loginModal.style.display = 'none');
  }

  if (closeSignupBtn) {
    closeSignupBtn.addEventListener('click', () => signupModal.style.display = 'none');
  }

  // ===== SWITCH BETWEEN LOGIN & SIGNUP =====
  if (openSignupFromLogin) {
    openSignupFromLogin.addEventListener('click', (e) => {
      e.preventDefault();
      loginModal.style.display = 'none';
      signupModal.style.display = 'flex';
    });
  }

  if (openLoginFromSignup) {
    openLoginFromSignup.addEventListener('click', (e) => {
      e.preventDefault();
      signupModal.style.display = 'none';
      loginModal.style.display = 'flex';
    });
  }

  // ===== CLOSE WHEN CLICK OUTSIDE =====
  window.addEventListener('click', (e) => {
    if (e.target === loginModal) loginModal.style.display = 'none';
    if (e.target === signupModal) signupModal.style.display = 'none';
  });

  // ===== GOOGLE SIGN UP BUTTON =====
  const googleSignupBtn = document.getElementById('googleSignupBtn');
  if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Check if Supabase functions are available
      if (typeof signInWithGoogle === 'function') {
        await signInWithGoogle();
      } else {
        // Fallback message if Supabase is not configured
        alert('Google sign up is not yet configured. Please configure Supabase credentials in js/eventhive-supabase.js');
        console.warn('signInWithGoogle function not found. Make sure eventhive-supabase.js is loaded and Supabase is configured.');
      }
    });
  }

  // ===== GOOGLE LOGIN BUTTON =====
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Check if Supabase functions are available
      if (typeof signInWithGoogle === 'function') {
        await signInWithGoogle();
      } else {
        // Fallback message if Supabase is not configured
        alert('Google login is not yet configured. Please configure Supabase credentials in js/eventhive-supabase.js');
        console.warn('signInWithGoogle function not found. Make sure eventhive-supabase.js is loaded and Supabase is configured.');
      }
    });
  }

});