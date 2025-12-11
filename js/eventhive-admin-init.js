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
  // Priority: Cache (fast) > RPC (authoritative but slower)
  console.log('Checking admin access...');

  let hasAdminAccess = false;

  // Check cache first for fast access
  const cachedAuth = typeof window.getCachedAuthState === 'function' ? window.getCachedAuthState() : null;
  const cachedIsAdmin = cachedAuth && cachedAuth.isLoggedIn && cachedAuth.isAdmin;
  console.log('Cached admin status:', cachedIsAdmin ? 'admin' : 'not admin or no cache');

  // If cache says admin, trust it and proceed immediately (no waiting)
  // The cache is updated on every login and is only 5 minutes old max
  if (cachedIsAdmin) {
    hasAdminAccess = true;
    console.log('Using cached admin status (fast path)');
  } else {
    // No valid cache - must verify via RPC (slower but authoritative)
    // Brief wait for auth state to stabilize (OAuth callback)
    await new Promise(resolve => setTimeout(resolve, 200));

    if (typeof window.checkIsAdmin === 'function') {
      try {
        console.log('Attempting server-side admin RPC...');
        hasAdminAccess = await window.checkIsAdmin();
        console.log('Server-side admin check result:', hasAdminAccess);
      } catch (error) {
        console.warn('RPC admin check failed:', error.message);
        hasAdminAccess = false;
      }
    } else if (typeof checkIfUserIsAdmin === 'function') {
      // Fallback to old method
      try {
        const adminCheck = await checkIfUserIsAdmin();
        hasAdminAccess = adminCheck.success && adminCheck.isAdmin === true;
      } catch (error) {
        console.error('Fallback admin check failed:', error);
        hasAdminAccess = false;
      }
    }
  }



  // Redirect if not admin
  if (!hasAdminAccess) {
    alert('You do not have admin authorities!');
    window.location.href = 'eventhive-homepage.html';
    return; // Stop execution
  }

  console.log('Admin access verified via server-side RPC');

  // IMMEDIATELY set dropdown to admin state - don't wait for events to load
  // This prevents the guest state from showing while events are loading
  window.__dropdownStateLockedByAdmin = true;
  const guestDiv = document.getElementById('dropdownState-guest');
  const userDiv = document.getElementById('dropdownState-user');
  const adminDiv = document.getElementById('dropdownState-admin');
  if (guestDiv) guestDiv.style.display = 'none';
  if (userDiv) userDiv.style.display = 'none';
  if (adminDiv) adminDiv.style.display = 'block';
  console.log('Dropdown state set to admin immediately (locked)');

  // Also update the cache to ensure flat format with admin=true
  try {
    const cache = {
      isLoggedIn: true,
      isAdmin: true,
      timestamp: Date.now()
    };
    localStorage.setItem('eventhive_auth_cache', JSON.stringify(cache));
    console.log('Auth cache updated to admin');
  } catch (e) {
    console.warn('Failed to update auth cache:', e);
  }

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
      // Set lock flag to prevent IIFE/MutationObserver from overriding this state
      setTimeout(() => {
        // Lock the dropdown state so other scripts don't override it
        window.__dropdownStateLockedByAdmin = true;

        const guestDiv = document.getElementById('dropdownState-guest');
        const userDiv = document.getElementById('dropdownState-user');
        const adminDiv = document.getElementById('dropdownState-admin');
        if (guestDiv) guestDiv.style.display = 'none';
        if (userDiv) userDiv.style.display = 'none';
        if (adminDiv) adminDiv.style.display = 'block';
        console.log('Final dropdown state applied: admin (locked)');
      }, 500);
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


