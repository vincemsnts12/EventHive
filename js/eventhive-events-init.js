// ===== EVENT DETAILS PAGE INITIALIZATION =====
// Load event from Supabase when event details page loads

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Supabase to initialize
  if (typeof initSupabase === 'function') {
    initSupabase();
  }

  // Get selected event ID from localStorage
  const eventId = getSelectedEventId();
  
  if (!eventId) {
    console.warn('No event ID found. Redirecting to homepage.');
    // Optionally redirect to homepage
    // window.location.href = 'eventhive-homepage.html';
    return;
  }

  // Load event from Supabase
  if (typeof getEventById === 'function') {
    try {
      const result = await getEventById(eventId);
      
      if (result.success && result.event) {
        // Add event to eventsData for compatibility
        eventsData[eventId] = result.event;
        
        // Update event details on page
        if (typeof updateEventDetails === 'function') {
          updateEventDetails(eventId);
        }
        
        // Initialize comments and likes
        if (typeof initializeCommentsAndLikes === 'function') {
          initializeCommentsAndLikes(eventId);
        }
        
        console.log('Event loaded from Supabase:', eventId);
      } else {
        console.error('Failed to load event:', result.error);
        // Show error message or redirect
        alert('Event not found. Redirecting to homepage.');
        window.location.href = 'eventhive-homepage.html';
      }
    } catch (error) {
      console.error('Error loading event:', error);
      alert('Error loading event. Redirecting to homepage.');
      window.location.href = 'eventhive-homepage.html';
    }
  } else {
    console.warn('getEventById function not available');
    // Fallback: try to use eventsData if it exists
    if (typeof eventsData !== 'undefined' && eventsData[eventId]) {
      if (typeof updateEventDetails === 'function') {
        updateEventDetails(eventId);
      }
    } else {
      alert('Event not found. Redirecting to homepage.');
      window.location.href = 'eventhive-homepage.html';
    }
  }
});

