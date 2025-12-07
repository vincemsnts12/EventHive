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
  // OPTIMIZATION: Check localStorage for session data first - if valid and recent, skip session check
  const supabase = getSupabaseClient();
  if (supabase) {
    let authStabilized = false;
    let shouldSkipSessionCheck = false;
    
    // Check localStorage for Supabase session data
    // Supabase stores session in localStorage with key pattern: sb-{project-ref}-auth-token
    // We'll check all localStorage keys that match this pattern
    try {
      const localStorageKeys = Object.keys(localStorage);
      const supabaseSessionKey = localStorageKeys.find(key => 
        key.includes('supabase') && key.includes('auth-token')
      ) || localStorageKeys.find(key => 
        key.startsWith('sb-') && key.includes('auth-token')
      );
      
      if (supabaseSessionKey) {
        const sessionDataStr = localStorage.getItem(supabaseSessionKey);
        if (sessionDataStr) {
          try {
            const sessionData = JSON.parse(sessionDataStr);
            // Check if session has access_token and expires_at
            if (sessionData.access_token && sessionData.expires_at) {
              const expiresAt = sessionData.expires_at;
              const now = Math.floor(Date.now() / 1000); // Current time in seconds
              const thirtyMinutesAgo = now - (30 * 60); // 30 minutes ago in seconds
              
              // If session expires_at is within the last 30 minutes, it's recent enough
              // (expires_at is in the future, so if it's > 30 mins from now, it's valid)
              if (expiresAt > thirtyMinutesAgo) {
                console.log('Valid session found in localStorage (less than 30 minutes old), skipping session check');
                shouldSkipSessionCheck = true;
                // Wait longer for connection to fully initialize and auth state to settle
                // This is critical for authenticated users to avoid RLS timeout
                // On reload, SIGNED_IN event may fire during initialization, so wait longer
                console.log('Waiting for connection to fully initialize and auth events to settle...');
                
                // Wait for auth state listener to complete if SIGNED_IN event is firing
                // Check if SIGNED_IN event might be in progress by waiting a bit longer
                await new Promise(resolve => setTimeout(resolve, 2500)); // 2.5 seconds to ensure SIGNED_IN completes
                
                authStabilized = true;
                console.log('Auth state stabilized (using cached session)');
              } else {
                console.log('Session in localStorage is older than 30 minutes, will verify with session check');
              }
            }
          } catch (parseError) {
            console.log('Could not parse session data from localStorage, will verify with session check');
          }
        }
      }
    } catch (localStorageError) {
      console.log('Could not check localStorage for session, will verify with session check');
    }
    
    // If we didn't skip the session check, do the normal verification
    if (!shouldSkipSessionCheck) {
      let retries = 0;
      const maxAuthRetries = 20; // 20 retries * 200ms = 4 seconds max wait
      
      console.log('Waiting for auth state to stabilize...');
      
      while (retries < maxAuthRetries && !authStabilized) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms between checks
        retries++;
        
        try {
          // Add timeout to getSession() to prevent hanging when session exists in localStorage
          const sessionCheckPromise = supabase.auth.getSession();
          const sessionCheckTimeout = new Promise((resolve) => 
            setTimeout(() => resolve({ data: { session: null }, error: { message: 'Session check timeout' } }), 1000) // 1 second timeout
          );
          const sessionResult = await Promise.race([sessionCheckPromise, sessionCheckTimeout]);
          
          // Check if we got a timeout
          if (sessionResult?.error?.message === 'Session check timeout') {
            console.log(`Session check timed out (attempt ${retries}/${maxAuthRetries}), retrying...`);
            continue; // Retry
          }
          
          const hasSession = !!sessionResult?.data?.session?.user;
          
          if (hasSession) {
            // User is authenticated - wait longer to ensure SIGNED_IN event completed and connection is ready
            console.log('Authenticated user detected, waiting for auth state to fully stabilize...');
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 seconds after session detected
            authStabilized = true;
            console.log('Auth state stabilized for authenticated user');
          } else {
            // No session - guest user, can proceed immediately
            authStabilized = true;
            console.log('Guest user detected, auth state is stable');
          }
        } catch (sessionError) {
          // If session check fails, log and retry
          console.log(`Session check error (attempt ${retries}/${maxAuthRetries}):`, sessionError.message || sessionError);
          if (retries >= maxAuthRetries) {
            console.warn('Session check failed after max retries, proceeding anyway');
            authStabilized = true; // Proceed anyway to avoid infinite loop
          }
        }
      }
      
      if (!authStabilized) {
        console.warn('Auth state did not stabilize after max retries, proceeding anyway...');
        authStabilized = true; // Proceed anyway
      }
    }
    
    console.log('Auth state stabilized, ensuring connection is ready...');
    
    // Final connection readiness check - wait longer to ensure auth events have fully settled
    // This is especially important on reload when SIGNED_IN event fires during initialization
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second final wait for auth events
    
    console.log('Connection ready, proceeding with event fetch...');
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


