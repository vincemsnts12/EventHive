// ===== SEARCH PAGE INITIALIZATION =====
// Load events from Supabase for search/filter page

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Supabase to initialize
  if (typeof initSupabase === 'function') {
    initSupabase();
  }

  // Load all events from Supabase
  if (typeof getEvents === 'function') {
    try {
      const result = await getEvents();
      
      if (result.success && result.events) {
        // Convert array to object format for compatibility
        result.events.forEach(event => {
          eventsData[event.id] = event;
        });
        
        console.log('Events loaded from Supabase for search:', Object.keys(eventsData).length);
        
        // Populate events (this function checks eventsData)
        if (typeof populateEvents === 'function') {
          populateEvents();
        }
      } else {
        console.warn('Failed to load events:', result.error);
        // Show empty state - no events yet
        if (typeof populateEvents === 'function') {
          populateEvents(); // Will show empty state
        }
      }
    } catch (error) {
      console.error('Error loading events:', error);
      // Show empty state - no events yet
      if (typeof populateEvents === 'function') {
        populateEvents(); // Will show empty state
      }
    }
  } else {
    console.warn('getEvents function not available');
    // Show empty state
    if (typeof populateEvents === 'function') {
      populateEvents(); // Will show empty state
    }
  }
});


