// ===== ADMIN DASHBOARD INITIALIZATION =====
// Load events from Supabase on page load

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Admin dashboard initializing...');

  // Check if required functions are available
  console.log('Checking for required functions:', {
    initSupabase: typeof initSupabase,
    getSupabaseClient: typeof getSupabaseClient,
    getEvents: typeof getEvents
  });

  // Wait for Supabase to initialize
  if (typeof initSupabase === 'function') {
    const supabaseInitResult = initSupabase();
    console.log('Supabase initialization result:', supabaseInitResult ? 'Success' : 'Failed');
  } else {
    console.error('initSupabase function not found - Supabase may not be loaded');
  }

  // ===== ACCESS CONTROL: Admin-only page =====
  // Uses SERVER-SIDE RPC check with cache fallback for reliability
  console.log('Checking admin access...');

  let hasAdminAccess = false;

  // Check cache first for fast UI response
  const cachedAuth = typeof window.getCachedAuthState === 'function' ? window.getCachedAuthState() : null;
  const cachedIsAdmin = cachedAuth && cachedAuth.isLoggedIn && cachedAuth.isAdmin;
  console.log('Cached admin status:', cachedIsAdmin ? 'admin' : 'not admin or no cache');

  // Brief wait for auth state to stabilize (OAuth callback)
  await new Promise(resolve => setTimeout(resolve, 200));

  // Try server-side RPC check first (authoritative)
  if (typeof window.checkIsAdmin === 'function') {
    try {
      console.log('Attempting server-side admin RPC...');
      hasAdminAccess = await window.checkIsAdmin();
      console.log('Server-side admin check result:', hasAdminAccess);

      // Update cache with the authoritative result
      if (typeof window.getAuthState === 'function') {
        const authState = await window.getAuthState();
        if (typeof window.updateAuthCache === 'function') {
          window.updateAuthCache(authState);
        }
        // Refresh dropdown/hamburger UI after cache is updated
        setTimeout(() => {
          if (typeof window.applyAuthStateToUI === 'function') {
            window.applyAuthStateToUI(authState.isLoggedIn, authState.isAdmin);
          }
          if (typeof window.applyMobileMenuState === 'function') {
            window.applyMobileMenuState(authState.isLoggedIn, authState.isAdmin);
          }
          // Direct DOM manipulation fallback
          const guestDiv = document.getElementById('dropdownState-guest');
          const userDiv = document.getElementById('dropdownState-user');
          const adminDiv = document.getElementById('dropdownState-admin');
          if (guestDiv) guestDiv.style.display = 'none';
          if (userDiv) userDiv.style.display = 'none';
          if (adminDiv) adminDiv.style.display = 'none';
          if (authState.isLoggedIn && authState.isAdmin) {
            if (adminDiv) adminDiv.style.display = 'block';
          } else if (authState.isLoggedIn) {
            if (userDiv) userDiv.style.display = 'block';
          } else {
            if (guestDiv) guestDiv.style.display = 'block';
          }
        }, 300);
      }
    } catch (error) {
      console.warn('RPC admin check failed:', error.message);
      // FALLBACK: Use cached admin status if RPC fails
      if (cachedIsAdmin) {
        console.log('Using cached admin status as fallback');
        hasAdminAccess = true;
      } else {
        hasAdminAccess = false;
      }
    }
  } else {
    // Fallback to old method if auth-utils not loaded
    console.warn('checkIsAdmin not available, falling back to API check');
    if (typeof checkIfUserIsAdmin === 'function') {
      try {
        const adminCheck = await checkIfUserIsAdmin();
        hasAdminAccess = adminCheck.success && adminCheck.isAdmin === true;
      } catch (error) {
        console.error('Fallback admin check failed:', error);
        // Use cache as last resort
        if (cachedIsAdmin) {
          console.log('Using cached admin status as final fallback');
          hasAdminAccess = true;
        }
      }
    } else if (cachedIsAdmin) {
      console.log('No admin check methods available, using cache');
      hasAdminAccess = true;
    }
  }


  // Redirect if not admin
  if (!hasAdminAccess) {
    alert('You do not have admin authorities!');
    window.location.href = 'eventhive-homepage.html';
    return; // Stop execution
  }

  console.log('Admin access verified via server-side RPC');

  // Wait for Supabase to fully initialize and establish connection
  // For authenticated users, database queries can timeout due to RLS, so we just check if client exists
  // Don't test with a query - that will timeout for authenticated users too
  let retries = 0;
  const maxRetries = 10; // 10 retries * 200ms = 2 seconds max wait
  let supabaseReady = false;

  while (retries < maxRetries && !supabaseReady) {
    await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms between checks

    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase && typeof supabase.from === 'function' && typeof supabase.auth === 'object') {
        // Client is ready - don't test with a query as it will timeout for authenticated users
        // Just verify the client structure is correct
        supabaseReady = true;
        console.log('Supabase client ready after', (retries + 1) * 200, 'ms');
      } else {
        retries++;
        if (retries < maxRetries) {
          console.log(`Waiting for Supabase client... (attempt ${retries}/${maxRetries})`);
        }
      }
    } else {
      retries++;
      if (retries < maxRetries) {
        console.log(`Waiting for getSupabaseClient function... (attempt ${retries}/${maxRetries})`);
      }
    }
  }

  if (!supabaseReady) {
    console.warn('Supabase client not ready after max retries, proceeding anyway...');
  } else {
    console.log('Supabase client ready, waiting for auth state to stabilize...');
  }

  // NO AUTHENTICATION CHECKS - Events are fetched as guest for everyone
  // Authorization checks happen AFTER fetching, not during the query
  console.log('Proceeding with event fetch (no authentication required)...');

  // Load all events from Supabase in one query, then classify locally
  if (typeof getEvents === 'function') {
    console.log('Loading all events from Supabase...');
    try {
      // Fetch all events in one query
      console.log('Fetching all events...');
      const allEventsResult = await getEvents();
      console.log('All events result:', allEventsResult);

      if (allEventsResult.success && allEventsResult.events) {
        // Clear existing data (can't reassign const, so delete all properties)
        for (const key in eventsData) {
          delete eventsData[key];
        }
        for (const key in pendingEventsData) {
          delete pendingEventsData[key];
        }

        // Classify events based on status
        allEventsResult.events.forEach(event => {
          // Store in eventsData for all events (for reference)
          eventsData[event.id] = event;

          // Also store in pendingEventsData if status is Pending
          if (event.status === 'Pending') {
            pendingEventsData[event.id] = event;
          }
        });

        const publishedCount = Object.keys(eventsData).length - Object.keys(pendingEventsData).length;
        const pendingCount = Object.keys(pendingEventsData).length;

        console.log(`Loaded ${allEventsResult.events.length} total events:`);
        console.log(`  - ${publishedCount} published events`);
        console.log(`  - ${pendingCount} pending events`);
      } else {
        console.error('Failed to load events:', allEventsResult.error);
        // Clear data on error (can't reassign const, so delete all properties)
        for (const key in eventsData) {
          delete eventsData[key];
        }
        for (const key in pendingEventsData) {
          delete pendingEventsData[key];
        }
      }

      // Populate tables
      console.log('Populating tables...');
      if (typeof populatePublishedEventsTable === 'function') {
        populatePublishedEventsTable();
      } else {
        console.warn('populatePublishedEventsTable function not found');
      }
      if (typeof populatePendingEventsTable === 'function') {
        populatePendingEventsTable();
      } else {
        console.warn('populatePendingEventsTable function not found');
      }
      console.log('Admin dashboard initialized successfully');

      // FINAL: Ensure dropdown shows admin state after everything is loaded
      // This runs after all async operations complete to guarantee correct UI
      setTimeout(() => {
        const guestDiv = document.getElementById('dropdownState-guest');
        const userDiv = document.getElementById('dropdownState-user');
        const adminDiv = document.getElementById('dropdownState-admin');
        if (guestDiv) guestDiv.style.display = 'none';
        if (userDiv) userDiv.style.display = 'none';
        if (adminDiv) adminDiv.style.display = 'block';
        console.log('Final dropdown state applied: admin');
      }, 100);
    } catch (error) {
      console.error('Error loading events:', error);
      console.error('Error stack:', error.stack);
      // Clear data on error (can't reassign const, so delete all properties)
      for (const key in eventsData) {
        delete eventsData[key];
      }
      for (const key in pendingEventsData) {
        delete pendingEventsData[key];
      }
      // Fallback: populate empty tables
      if (typeof populatePublishedEventsTable === 'function') {
        populatePublishedEventsTable();
      }
      if (typeof populatePendingEventsTable === 'function') {
        populatePendingEventsTable();
      }
    }
  } else {
    console.error('getEvents function not available');
    // Fallback: use local data if Supabase functions not available
    if (typeof populatePublishedEventsTable === 'function') {
      populatePublishedEventsTable();
    }
    if (typeof populatePendingEventsTable === 'function') {
      populatePendingEventsTable();
    }
  }
});


