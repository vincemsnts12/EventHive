// ===== HOMEPAGE INITIALIZATION =====
// Load events from Supabase for carousel and top events

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
        
        console.log('Events loaded from Supabase:', Object.keys(eventsData).length);
        
        // Initialize carousel and top events (these functions check eventsData)
        // Wait a bit for carousel script to load
        setTimeout(() => {
          if (typeof initSlides === 'function') {
            initSlides();
          }
          if (typeof goToSlide === 'function') {
            goToSlide(0); // Reset to first slide
          }
          if (typeof renderTopEvents === 'function') {
            renderTopEvents();
          }
        }, 100);
      } else {
        console.warn('Failed to load events:', result.error);
        // Show empty state - no events yet
      }
    } catch (error) {
      console.error('Error loading events:', error);
      // Show empty state - no events yet
    }
  } else {
    console.warn('getEvents function not available');
  }
});

