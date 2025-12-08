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
  // Check if user is logged in AND is an admin
  // Redirect to homepage if not authorized
  console.log('Checking admin access...');
  
  let hasAdminAccess = false;
  
  // First, check localStorage cache (fastest, set on login)
  try {
    const cached = localStorage.getItem('eventhive_auth_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const AUTH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
      
      if (parsed.state && (now - parsed.timestamp) < AUTH_CACHE_DURATION) {
        if (parsed.state.isAdmin === true) {
          hasAdminAccess = true;
          console.log('Admin access granted (from cache)');
        } else {
          console.log('Admin access denied (from cache) - not admin');
        }
      }
    }
  } catch (e) {
    console.warn('Error reading auth cache:', e);
  }
  
  // If not in cache or cache expired, check via API with timeout
  if (!hasAdminAccess) {
    // Wait for auth state to stabilize (OAuth callback might be processing)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (typeof checkIfUserIsAdmin === 'function') {
      try {
        // Add timeout protection (3 seconds max)
        const adminCheckPromise = checkIfUserIsAdmin();
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve({ success: false, isAdmin: false, error: 'Timeout' }), 3000)
        );
        
        const adminCheck = await Promise.race([adminCheckPromise, timeoutPromise]);
        console.log('Admin check result:', adminCheck);
        
        if (adminCheck.success && adminCheck.isAdmin === true) {
          hasAdminAccess = true;
          console.log('Admin access granted (from API)');
        } else {
          console.log('Admin access denied - user is not admin or not logged in');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    } else {
      console.error('checkIfUserIsAdmin function not available');
    }
  }
  
  // Redirect if not admin
  if (!hasAdminAccess) {
    alert('You do not have admin authorities!');
    window.location.href = 'eventhive-homepage.html';
    return; // Stop execution
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


