// ===== ADMIN DASHBOARD INITIALIZATION =====
// Load events from Supabase on page load

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Admin dashboard initializing...');
  
  // Wait for Supabase to initialize
  if (typeof initSupabase === 'function') {
    initSupabase();
  } else {
    console.warn('initSupabase function not found');
  }
  
  // Wait a bit for Supabase to initialize
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Load events from Supabase if functions are available
  if (typeof getPublishedEvents === 'function' && typeof getPendingEvents === 'function') {
    console.log('Loading events from Supabase...');
    try {
      // Load published events
      console.log('Fetching published events...');
      const publishedResult = await getPublishedEvents();
      console.log('Published events result:', publishedResult);
      
      if (publishedResult.success) {
        // Convert array to object format for compatibility
        publishedResult.events.forEach(event => {
          eventsData[event.id] = event;
        });
        console.log(`Loaded ${publishedResult.events.length} published events`);
      } else {
        console.error('Failed to load published events:', publishedResult.error);
      }
      
      // Load pending events
      console.log('Fetching pending events...');
      const pendingResult = await getPendingEvents();
      console.log('Pending events result:', pendingResult);
      
      if (pendingResult.success) {
        // Replace with DB data (no merge needed since we create directly in DB now)
        // Convert array to object format for compatibility
        pendingEventsData = {};
        pendingResult.events.forEach(event => {
          pendingEventsData[event.id] = event;
        });
        console.log(`Loaded ${pendingResult.events.length} pending events`);
      } else {
        console.error('Failed to load pending events:', pendingResult.error);
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
      // Fallback: use local data if Supabase fails
      if (typeof populatePublishedEventsTable === 'function') {
        populatePublishedEventsTable();
      }
      if (typeof populatePendingEventsTable === 'function') {
        populatePendingEventsTable();
      }
    }
  } else {
    console.error('getPublishedEvents or getPendingEvents functions not available');
    console.log('Available functions:', {
      getPublishedEvents: typeof getPublishedEvents,
      getPendingEvents: typeof getPendingEvents
    });
    // Fallback: use local data if Supabase functions not available
    if (typeof populatePublishedEventsTable === 'function') {
      populatePublishedEventsTable();
    }
    if (typeof populatePendingEventsTable === 'function') {
      populatePendingEventsTable();
    }
  }
});


