document.addEventListener('DOMContentLoaded', () => {

  // ===== PASSWORD TOGGLE FUNCTIONALITY =====
  const passwordToggles = document.querySelectorAll('.password-toggle');
  passwordToggles.forEach(toggle => {
    const targetId = toggle.getAttribute('data-target');
    const input = document.getElementById(targetId);
    // initialize icon visibility based on input type
    const showIcon = toggle.querySelector('.icon-show');
    const hideIcon = toggle.querySelector('.icon-hide');
    if (input) {
      if (input.type === 'text') {
        if (showIcon) showIcon.style.display = 'none';
        if (hideIcon) hideIcon.style.display = 'inline-block';
      } else {
        if (showIcon) showIcon.style.display = 'inline-block';
        if (hideIcon) hideIcon.style.display = 'none';
      }
    }

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const tgt = document.getElementById(toggle.getAttribute('data-target'));
      if (tgt) {
        const wasPassword = tgt.type === 'password';
        tgt.type = wasPassword ? 'text' : 'password';
        // swap SVG visibility
        if (wasPassword) {
          if (showIcon) showIcon.style.display = 'none';
          if (hideIcon) hideIcon.style.display = 'inline-block';
        } else {
          if (showIcon) showIcon.style.display = 'inline-block';
          if (hideIcon) hideIcon.style.display = 'none';
        }
      }
    });
  });

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
      
      const inputValue = emailInput.value.trim();
      const password = passwordInput.value;
      
      // Determine if input is email or username
      const isEmail = inputValue.includes('@');
      const email = isEmail ? inputValue : null;
      const username = !isEmail ? inputValue : null;
      
      // If email provided, validate domain
      if (email) {
        if (typeof isAllowedEmailDomain === 'function') {
          if (!isAllowedEmailDomain(email)) {
            alert('Only TUP email addresses (@tup.edu.ph) are allowed.');
            return;
          }
        } else if (!email.endsWith('@tup.edu.ph')) {
          alert('Only TUP email addresses (@tup.edu.ph) are allowed.');
          return;
        }
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
            let loginEmail = email;
            
            // If username provided, look up email from profiles table
            if (username) {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('username', username)
                .single();
              
              if (profileError || !profile || !profile.email) {
                alert('Username not found or invalid.');
                if (submitBtn) {
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Login';
                }
                return;
              }
              
              loginEmail = profile.email;
            }
            
            const { data, error } = await supabase.auth.signInWithPassword({
              email: loginEmail,
              password: password
            });
            
            if (error) {
              alert('Login failed: ' + error.message);
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
              }
              if (typeof logSecurityEvent === 'function') {
                logSecurityEvent('FAILED_LOGIN', { email: email, error: error.message }, 'User login attempt failed');
              }
            } else {
              // Success - wait for both auth and profile to load BEFORE completing login
              // This ensures dropdown is functional immediately after login
              
              // Wait for session to be fully established
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Load and cache auth state (includes dashboard/admin status)
              // WAIT for this to complete - this is the login delay
              let isLoggedIn = false;
              let isAdmin = false;
              
              if (typeof getCurrentUser === 'function') {
                const userResult = await getCurrentUser();
                isLoggedIn = userResult.success && userResult.user !== null;
                
                // Check if user is admin (WAIT for this)
                if (isLoggedIn && typeof checkIfUserIsAdmin === 'function') {
                  const adminResult = await checkIfUserIsAdmin();
                  isAdmin = adminResult.success && adminResult.isAdmin === true;
                }
              }
              
              // Cache auth state with login timestamp (5-minute timer starts from here)
              // This is the ABSOLUTE default state for the next 5 minutes
              const saveFunction = window.saveCachedAuthState || (typeof saveCachedAuthState !== 'undefined' ? saveCachedAuthState : null);
              if (saveFunction) {
                saveFunction(isLoggedIn, isAdmin);
              } else {
                // Fallback: save directly
                try {
                  const cache = {
                    timestamp: Date.now(), // Login time - 5-minute timer starts here
                    state: { isLoggedIn, isAdmin }
                  };
                  localStorage.setItem('eventhive_auth_cache', JSON.stringify(cache));
                } catch (e) {
                  console.error('Error caching auth state:', e);
                }
              }
              
              // Update UI immediately with cached state (ABSOLUTE DEFAULT)
              const applyFunction = window.applyAuthStateToUI || (typeof applyAuthStateToUI !== 'undefined' ? applyAuthStateToUI : null);
              if (applyFunction) {
                applyFunction(isLoggedIn, isAdmin);
              }
              
              // Load and cache profile data (WAIT for this - part of login delay)
              if (typeof getUserProfile === 'function') {
                try {
                  const profileResult = await getUserProfile();
                  if (profileResult.success && profileResult.profile) {
                    // Cache profile data in localStorage
                    try {
                      const profileCache = {
                        timestamp: Date.now(),
                        profile: profileResult.profile
                      };
                      localStorage.setItem('eventhive_profile_cache', JSON.stringify(profileCache));
                      console.log('Profile cached after login');
                    } catch (e) {
                      console.error('Error caching profile:', e);
                    }
                  }
                } catch (err) {
                  console.error('Error preloading profile:', err);
                }
              }
              
              // Update mobile menu
              if (typeof updateMobileMenuAuthState === 'function') {
                await updateMobileMenuAuthState();
              }
              
              // Now close modal and complete login (both auth and profile are loaded)
              loginModal.style.display = 'none';
              emailInput.value = '';
              passwordInput.value = '';
              
              console.log('Login complete - auth cache and profile cache loaded, 5-minute timer started');
              
              // Log security event
              if (typeof logSecurityEvent === 'function') {
                logSecurityEvent('SUCCESSFUL_LOGIN', { email: email }, 'User logged in successfully');
              }
            }
          } catch (err) {
            console.error('Login error:', err);
            alert('An error occurred during login. Please try again.');
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
      const usernameInput = document.getElementById('signup-username');
      const passwordInput = document.getElementById('signup-password');
      const confirmPasswordInput = document.getElementById('signup-confirm-password');
      const submitBtn = signupForm.querySelector('.auth-modal__submit');
      
      if (!emailInput || !passwordInput || !confirmPasswordInput || !usernameInput) {
        alert('Signup form fields not found.');
        return;
      }
      
      const email = emailInput.value.trim();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      
      // Validate email domain
      if (!email.endsWith('@tup.edu.ph')) {
        alert('Only TUP email addresses (@tup.edu.ph) are allowed.');
        return;
      }
      
      // Validate username
      if (!username || username.length < 3) {
        alert('Username must be at least 3 characters long.');
        return;
      }
      
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        alert('Username can only contain letters, numbers, underscores, and hyphens.');
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
            // Check if username is already taken
            const { data: existingUser, error: checkError } = await supabase
              .from('profiles')
              .select('id')
              .eq('username', username)
              .single();
            
            if (existingUser) {
              alert('Username is already taken. Please choose another one.');
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign Up';
              }
              return;
            }
            
            const { data, error } = await supabase.auth.signUp({
              email: email,
              password: password,
              options: {
                data: {
                  username: username
                },
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
              
              // Set flag to show welcome message on first sign-in (after email verification)
              // Store the user ID if available, otherwise store email as fallback
              if (data?.user?.id) {
                localStorage.setItem('eventhive_just_signed_up', data.user.id);
              } else {
                // If user ID not available yet, store email - will be checked in auth listener
                localStorage.setItem('eventhive_just_signed_up_email', email);
              }
              
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