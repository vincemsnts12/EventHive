document.addEventListener('DOMContentLoaded', () => {

  // ===== PASSWORD TOGGLE FUNCTIONALITY =====
  // Set flag first so other scripts know toggles will be initialized
  if (!window.__passwordTogglesInitialized) {
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
      // Skip if already initialized
      if (toggle.dataset.initialized === 'true') return;

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
        e.stopPropagation();
        const tgt = document.getElementById(toggle.getAttribute('data-target'));
        if (tgt) {
          const wasPassword = tgt.type === 'password';
          tgt.type = wasPassword ? 'text' : 'password';
          // Get fresh references to icons
          const showI = toggle.querySelector('.icon-show');
          const hideI = toggle.querySelector('.icon-hide');
          if (wasPassword) {
            if (showI) showI.style.display = 'none';
            if (hideI) hideI.style.display = 'inline-block';
          } else {
            if (showI) showI.style.display = 'inline-block';
            if (hideI) hideI.style.display = 'none';
          }
        }
      });

      // Mark as initialized
      toggle.dataset.initialized = 'true';
    });

    // Mark global initialization complete
    window.__passwordTogglesInitialized = true;
  }

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
        if (typeof showLoading === 'function') showLoading();
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
        if (typeof showLoading === 'function') showLoading();
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
    // Lockout countdown timer
    let lockoutInterval = null;
    const lockoutMessageEl = document.getElementById('loginLockoutMessage');

    function showLockoutMessage(seconds) {
      if (lockoutMessageEl) {
        lockoutMessageEl.style.display = 'block';
        const timeStr = typeof formatLockoutTime === 'function'
          ? formatLockoutTime(seconds)
          : `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
        lockoutMessageEl.innerHTML = `<strong>Account Locked</strong><br>Too many failed attempts. Try again in <span id="lockoutTimer">${timeStr}</span>`;
      }
    }

    function hideLockoutMessage() {
      if (lockoutMessageEl) {
        lockoutMessageEl.style.display = 'none';
      }
      if (lockoutInterval) {
        clearInterval(lockoutInterval);
        lockoutInterval = null;
      }
    }

    function startLockoutCountdown(seconds, email) {
      let remaining = seconds;
      showLockoutMessage(remaining);

      if (lockoutInterval) clearInterval(lockoutInterval);

      lockoutInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          hideLockoutMessage();
          // Enable submit button
          const submitBtn = loginForm.querySelector('.auth-modal__submit');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
          }
        } else {
          const timerEl = document.getElementById('lockoutTimer');
          if (timerEl) {
            const timeStr = typeof formatLockoutTime === 'function'
              ? formatLockoutTime(remaining)
              : `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;
            timerEl.textContent = timeStr;
          }
        }
      }, 1000);
    }

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

        // Check lockout status before attempting login
        if (typeof checkLoginLockout === 'function') {
          const lockoutStatus = await checkLoginLockout(email);
          if (lockoutStatus.locked) {
            startLockoutCountdown(lockoutStatus.remainingSeconds, email);
            if (submitBtn) {
              submitBtn.disabled = true;
            }
            return;
          }
        }
      }

      // Disable submit button and show loading spinner
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
      }
      if (typeof showLoading === 'function') showLoading();

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

              // Check lockout for the resolved email
              if (typeof checkLoginLockout === 'function') {
                const lockoutStatus = await checkLoginLockout(loginEmail);
                if (lockoutStatus.locked) {
                  startLockoutCountdown(lockoutStatus.remainingSeconds, loginEmail);
                  if (submitBtn) {
                    submitBtn.disabled = true;
                  }
                  return;
                }
              }
            }

            const { data, error } = await supabase.auth.signInWithPassword({
              email: loginEmail,
              password: password
            });

            if (error) {
              // Record failed login attempt
              let lockoutResult = { locked: false, attemptsLeft: 8 };
              if (typeof recordFailedLogin === 'function') {
                lockoutResult = await recordFailedLogin(loginEmail);
              }

              // Check if error is due to unverified email or invalid credentials
              const errorMessage = error.message || '';

              // Check for invalid credentials FIRST (before generic 400 check)
              if (errorMessage.toLowerCase().includes('invalid login credentials') ||
                errorMessage.toLowerCase().includes('invalid password') ||
                errorMessage.toLowerCase().includes('invalid credentials')) {

                // Check if account is now locked
                if (lockoutResult.locked) {
                  if (typeof hideLoading === 'function') hideLoading();
                  startLockoutCountdown(lockoutResult.remainingSeconds, loginEmail);
                  if (submitBtn) submitBtn.disabled = true;
                  return;
                }

                // Check if this might be a Google OAuth user
                const loginEmailCheck = loginEmail || email;
                let isGoogleUser = false;

                try {
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', loginEmailCheck)
                    .single();

                  if (profile) {
                    const attemptsMsg = lockoutResult.attemptsLeft > 0
                      ? `\n\n(${lockoutResult.attemptsLeft} attempts remaining before lockout)`
                      : '';
                    if (typeof hideLoading === 'function') hideLoading();
                    alert('Invalid Credentials\n\nIf you signed up with Google, please:\n• Use "Continue with Google" to log in, OR\n• Click "Forgot Password?" to set a new password.' + attemptsMsg);
                    isGoogleUser = true;
                  }
                } catch (e) {
                  // Profile lookup failed
                }

                if (!isGoogleUser) {
                  const attemptsMsg = lockoutResult.attemptsLeft > 0
                    ? ` (${lockoutResult.attemptsLeft} attempts remaining)`
                    : '';
                  if (typeof hideLoading === 'function') hideLoading();
                  alert('Login failed: Invalid email or password.' + attemptsMsg);
                }
              } else if (errorMessage.toLowerCase().includes('email not confirmed') ||
                errorMessage.toLowerCase().includes('email not verified') ||
                errorMessage.toLowerCase().includes('confirm your email')) {
                if (typeof hideLoading === 'function') hideLoading();
                alert('Please verify before logging in. A verification has been sent to your TUP Email.');
              } else {
                if (typeof hideLoading === 'function') hideLoading();
                alert('Login failed: ' + errorMessage);
              }

              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
              }
            } else {
              // Check if email is verified
              if (data?.user && !data.user.email_confirmed_at) {
                // User is not verified - sign them out and show error
                await supabase.auth.signOut();
                if (typeof hideLoading === 'function') hideLoading();
                alert('Please verify before logging in. A verification has been sent to your TUP Email.');
                if (submitBtn) {
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Login';
                }
                if (typeof logSecurityEvent === 'function') {
                  logSecurityEvent('FAILED_LOGIN', { email: loginEmail, reason: 'unverified_email' }, 'User attempted login with unverified email');
                }
                return;
              }
              // Success - wait for both auth and profile to load BEFORE completing login
              // This ensures dropdown is functional immediately after login

              // Clear failed login attempts on successful login
              if (typeof clearLoginAttempts === 'function') {
                await clearLoginAttempts(loginEmail);
              }
              hideLockoutMessage();

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
                    // IMPORTANT: Add email to profile (profiles table doesn't have email column)
                    try {
                      const profileWithEmail = {
                        ...profileResult.profile,
                        email: loginEmail // email from login form
                      };
                      const profileCache = {
                        timestamp: Date.now(),
                        profile: profileWithEmail
                      };
                      localStorage.setItem('eventhive_profile_cache', JSON.stringify(profileCache));
                      console.log('Profile cached after login (with email)');
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

              // Check if this is a first-time signup or regular login
              const signupFlag = localStorage.getItem('eventhive_just_signed_up');
              const signupEmailFlag = localStorage.getItem('eventhive_just_signed_up_email');
              const userId = data?.user?.id;
              const isFirstTimeSignup = (signupFlag && signupFlag === userId) ||
                (signupEmailFlag && signupEmailFlag === loginEmail);

              // Now close modal and complete login (both auth and profile are loaded)
              if (typeof hideLoading === 'function') hideLoading();
              loginModal.style.display = 'none';
              emailInput.value = '';
              passwordInput.value = '';

              // Show appropriate message
              if (isFirstTimeSignup) {
                // First-time signup - show welcome message
                alert('Welcome! You have been successfully authenticated with ' + loginEmail);
                // Clear flags so it doesn't show again on next login
                localStorage.removeItem('eventhive_just_signed_up');
                localStorage.removeItem('eventhive_just_signed_up_email');
              } else {
                // Regular login - show login success message
                alert('Log in successful!');
              }

              console.log('Login complete - auth cache and profile cache loaded, 5-minute timer started');

              // Log security event
              if (typeof logSecurityEvent === 'function') {
                logSecurityEvent('SUCCESSFUL_LOGIN', { email: email }, 'User logged in successfully');
              }

              // Check for pending profile URL (guest clicked profile before logging in)
              const pendingProfileUrl = sessionStorage.getItem('eventhive_pending_profile_url');
              if (pendingProfileUrl) {
                console.log('Redirecting to pending profile URL:', pendingProfileUrl);
                sessionStorage.removeItem('eventhive_pending_profile_url');
                window.location.href = pendingProfileUrl;
                return; // Skip further processing, we're redirecting
              }
            }
          } catch (err) {
            console.error('Login error:', err);
            if (typeof hideLoading === 'function') hideLoading();
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

  // ===== FORGOT PASSWORD LINK =====
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
      e.preventDefault();

      // Get email from login form if available
      const emailInput = document.getElementById('login-email');
      let email = emailInput?.value?.trim() || '';

      // If no email, prompt for it
      if (!email) {
        email = prompt('Enter your TUP email address:');
        if (!email) return;
        email = email.trim();
      }

      // Validate email domain
      if (!email.endsWith('@tup.edu.ph')) {
        alert('Only TUP email addresses (@tup.edu.ph) are allowed.');
        return;
      }

      // Check rate limiting (server-side)
      if (typeof checkForgotPasswordRateLimit === 'function') {
        const rateLimit = await checkForgotPasswordRateLimit(email);
        if (!rateLimit.allowed) {
          const waitMins = rateLimit.nextAllowedTime
            ? Math.ceil((rateLimit.nextAllowedTime.getTime() - Date.now()) / 60000)
            : 60;
          alert(`Too many password reset requests.\n\nPlease wait ${waitMins} minutes before trying again.`);
          return;
        }
      }

      // Show loading state
      forgotPasswordLink.textContent = 'Sending...';
      forgotPasswordLink.style.pointerEvents = 'none';

      try {
        if (typeof getSupabaseClient === 'function') {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin + '/eventhive-set-password.html'
            });

            if (error) {
              console.error('Password reset error:', error);
              alert('Error sending reset email: ' + error.message);
            } else {
              // Record the request for rate limiting (server-side)
              if (typeof recordForgotPasswordRequest === 'function') {
                await recordForgotPasswordRequest(email);
              }

              alert('Password reset email sent!\n\nPlease check your TUP email inbox (and spam folder) for the reset link.\n\nThe link expires in 1 hour.');
            }
          } else {
            alert('Could not connect to authentication service.');
          }
        } else {
          alert('Authentication service is not available.');
        }
      } catch (err) {
        console.error('Forgot password error:', err);
        alert('An error occurred: ' + err.message);
      } finally {
        // Restore link
        forgotPasswordLink.textContent = 'Forgot Password?';
        forgotPasswordLink.style.pointerEvents = 'auto';
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
      if (typeof isAllowedEmailDomain === 'function') {
        if (!isAllowedEmailDomain(email)) {
          alert('Access Restricted\n\nOnly TUP email addresses (@tup.edu.ph) are allowed to register.\n\nPlease use your official TUP email address.');
          return;
        }
      } else if (!email.endsWith('@tup.edu.ph')) {
        alert('Access Restricted\n\nOnly TUP email addresses (@tup.edu.ph) are allowed to register.\n\nPlease use your official TUP email address.');
        return;
      }

      // Validate username length
      if (!username || username.length < 3) {
        alert('Invalid Username\n\nUsername must be at least 3 characters long.');
        return;
      }

      if (username.length > 30) {
        alert('Invalid Username\n\nUsername must not exceed 30 characters.');
        return;
      }

      // Validate username format
      if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        alert('Invalid Username Format\n\nUsername can only contain:\n• Letters (a-z, A-Z)\n• Numbers (0-9)\n• Underscores (_)\n• Hyphens (-)\n• Dots (.)');
        return;
      }

      // Validate password match
      if (password !== confirmPassword) {
        alert('Passwords Don\'t Match\n\nPlease ensure both password fields are identical.');
        return;
      }

      // Validate password strength using security-services.js
      if (typeof validatePasswordStrength === 'function') {
        const validation = validatePasswordStrength(password);
        if (!validation.valid) {
          alert('Password Requirements Not Met\n\n' + validation.errors.join('\n'));
          return;
        }
      } else {
        // Fallback if security-services.js not loaded
        if (password.length < 8) {
          alert('Weak Password\n\nPassword must be at least 8 characters long.');
          return;
        }
      }

      // Disable submit button and show loading spinner
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing up...';
      }
      if (typeof showLoading === 'function') showLoading();

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
              if (typeof hideLoading === 'function') hideLoading();
              alert('Username Unavailable\n\nThe username "' + username + '" is already registered.\n\nPlease choose a different username.');
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign Up';
              }
              return;
            }

            // Check if email is already registered
            const { data: existingEmail, error: emailCheckError } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', email)
              .single();

            if (existingEmail) {
              if (typeof hideLoading === 'function') hideLoading();
              alert('Email Already Registered\n\nThe email "' + email + '" is already associated with an account.\n\nPlease log in instead or use a different email.');
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
              // Check if error is due to email domain restriction
              // Supabase wraps database errors, so check both message and any nested error info
              let errorMessage = error.message || '';
              const errorDetails = error.details || error.message || '';
              const errorStatus = error.status || '';
              const fullError = (errorMessage + ' ' + errorDetails + ' ' + errorStatus).toLowerCase();

              // Check for database error related to email domain restriction
              // This catches "Database error saving new user" and similar messages
              if (fullError.includes('database error') ||
                fullError.includes('database error saving') ||
                fullError.includes('saving new user') ||
                fullError.includes('use the email provided by the tup university') ||
                fullError.includes('email domain not allowed') ||
                fullError.includes('tup university')) {
                errorMessage = 'Use the email provided by the TUP University';
              } else if (error.message) {
                errorMessage = error.message;
              }

              // Show clean message
              if (typeof hideLoading === 'function') hideLoading();
              alert(errorMessage);
              // Re-enable submit button
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign Up';
              }
            } else {
              // Success - user signed up, verification email sent
              // Set flag to show welcome message on first sign-in (after email verification)
              // Store the user ID if available, otherwise store email as fallback
              if (data?.user?.id) {
                localStorage.setItem('eventhive_just_signed_up', data.user.id);
              } else {
                // If user ID not available yet, store email - will be checked in auth listener
                localStorage.setItem('eventhive_just_signed_up_email', email);
              }

              if (typeof hideLoading === 'function') hideLoading();
              signupModal.style.display = 'none';
              // Clear form
              emailInput.value = '';
              passwordInput.value = '';
              confirmPasswordInput.value = '';

              // Log security event
              if (typeof logSecurityEvent === 'function') {
                logSecurityEvent('USER_SIGNUP', { email: email }, 'New user signed up');
              }

              // Show confirmation message - user must verify email before logging in
              alert('Account Created Successfully!\n\nA verification email has been sent to:\n' + email + '\n\nPlease check your inbox (and spam folder) and click the verification link before logging in.');
            }
          } catch (err) {
            console.error('Signup error:', err);
            if (typeof hideLoading === 'function') hideLoading();
            alert('An error occurred during signup. Please try again.');
            // Re-enable submit button
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Sign Up';
            }
          }
        } else {
          if (typeof hideLoading === 'function') hideLoading();
          alert('Supabase is not configured. Please check your configuration.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign Up';
          }
        }
      } else {
        if (typeof hideLoading === 'function') hideLoading();
        alert('Supabase functions not available. Please check your configuration.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign Up';
        }
      }
    });
  }

});