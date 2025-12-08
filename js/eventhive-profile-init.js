// ===== PROFILE PAGE INITIALIZATION =====
// Load events from Supabase for liked events section

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
        
        console.log('Events loaded from Supabase for profile:', Object.keys(eventsData).length);
        
        // Trigger liked events rendering (if the script is loaded)
        // The liked events script will check if eventsData is populated
        if (typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('eventsLoaded'));
        }
      } else {
        console.warn('Failed to load events:', result.error);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  } else {
    console.warn('getEvents function not available');
  }
});

