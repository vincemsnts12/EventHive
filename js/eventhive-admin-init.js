// ===== ADMIN DASHBOARD INITIALIZATION =====
// Load events from Supabase on page load

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Supabase to initialize
  if (typeof initSupabase === 'function') {
    initSupabase();
  }
  
  // Load events from Supabase if functions are available
  if (typeof getPublishedEvents === 'function' && typeof getPendingEvents === 'function') {
    try {
      // Load published events
      const publishedResult = await getPublishedEvents();
      if (publishedResult.success) {
        // Convert array to object format for compatibility
        publishedResult.events.forEach(event => {
          eventsData[event.id] = event;
        });
      } else {
        console.warn('Failed to load published events:', publishedResult.error);
      }
      
      // Load pending events
      const pendingResult = await getPendingEvents();
      if (pendingResult.success) {
        // Convert array to object format for compatibility
        pendingResult.events.forEach(event => {
          pendingEventsData[event.id] = event;
        });
      } else {
        console.warn('Failed to load pending events:', pendingResult.error);
      }
      
      // Populate tables
      if (typeof populatePublishedEventsTable === 'function') {
        populatePublishedEventsTable();
      }
      if (typeof populatePendingEventsTable === 'function') {
        populatePendingEventsTable();
      }
    } catch (error) {
      console.error('Error loading events:', error);
      // Fallback: use local data if Supabase fails
      if (typeof populatePublishedEventsTable === 'function') {
        populatePublishedEventsTable();
      }
      if (typeof populatePendingEventsTable === 'function') {
        populatePendingEventsTable();
      }
    }
  } else {
    // Fallback: use local data if Supabase functions not available
    if (typeof populatePublishedEventsTable === 'function') {
      populatePublishedEventsTable();
    }
    if (typeof populatePendingEventsTable === 'function') {
      populatePendingEventsTable();
    }
  }
});


