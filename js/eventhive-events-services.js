// ===== EVENT CRUD SERVICES FOR SUPABASE =====
// This file contains all event-related database operations

// Ensure Supabase client is initialized
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
  }
  return supabaseClient;
}

// ===== GET EVENTS =====

/**
 * Get events with optional filters
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by status ('Pending', 'Upcoming', 'Ongoing', 'Concluded')
 * @param {boolean} options.isFeatured - Filter by featured status
 * @param {string} options.collegeCode - Filter by college code
 * @param {number} options.limit - Limit number of results
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<{success: boolean, events: Array, error?: string}>}
 */
async function getEvents(options = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, events: [], error: 'Supabase not initialized' };
  }

  try {
    let query = supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });

    // Apply filters
    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.isFeatured !== undefined) {
      query = query.eq('is_featured', options.isFeatured);
    }
    if (options.collegeCode) {
      query = query.eq('college_code', options.collegeCode);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting events:', error);
      return { success: false, events: [], error: error.message };
    }

    // Transform events to frontend format
    const events = await Promise.all((data || []).map(async (dbEvent) => {
      // Get images for this event (includes thumbnailIndex)
      const imagesResult = await getEventImages(dbEvent.id);
      const images = imagesResult.success ? imagesResult.images : [];
      const thumbnailIndex = imagesResult.success ? imagesResult.thumbnailIndex : 0;

      // Get like count
      const likesResult = await getEventLikeCount(dbEvent.id);
      const likesCount = likesResult.success ? likesResult.count : 0;

      // Transform to frontend format (with thumbnailIndex)
      return eventFromDatabase(dbEvent, images, likesCount, thumbnailIndex);
    }));

    return { success: true, events };
  } catch (error) {
    console.error('Unexpected error getting events:', error);
    return { success: false, events: [], error: error.message };
  }
}

/**
 * Get a single event by ID with all details
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, event?: Object, error?: string}>}
 */
async function getEventById(eventId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error getting event:', error);
      return { success: false, error: error.message };
    }

    // Get images (includes thumbnailIndex)
    const imagesResult = await getEventImages(eventId);
    const images = imagesResult.success ? imagesResult.images : [];
    const thumbnailIndex = imagesResult.success ? imagesResult.thumbnailIndex : 0;

    // Get like count
    const likesResult = await getEventLikeCount(eventId);
    const likesCount = likesResult.success ? likesResult.count : 0;

    // Transform to frontend format (with thumbnailIndex)
    const event = eventFromDatabase(data, images, likesCount, thumbnailIndex);

    return { success: true, event };
  } catch (error) {
    console.error('Unexpected error getting event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get featured events for carousel
 * @returns {Promise<{success: boolean, events: Array, error?: string}>}
 */
async function getFeaturedEvents() {
  return getEvents({ isFeatured: true });
}

/**
 * Get pending events (for admin dashboard)
 * @returns {Promise<{success: boolean, events: Array, error?: string}>}
 */
async function getPendingEvents() {
  return getEvents({ status: 'Pending' });
}

/**
 * Get published events (approved events, excluding pending)
 * @returns {Promise<{success: boolean, events: Array, error?: string}>}
 */
async function getPublishedEvents() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, events: [], error: 'Supabase not initialized' };
  }

  try {
    // Get events that are not pending (approved events)
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .neq('status', 'Pending')
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error getting published events:', error);
      return { success: false, events: [], error: error.message };
    }

    // Transform events
    const events = await Promise.all((data || []).map(async (dbEvent) => {
      const imagesResult = await getEventImages(dbEvent.id);
      const images = imagesResult.success ? imagesResult.images : [];
      const likesResult = await getEventLikeCount(dbEvent.id);
      const likesCount = likesResult.success ? likesResult.count : 0;
      return eventFromDatabase(dbEvent, images, likesCount);
    }));

    return { success: true, events };
  } catch (error) {
    console.error('Unexpected error getting published events:', error);
    return { success: false, events: [], error: error.message };
  }
}

// ===== CREATE EVENT =====

/**
 * Create a new event
 * @param {Object} eventData - Event data in frontend format
 * @returns {Promise<{success: boolean, event?: Object, error?: string}>}
 */
async function createEvent(eventData) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  try {
    // Transform to database format
    const dbEvent = eventToDatabase(eventData);
    
    // Set created_by
    dbEvent.created_by = user.id;
    
    // Set status to Pending by default
    dbEvent.status = 'Pending';

    // Insert event
    const { data: insertedEvent, error: insertError } = await supabase
      .from('events')
      .insert(dbEvent)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating event:', insertError);
      return { success: false, error: insertError.message };
    }

    // Handle images if provided (images should already be uploaded URLs)
    if (eventData.images && eventData.images.length > 0) {
      const thumbnailIdx = eventData.thumbnailIndex !== undefined ? eventData.thumbnailIndex : 0;
      const imagesResult = await saveEventImages(insertedEvent.id, eventData.images, thumbnailIdx);
      if (!imagesResult.success) {
        console.warn('Event created but images failed:', imagesResult.error);
      }
    }

    // Get full event with images and likes
    return getEventById(insertedEvent.id);
  } catch (error) {
    console.error('Unexpected error creating event:', error);
    return { success: false, error: error.message };
  }
}

// ===== UPDATE EVENT =====

/**
 * Update an existing event
 * @param {string} eventId - Event ID
 * @param {Object} eventData - Updated event data
 * @returns {Promise<{success: boolean, event?: Object, error?: string}>}
 */
async function updateEvent(eventId, eventData) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    return { success: false, error: 'Only admins can update events' };
  }

  try {
    // Transform to database format
    const dbEvent = eventToDatabase(eventData);
    
    // Remove id, created_at, created_by (don't update these)
    delete dbEvent.id;
    delete dbEvent.created_at;
    delete dbEvent.created_by;
    
    // Update updated_at
    dbEvent.updated_at = new Date().toISOString();

    // Update event
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(dbEvent)
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating event:', updateError);
      return { success: false, error: updateError.message };
    }

    // Update images if provided (images should already be uploaded URLs)
    if (eventData.images !== undefined) {
      const thumbnailIdx = eventData.thumbnailIndex !== undefined ? eventData.thumbnailIndex : 0;
      const imagesResult = await saveEventImages(eventId, eventData.images, thumbnailIdx);
      if (!imagesResult.success) {
        console.warn('Event updated but images failed:', imagesResult.error);
      }
    }

    // Get full event with images and likes
    return getEventById(eventId);
  } catch (error) {
    console.error('Unexpected error updating event:', error);
    return { success: false, error: error.message };
  }
}

// ===== DELETE EVENT =====

/**
 * Delete an event
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteEvent(eventId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    return { success: false, error: 'Only admins can delete events' };
  }

  try {
    // Delete event (cascade will delete images, likes, comments)
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('Error deleting event:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error deleting event:', error);
    return { success: false, error: error.message };
  }
}

// ===== APPROVE/REJECT EVENT =====

/**
 * Approve a pending event (changes status and sets approved fields)
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, event?: Object, error?: string}>}
 */
async function approveEvent(eventId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    return { success: false, error: 'Only admins can approve events' };
  }

  const { data: { user } } = await supabase.auth.getUser();

  try {
    // Get event to recalculate status
    const eventResult = await getEventById(eventId);
    if (!eventResult.success) {
      return { success: false, error: 'Event not found' };
    }

    const event = eventResult.event;
    
    // Recalculate status (will be Upcoming, Ongoing, or Concluded)
    const newStatus = calculateEventStatus(event.startDate, event.endDate, null);

    // Update event: set status, approved_at, approved_by
    const { error: updateError } = await supabase
      .from('events')
      .update({
        status: newStatus,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('Error approving event:', updateError);
      return { success: false, error: updateError.message };
    }

    // Get updated event
    return getEventById(eventId);
  } catch (error) {
    console.error('Unexpected error approving event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reject/delete a pending event
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function rejectEvent(eventId) {
  // Rejecting is the same as deleting for pending events
  return deleteEvent(eventId);
}

// ===== EVENT IMAGES HELPERS =====

/**
 * Get all images for an event
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, images: Array, thumbnailIndex: number, error?: string}>}
 */
async function getEventImages(eventId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, images: [], thumbnailIndex: 0, error: 'Supabase not initialized' };
  }

  try {
    const { data, error } = await supabase
      .from('event_images')
      .select('*')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error getting event images:', error);
      return { success: false, images: [], thumbnailIndex: 0, error: error.message };
    }

    // Transform to array of URLs
    const images = (data || []).map(img => img.image_url);
    
    // Find thumbnail index (image with display_order = 0)
    const thumbnailRow = (data || []).find(img => img.display_order === 0);
    const thumbnailIndex = thumbnailRow 
      ? images.indexOf(thumbnailRow.image_url) 
      : 0;

    return { success: true, images, thumbnailIndex };
  } catch (error) {
    console.error('Unexpected error getting event images:', error);
    return { success: false, images: [], thumbnailIndex: 0, error: error.message };
  }
}

/**
 * Save event images (replaces all existing images)
 * @param {string} eventId - Event ID
 * @param {Array<string>} imageUrls - Array of image URLs
 * @param {number} thumbnailIndex - Index of thumbnail image
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function saveEventImages(eventId, imageUrls, thumbnailIndex = 0) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    return { success: false, error: 'Only admins can manage images' };
  }

  try {
    // Delete all existing images
    const { error: deleteError } = await supabase
      .from('event_images')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('Error deleting existing images:', deleteError);
      return { success: false, error: deleteError.message };
    }

    // Insert new images
    if (imageUrls && imageUrls.length > 0) {
      const imageRows = imageUrls.map((url, index) => ({
        event_id: eventId,
        image_url: url,
        display_order: index === thumbnailIndex ? 0 : index + 1 // Thumbnail = 0, others = 1, 2, 3...
      }));

      const { error: insertError } = await supabase
        .from('event_images')
        .insert(imageRows);

      if (insertError) {
        console.error('Error inserting images:', insertError);
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error saving event images:', error);
    return { success: false, error: error.message };
  }
}

