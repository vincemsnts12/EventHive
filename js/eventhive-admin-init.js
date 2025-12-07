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
  
  // CRITICAL: Wait for auth state to fully stabilize before fetching events
  // This prevents RLS evaluation issues for authenticated users
  const supabase = getSupabaseClient();
  if (supabase) {
    let authStabilized = false;
    let retries = 0;
    const maxAuthRetries = 20; // 20 retries * 200ms = 4 seconds max wait
    
    console.log('Waiting for auth state to stabilize...');
    
    while (retries < maxAuthRetries && !authStabilized) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms between checks
      
      try {
        const sessionResult = await supabase.auth.getSession();
        const hasSession = !!sessionResult?.data?.session?.user;
        
        if (hasSession) {
          // User is authenticated - wait a bit more to ensure SIGNED_IN event completed
          console.log('Authenticated user detected, waiting for auth state to fully stabilize...');
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second after session detected
          authStabilized = true;
          console.log('Auth state stabilized for authenticated user');
        } else {
          // No session - guest user, can proceed immediately
          authStabilized = true;
          console.log('Guest user detected, auth state is stable');
        }
      } catch (sessionError) {
        // If session check fails, assume guest and proceed
        retries++;
        if (retries >= maxAuthRetries) {
          console.warn('Session check failed after max retries, proceeding as guest');
          authStabilized = true;
        }
      }
    }
    
    if (!authStabilized) {
      console.warn('Auth state did not stabilize, proceeding anyway...');
    }
    
    console.log('Auth state stabilized, proceeding with event fetch...');
  }
  
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


