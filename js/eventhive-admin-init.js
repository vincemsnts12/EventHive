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
        // On initial page load, pendingEventsData should be empty, but we clean up
        // any orphaned local events that match DB events to prevent duplicates
        
        // Get all DB event IDs for quick lookup
        const dbEventIds = new Set(pendingResult.events.map(e => e.id));
        
        // Clean up any local events that have been saved to DB (prevent duplicates)
        // This handles edge cases where a temp ID event wasn't properly cleaned up
        const localEventIds = Object.keys(pendingEventsData);
        localEventIds.forEach(localId => {
          // Skip if this ID already exists in DB (shouldn't happen, but defensive)
          if (dbEventIds.has(localId)) {
            return; // DB version will overwrite it below
          }
          
          const localEvent = pendingEventsData[localId];
          
          // If local event has no createdAt, it's likely a temp event
          // Check if it matches any DB event by content
          if (!localEvent.createdAt) {
            const matchingDbEvent = pendingResult.events.find(dbEvent => 
              dbEvent.title === localEvent.title &&
              dbEvent.description === localEvent.description &&
              dbEvent.location === localEvent.location &&
              // Match dates (handle both date string and Date object formats)
              (dbEvent.date === localEvent.date || 
               (dbEvent.startDate && localEvent.startDate &&
                Math.abs(new Date(dbEvent.startDate) - new Date(localEvent.startDate)) < 60000))
            );
            
            // If we found a match, remove the local version (DB version is source of truth)
            if (matchingDbEvent) {
              console.log(`Cleaning up duplicate local event ${localId}, using DB event ${matchingDbEvent.id}`);
              delete pendingEventsData[localId];
            }
          }
        });
        
        // Merge with existing data (preserves any truly new local events that haven't been saved yet)
        // Convert array to object format for compatibility
        pendingResult.events.forEach(event => {
          // Only update if event doesn't exist, or if DB version is newer
          if (!pendingEventsData[event.id] || 
              (event.updatedAt && pendingEventsData[event.id].updatedAt && 
               new Date(event.updatedAt) > new Date(pendingEventsData[event.id].updatedAt))) {
            pendingEventsData[event.id] = event;
          }
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


