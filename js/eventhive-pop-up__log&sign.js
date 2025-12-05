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

  // ===== EMAIL/PASSWORD LOGIN FORM =====
  const loginForm = loginModal?.querySelector('.auth-modal-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const emailInput = document.getElementById('login-email');
      const passwordInput = document.getElementById('login-password');
      const submitBtn = loginForm.querySelector('.auth-modal__submit');
      
      if (!emailInput || !passwordInput) {
        alert('Login form fields not found.');
        return;
      }
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      // Validate email domain
      if (!email.endsWith('@tup.edu.ph')) {
        alert('Only TUP email addresses (@tup.edu.ph) are allowed.');
        return;
      }
      
      // Disable submit button
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
      }
      
      // Sign in with Supabase
      if (typeof getSupabaseClient === 'function') {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: email,
              password: password
            });
            
            if (error) {
              alert('Login failed: ' + error.message);
              // Re-enable submit button
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
              }
            } else {
              // Success - close modal and update UI
              loginModal.style.display = 'none';
              // Clear form
              emailInput.value = '';
              passwordInput.value = '';
              
              // Wait a moment for session to be established
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Update UI immediately
              if (typeof updateDropdownAuthState === 'function') {
                await updateDropdownAuthState();
              }
              if (typeof updateMobileMenuAuthState === 'function') {
                await updateMobileMenuAuthState();
              }
              
              // Force a page refresh of the UI elements (in case they're cached)
              // Trigger a custom event that other components can listen to
              window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { loggedIn: true } }));
              
              // Log security event
              if (typeof logSecurityEvent === 'function') {
                logSecurityEvent('SUCCESSFUL_LOGIN', { email: email }, 'User logged in successfully');
              }
            }
          } catch (err) {
            console.error('Login error:', err);
            alert('An error occurred during login. Please try again.');
            // Re-enable submit button
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Login';
            }
          }
        } else {
          alert('Supabase is not configured. Please check your configuration.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
          }
        }
      } else {
        alert('Supabase functions not available. Please check your configuration.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Login';
        }
      }
    });
  }

  // ===== EMAIL/PASSWORD SIGNUP FORM =====
  const signupForm = signupModal?.querySelector('.auth-modal-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const emailInput = document.getElementById('signup-email');
      const passwordInput = document.getElementById('signup-password');
      const confirmPasswordInput = document.getElementById('signup-confirm-password');
      const submitBtn = signupForm.querySelector('.auth-modal__submit');
      
      if (!emailInput || !passwordInput || !confirmPasswordInput) {
        alert('Signup form fields not found.');
        return;
      }
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      
      // Validate email domain
      if (!email.endsWith('@tup.edu.ph')) {
        alert('Only TUP email addresses (@tup.edu.ph) are allowed.');
        return;
      }
      
      // Validate password match
      if (password !== confirmPassword) {
        alert('Passwords do not match.');
        return;
      }
      
      // Validate password strength
      if (password.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
      }
      
      // Disable submit button
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing up...';
      }
      
      // Sign up with Supabase
      if (typeof getSupabaseClient === 'function') {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { data, error } = await supabase.auth.signUp({
              email: email,
              password: password,
              options: {
                emailRedirectTo: window.location.origin + window.location.pathname
              }
            });
            
            if (error) {
              alert('Signup failed: ' + error.message);
              // Re-enable submit button
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign Up';
              }
            } else {
              // Success - show message and close modal
              alert('Signup successful! Please check your email to verify your account.');
              signupModal.style.display = 'none';
              // Clear form
              emailInput.value = '';
              passwordInput.value = '';
              confirmPasswordInput.value = '';
              
              // Log security event
              if (typeof logSecurityEvent === 'function') {
                logSecurityEvent('USER_SIGNUP', { email: email }, 'New user signed up');
              }
            }
          } catch (err) {
            console.error('Signup error:', err);
            alert('An error occurred during signup. Please try again.');
            // Re-enable submit button
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Sign Up';
            }
          }
        } else {
          alert('Supabase is not configured. Please check your configuration.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign Up';
          }
        }
      } else {
        alert('Supabase functions not available. Please check your configuration.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign Up';
        }
      }
    });
  }

});