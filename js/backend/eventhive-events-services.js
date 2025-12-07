// ===== EVENT CRUD SERVICES FOR SUPABASE =====
// This file contains all event-related database operations
// Moved to backend folder with security enhancements

// Note: getSupabaseClient() should be available globally from eventhive-supabase.js
// If it's not available, we'll get an error which will help diagnose the issue

// `getSafeUser()` is provided centrally in `js/backend/auth-utils.js`

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
  // Check if getSupabaseClient is available
  if (typeof getSupabaseClient !== 'function') {
    console.error('getSupabaseClient function not available');
    return { success: false, events: [], error: 'Supabase client not available. Make sure eventhive-supabase.js is loaded.' };
  }
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Supabase client is null');
    return { success: false, events: [], error: 'Supabase not initialized' };
  }
  
  // Verify the client is actually functional
  if (typeof supabase.from !== 'function') {
    console.error('Supabase client is not properly initialized - missing .from() method');
    return { success: false, events: [], error: 'Supabase client is not properly initialized' };
  }
  
  console.log('Supabase client verified - proceeding with query');

  // Input validation
  if (options.status && typeof options.status !== 'string') {
    return { success: false, events: [], error: 'Invalid status filter' };
  }
  if (options.collegeCode && typeof options.collegeCode !== 'string') {
    return { success: false, events: [], error: 'Invalid college code filter' };
  }

  try {
    // CRITICAL: Check if user is authenticated FIRST - auth state should already be stabilized by caller
    // DO NOT build or execute any queries until after this check completes
    let shouldSortInJS = false;
    
    // Session check - should be fast now since auth state is stabilized by caller
    try {
      const sessionCheckPromise = supabase.auth.getSession();
      const sessionCheckTimeout = new Promise((resolve) => 
        setTimeout(() => resolve({ data: { session: null }, error: null }), 500) // 500ms timeout
      );
      const sessionResult = await Promise.race([sessionCheckPromise, sessionCheckTimeout]);
      if (sessionResult?.data?.session?.user) {
        console.log('User is authenticated - will sort in JavaScript to avoid RLS timeout');
        shouldSortInJS = true;
      } else {
        console.log('User is not authenticated - using database order by');
      }
    } catch (userCheckError) {
      // If session check fails, assume guest
      console.log('Session check failed, assuming guest - using database order by');
    }
    
    // NOW that auth state is confirmed, proceed with query building and execution
    console.log('Fetching events from database with options:', options);
    console.log('Query starting at:', new Date().toISOString());
    
    // Build query - for authenticated users, skip order by to avoid RLS timeout
    // The query itself might be slow for authenticated users, but without order by it should work
    let query = supabase
      .from('events')
      .select('*');
    
    // Apply filters first
    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.isFeatured !== undefined) {
      query = query.eq('is_featured', options.isFeatured);
    }
    if (options.collegeCode) {
      query = query.eq('college_code', options.collegeCode);
    }
    
    // NEVER use order by for authenticated users - it causes RLS timeout
    // Always sort in JavaScript for authenticated users
    // Only use database order by for guests (when shouldSortInJS is false)
    if (!shouldSortInJS) {
      query = query.order('start_date', { ascending: true });
    } else {
      console.log('Skipping database order by for authenticated user - will sort in JavaScript');
    }
    
    // Apply limit/offset last
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    
    // Add timeout protection for the query
    const queryPromise = query;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database query timed out after 15 seconds')), 15000)
    );
    
    let queryResult;
    const startTime = Date.now();
    try {
      queryResult = await Promise.race([queryPromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      console.log(`Query completed in ${duration}ms`);
    } catch (timeoutError) {
      const duration = Date.now() - startTime;
      console.error(`Query timed out after ${duration}ms`);
      if (timeoutError.message && timeoutError.message.includes('timed out')) {
        console.error('Database query timed out');
        return { success: false, events: [], error: 'Database query timed out. Please check your connection and try again.' };
      }
      throw timeoutError;
    }
    
    // Sort in JavaScript if needed (for authenticated users)
    if (shouldSortInJS && queryResult.data && queryResult.data.length > 0) {
      console.log('Sorting events in JavaScript...');
      queryResult.data.sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
        return dateA - dateB;
      });
    }
    
    const { data, error } = queryResult;
    console.log('Query result:', { dataCount: data?.length || 0, error: error?.message });

    if (error) {
      logSecurityEvent('DATABASE_ERROR', { error: error.message }, 'Error getting events');
      console.error('Error getting events:', error);
      return { success: false, events: [], error: error.message };
    }

    if (!data || data.length === 0) {
      console.log('No events found in database - returning empty array');
      // Return early if no data - don't try to transform empty array
      return { success: true, events: [] };
    }

    console.log(`Processing ${data.length} events...`);

    // Transform events to frontend format with timeout protection
    // Add overall timeout for the entire transformation process
    const transformPromise = Promise.all((data || []).map(async (dbEvent) => {
      try {
        // Get images for this event (includes thumbnailIndex) with timeout
        const imagesPromise = getEventImages(dbEvent.id);
        const imagesTimeout = new Promise((resolve) => 
          setTimeout(() => resolve({ success: false, images: [], thumbnailIndex: 0 }), 5000)
        );
        const imagesResult = await Promise.race([imagesPromise, imagesTimeout]);
        const images = imagesResult.success ? imagesResult.images : [];
        const thumbnailIndex = imagesResult.success ? imagesResult.thumbnailIndex : 0;

        // Get like count with timeout
        const likesPromise = getEventLikeCount(dbEvent.id);
        const likesTimeout = new Promise((resolve) => 
          setTimeout(() => resolve({ success: false, count: 0 }), 5000)
        );
        const likesResult = await Promise.race([likesPromise, likesTimeout]);
        const likesCount = likesResult.success ? likesResult.count : 0;

        // Transform to frontend format (with thumbnailIndex)
        try {
          return eventFromDatabase(dbEvent, images, likesCount, thumbnailIndex);
        } catch (transformError) {
          console.error(`Error transforming event ${dbEvent.id}:`, transformError);
          // Return a basic event structure if transformation fails
          return {
            id: dbEvent.id,
            title: dbEvent.title || 'Untitled Event',
            description: dbEvent.description || '',
            location: dbEvent.location || '',
            date: dbEvent.start_date ? new Date(dbEvent.start_date).toLocaleDateString() : '',
            status: dbEvent.status || 'Pending',
            statusColor: 'pending',
            isFeatured: dbEvent.is_featured || false,
            likes: likesCount,
            college: dbEvent.college_code || 'TUP',
            colleges: dbEvent.college_code ? [dbEvent.college_code] : ['TUP'],
            mainCollege: dbEvent.college_code || 'TUP',
            collegeColor: 'tup',
            organization: dbEvent.organization_name || '',
            images: images,
            thumbnailIndex: 0,
            universityLogo: dbEvent.university_logo_url || 'images/tup.png',
            createdAt: dbEvent.created_at,
            updatedAt: dbEvent.updated_at,
            createdBy: dbEvent.created_by,
            startDate: dbEvent.start_date ? new Date(dbEvent.start_date) : null,
            endDate: dbEvent.end_date ? new Date(dbEvent.end_date) : null
          };
        }
      } catch (error) {
        console.error(`Error processing event ${dbEvent.id}:`, error);
        // Return event with empty images and 0 likes if processing fails
        try {
          return eventFromDatabase(dbEvent, [], 0, 0);
        } catch (fallbackError) {
          console.error(`Even fallback transformation failed for event ${dbEvent.id}:`, fallbackError);
          // Return minimal event structure
          return {
            id: dbEvent.id,
            title: dbEvent.title || 'Untitled Event',
            description: dbEvent.description || '',
            location: dbEvent.location || '',
            date: '',
            status: dbEvent.status || 'Pending',
            statusColor: 'pending',
            isFeatured: false,
            likes: 0,
            college: dbEvent.college_code || 'TUP',
            colleges: dbEvent.college_code ? [dbEvent.college_code] : ['TUP'],
            mainCollege: dbEvent.college_code || 'TUP',
            collegeColor: 'tup',
            organization: dbEvent.organization_name || '',
            images: [],
            thumbnailIndex: 0,
            universityLogo: 'images/tup.png',
            createdAt: null,
            updatedAt: null,
            createdBy: null,
            startDate: null,
            endDate: null
          };
        }
      }
    }));
    
    // Add overall timeout for the entire transformation process (15 seconds)
    const transformTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Event transformation timed out after 15 seconds')), 15000)
    );
    
    let events;
    try {
      events = await Promise.race([transformPromise, transformTimeout]);
      console.log(`Successfully processed ${events.length} events`);
    } catch (timeoutError) {
      if (timeoutError.message && timeoutError.message.includes('timed out')) {
        console.error('Event transformation timed out after 15 seconds');
        return { success: false, events: [], error: 'Event processing timed out. Some events may be slow to load.' };
      }
      throw timeoutError;
    }

    return { success: true, events };
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { error: error.message }, 'Unexpected error getting events');
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

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, error: 'Invalid event ID' };
  }

  if (!validateUUID(eventId)) {
    logSecurityEvent('INVALID_INPUT', { eventId }, 'Invalid UUID format in getEventById');
    return { success: false, error: 'Invalid event ID format' };
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      logSecurityEvent('DATABASE_ERROR', { eventId, error: error.message }, 'Error getting event');
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
    logSecurityEvent('UNEXPECTED_ERROR', { eventId, error: error.message }, 'Unexpected error getting event');
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
    console.log('Fetching published events from database...');
    
    const queryPromise = supabase
      .from('events')
      .select('*')
      .neq('status', 'Pending')
      .order('start_date', { ascending: true });
    
    // Add timeout protection for the query (15 seconds)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Published events query timed out after 15 seconds')), 15000)
    );
    
    let queryResult;
    try {
      queryResult = await Promise.race([queryPromise, timeoutPromise]);
    } catch (timeoutError) {
      if (timeoutError.message && timeoutError.message.includes('timed out')) {
        console.error('Published events query timed out after 15 seconds');
        return { success: false, events: [], error: 'Database query timed out. Please check your connection and try again.' };
      }
      throw timeoutError;
    }
    
    const { data, error } = queryResult;
    console.log('Published events query result:', { dataCount: data?.length || 0, error: error?.message });

    if (error) {
      logSecurityEvent('DATABASE_ERROR', { error: error.message }, 'Error getting published events');
      console.error('Error getting published events:', error);
      return { success: false, events: [], error: error.message };
    }

    if (!data || data.length === 0) {
      console.log('No published events found in database');
      return { success: true, events: [] };
    }

    console.log(`Processing ${data.length} published events...`);

    // Transform events with timeout protection
    const transformPromise = Promise.all((data || []).map(async (dbEvent) => {
      try {
        // Get images for this event (includes thumbnailIndex) with timeout
        const imagesPromise = getEventImages(dbEvent.id);
        const imagesTimeout = new Promise((resolve) => 
          setTimeout(() => resolve({ success: false, images: [], thumbnailIndex: 0 }), 5000)
        );
        const imagesResult = await Promise.race([imagesPromise, imagesTimeout]);
        const images = imagesResult.success ? imagesResult.images : [];
        const thumbnailIndex = imagesResult.success ? imagesResult.thumbnailIndex : 0;

        // Get like count with timeout
        const likesPromise = getEventLikeCount(dbEvent.id);
        const likesTimeout = new Promise((resolve) => 
          setTimeout(() => resolve({ success: false, count: 0 }), 5000)
        );
        const likesResult = await Promise.race([likesPromise, likesTimeout]);
        const likesCount = likesResult.success ? likesResult.count : 0;

        try {
          return eventFromDatabase(dbEvent, images, likesCount, thumbnailIndex);
        } catch (transformError) {
          console.error(`Error transforming published event ${dbEvent.id}:`, transformError);
          // Return basic event structure if transformation fails
          return {
            id: dbEvent.id,
            title: dbEvent.title || 'Untitled Event',
            description: dbEvent.description || '',
            location: dbEvent.location || '',
            date: dbEvent.start_date ? new Date(dbEvent.start_date).toLocaleDateString() : '',
            status: dbEvent.status || 'Published',
            statusColor: 'published',
            isFeatured: dbEvent.is_featured || false,
            likes: likesCount,
            college: dbEvent.college_code || 'TUP',
            colleges: dbEvent.college_code ? [dbEvent.college_code] : ['TUP'],
            mainCollege: dbEvent.college_code || 'TUP',
            collegeColor: 'tup',
            organization: dbEvent.organization_name || '',
            images: images,
            thumbnailIndex: 0,
            universityLogo: dbEvent.university_logo_url || 'images/tup.png',
            createdAt: dbEvent.created_at,
            updatedAt: dbEvent.updated_at,
            createdBy: dbEvent.created_by,
            startDate: dbEvent.start_date ? new Date(dbEvent.start_date) : null,
            endDate: dbEvent.end_date ? new Date(dbEvent.end_date) : null
          };
        }
      } catch (error) {
        console.error(`Error processing published event ${dbEvent.id}:`, error);
        // Return event with empty images and 0 likes if processing fails
        try {
          return eventFromDatabase(dbEvent, [], 0, 0);
        } catch (fallbackError) {
          console.error(`Even fallback transformation failed for published event ${dbEvent.id}:`, fallbackError);
          return {
            id: dbEvent.id,
            title: dbEvent.title || 'Untitled Event',
            description: dbEvent.description || '',
            location: dbEvent.location || '',
            date: '',
            status: dbEvent.status || 'Published',
            statusColor: 'published',
            isFeatured: false,
            likes: 0,
            college: dbEvent.college_code || 'TUP',
            colleges: dbEvent.college_code ? [dbEvent.college_code] : ['TUP'],
            mainCollege: dbEvent.college_code || 'TUP',
            collegeColor: 'tup',
            organization: dbEvent.organization_name || '',
            images: [],
            thumbnailIndex: 0,
            universityLogo: 'images/tup.png',
            createdAt: null,
            updatedAt: null,
            createdBy: null,
            startDate: null,
            endDate: null
          };
        }
      }
    }));
    
    // Add overall timeout for the entire transformation process (15 seconds)
    const transformTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Published event transformation timed out after 15 seconds')), 15000)
    );
    
    let events;
    try {
      events = await Promise.race([transformPromise, transformTimeout]);
      console.log(`Successfully processed ${events.length} published events`);
    } catch (timeoutError) {
      if (timeoutError.message && timeoutError.message.includes('timed out')) {
        console.error('Published event transformation timed out after 15 seconds');
        return { success: false, events: [], error: 'Event processing timed out. Some events may be slow to load.' };
      }
      throw timeoutError;
    }

    return { success: true, events };
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { error: error.message }, 'Unexpected error getting published events');
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

  const user = await getSafeUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  // Input validation
  const title = validateEventTitle(eventData.title);
  if (!title) {
    logSecurityEvent('INVALID_INPUT', { userId: user.id, field: 'title' }, 'Invalid event title');
    return { success: false, error: 'Invalid event title' };
  }

  const description = validateEventDescription(eventData.description);
  if (!description) {
    logSecurityEvent('INVALID_INPUT', { userId: user.id, field: 'description' }, 'Invalid event description');
    return { success: false, error: 'Invalid event description' };
  }

  const location = validateEventLocation(eventData.location);
  if (!location) {
    logSecurityEvent('INVALID_INPUT', { userId: user.id, field: 'location' }, 'Invalid event location');
    return { success: false, error: 'Invalid event location' };
  }

  // Filter profanity from description
  const filteredDescription = filterProfanity(description);
  if (containsProfanity(description)) {
    logSecurityEvent('PROFANITY_FILTERED', { userId: user.id, field: 'description' }, 'Profanity filtered from event description');
  }

  try {
    // Transform to database format
    const dbEvent = eventToDatabase({
      ...eventData,
      title: title,
      description: filteredDescription,
      location: location
    });
    
    // Validate that dates were successfully parsed (required by database)
    // If parsing failed, provide default dates (today 9 AM - 5 PM) as fallback
    if (!dbEvent.start_date || !dbEvent.end_date) {
      console.warn('Date parsing failed, using default dates. Event data:', eventData);
      const today = new Date();
      const startDate = new Date(today);
      startDate.setHours(9, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(17, 0, 0, 0);
      
      dbEvent.start_date = formatDateForDatabase(startDate);
      dbEvent.end_date = formatDateForDatabase(endDate);
      
      logSecurityEvent('INVALID_INPUT', { userId: user.id, field: 'date' }, 'Failed to parse event dates, using defaults');
    }
    
    // Set created_by
    dbEvent.created_by = user.id;
    
    // Set status to Pending by default
    dbEvent.status = 'Pending';
    
    // Ensure colleges is valid JSONB format (array or omit if not set)
    // Only include colleges if it's a valid non-empty array
    // If the column doesn't exist yet, omitting it won't cause an error
    if (dbEvent.colleges !== null && dbEvent.colleges !== undefined) {
      if (!Array.isArray(dbEvent.colleges)) {
        console.warn('Colleges is not an array, omitting from insert:', dbEvent.colleges);
        delete dbEvent.colleges;
      } else if (dbEvent.colleges.length === 0) {
        // Omit empty arrays - column might not exist or we don't need it
        delete dbEvent.colleges;
      }
      // If it's a valid array with items, keep it (Supabase will handle JSONB conversion)
    } else {
      // If colleges is null/undefined, don't include it in the insert
      delete dbEvent.colleges;
    }
    
    // Remove any undefined values to avoid issues
    Object.keys(dbEvent).forEach(key => {
      if (dbEvent[key] === undefined) {
        delete dbEvent[key];
      }
    });
    
    console.log('Inserting event with data:', { 
      ...dbEvent, 
      description: dbEvent.description ? '[truncated]' : undefined,
      colleges: dbEvent.colleges ? `[${dbEvent.colleges.length} colleges]` : 'not included'
    });

    // Insert event with timeout protection
    const insertPromise = supabase
      .from('events')
      .insert(dbEvent)
      .select()
      .single();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database insert timed out after 15 seconds')), 15000)
    );
    
    let insertedEvent, insertError;
    try {
      const result = await Promise.race([
        insertPromise,
        timeoutPromise
      ]);
      // Promise.race returns the first resolved/rejected promise
      // If insertPromise resolves, result is { data, error }
      // If timeoutPromise rejects, it throws
      insertedEvent = result?.data;
      insertError = result?.error;
    } catch (error) {
      // Handle timeout or other errors
      if (error.message && error.message.includes('timed out')) {
        console.error('Database insert timed out');
        insertError = { message: 'Database operation timed out. Please check your connection and try again.' };
      } else {
        console.error('Unexpected error during insert:', error);
        insertError = { message: error.message || 'Unknown error during event creation' };
      }
    }

    if (insertError) {
      logSecurityEvent('DATABASE_ERROR', { userId: user.id, error: insertError.message }, 'Error creating event');
      console.error('Error creating event:', insertError);
      console.error('Event data that failed:', { 
        ...dbEvent, 
        description: dbEvent.description ? '[truncated]' : undefined,
        colleges: dbEvent.colleges ? `[${dbEvent.colleges.length} colleges]` : 'not included'
      });
      console.error('Full error details:', insertError);
      
      // If error is about colleges column, try again without it
      const errorMsg = insertError.message || '';
      if (errorMsg.includes('colleges') || 
          errorMsg.includes('column') ||
          errorMsg.includes('does not exist') ||
          errorMsg.toLowerCase().includes('jsonb')) {
        console.log('Retrying insert without colleges column (column may not exist yet)...');
        const retryDbEvent = { ...dbEvent };
        delete retryDbEvent.colleges;
        const retryResult = await supabase
          .from('events')
          .insert(retryDbEvent)
          .select()
          .single();
        
        if (retryResult.error) {
          console.error('Retry also failed:', retryResult.error);
          return { success: false, error: retryResult.error.message || 'Failed to create event' };
        }
        insertedEvent = retryResult.data;
        insertError = null;
        console.log('Event created successfully after retry (without colleges column)');
      } else {
        return { success: false, error: insertError.message || 'Failed to create event' };
      }
    }
    
    if (!insertedEvent) {
      return { success: false, error: 'Event was not created - no data returned' };
    }
    
    console.log('Event inserted successfully:', insertedEvent.id);

    // Handle images if provided (images should already be uploaded URLs)
    if (eventData.images && eventData.images.length > 0) {
      const thumbnailIdx = eventData.thumbnailIndex !== undefined ? eventData.thumbnailIndex : 0;
      const imagesResult = await saveEventImages(insertedEvent.id, eventData.images, thumbnailIdx);
      if (!imagesResult.success) {
        console.warn('Event created but images failed:', imagesResult.error);
      }
    }

    logSecurityEvent('EVENT_CREATED', { userId: user.id, eventId: insertedEvent.id, title: title }, 'Event created successfully');

    // For new events, we don't need to fetch images/likes (they're empty anyway)
    // Just return the basic event structure to avoid slow getEventById call
    // The admin dashboard will refresh and load the full event if needed
    const newEvent = eventFromDatabase(insertedEvent, [], 0, 0);
    
    return {
      success: true,
      event: newEvent
    };
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { userId: user?.id, error: error.message }, 'Unexpected error creating event');
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

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, error: 'Invalid event ID' };
  }

  if (!validateUUID(eventId)) {
    logSecurityEvent('INVALID_INPUT', { eventId }, 'Invalid UUID format in updateEvent');
    return { success: false, error: 'Invalid event ID format' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', { eventId }, 'Non-admin attempted to update event');
    return { success: false, error: 'Only admins can update events' };
  }

  const user = await getSafeUser();

  // Validate and sanitize inputs
  const validatedData = { ...eventData };
  
  if (eventData.title !== undefined) {
    const title = validateEventTitle(eventData.title);
    if (!title) {
      return { success: false, error: 'Invalid event title' };
    }
    validatedData.title = title;
  }

  if (eventData.description !== undefined) {
    const description = validateEventDescription(eventData.description);
    if (!description) {
      return { success: false, error: 'Invalid event description' };
    }
    // Filter profanity
    validatedData.description = filterProfanity(description);
    if (containsProfanity(description)) {
      logSecurityEvent('PROFANITY_FILTERED', { userId: user.id, eventId, field: 'description' }, 'Profanity filtered from event description');
    }
  }

  if (eventData.location !== undefined) {
    const location = validateEventLocation(eventData.location);
    if (!location) {
      return { success: false, error: 'Invalid event location' };
    }
    validatedData.location = location;
  }

  try {
    // Transform to database format
    const dbEvent = eventToDatabase(validatedData);
    
    // Remove id, created_at, created_by (don't update these)
    delete dbEvent.id;
    delete dbEvent.created_at;
    delete dbEvent.created_by;
    
    // Update updated_at
    dbEvent.updated_at = new Date().toISOString();

    // Remove undefined values to avoid issues
    Object.keys(dbEvent).forEach(key => {
      if (dbEvent[key] === undefined) {
        delete dbEvent[key];
      }
    });
    
    console.log('Updating event:', eventId, 'with data:', { 
      ...dbEvent, 
      description: dbEvent.description ? '[truncated]' : undefined,
      colleges: dbEvent.colleges ? `[${dbEvent.colleges.length} colleges]` : 'not included'
    });

    // Update event
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(dbEvent)
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      logSecurityEvent('DATABASE_ERROR', { userId: user.id, eventId, error: updateError.message }, 'Error updating event');
      console.error('Error updating event:', updateError);
      console.error('Event data that failed:', { 
        ...dbEvent, 
        description: dbEvent.description ? '[truncated]' : undefined,
        colleges: dbEvent.colleges ? `[${dbEvent.colleges.length} colleges]` : 'not included'
      });
      
      // If error is about colleges column, try again without it
      const errorMsg = updateError.message || '';
      if (errorMsg.includes('colleges') || 
          errorMsg.includes('column') ||
          errorMsg.includes('does not exist') ||
          errorMsg.toLowerCase().includes('jsonb') ||
          errorMsg.includes('PGRST')) {
        console.log('Retrying update without colleges column (column may not exist or have issues)...');
        const retryDbEvent = { ...dbEvent };
        delete retryDbEvent.colleges;
        const retryResult = await supabase
          .from('events')
          .update(retryDbEvent)
          .eq('id', eventId)
          .select()
          .single();
        
        if (retryResult.error) {
          console.error('Retry update also failed:', retryResult.error);
          return { success: false, error: retryResult.error.message || 'Failed to update event' };
        }
        
        if (!retryResult.data) {
          console.error('Retry update succeeded but no event returned for ID:', eventId);
          return { success: false, error: 'Event was updated but could not be retrieved' };
        }
        
        console.log('Event updated successfully after retry (without colleges column):', retryResult.data.id);
        updatedEvent = retryResult.data;
      } else {
        return { success: false, error: updateError.message };
      }
    }
    
    if (!updatedEvent) {
      console.error('Update succeeded but no event returned for ID:', eventId);
      return { success: false, error: 'Event was updated but could not be retrieved' };
    }
    
    console.log('Event updated successfully:', updatedEvent.id);

    // Update images if provided (images should already be uploaded URLs)
    if (eventData.images !== undefined) {
      const thumbnailIdx = eventData.thumbnailIndex !== undefined ? eventData.thumbnailIndex : 0;
      const imagesResult = await saveEventImages(eventId, eventData.images, thumbnailIdx);
      if (!imagesResult.success) {
        console.warn('Event updated but images failed:', imagesResult.error);
      }
    }

    logSecurityEvent('EVENT_UPDATED', { userId: user.id, eventId }, 'Event updated successfully');

    // Get full event with images and likes
    return getEventById(eventId);
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { userId: user?.id, eventId, error: error.message }, 'Unexpected error updating event');
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

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, error: 'Invalid event ID' };
  }

  if (!validateUUID(eventId)) {
    logSecurityEvent('INVALID_INPUT', { eventId }, 'Invalid UUID format in deleteEvent');
    return { success: false, error: 'Invalid event ID format' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', { eventId }, 'Non-admin attempted to delete event');
    return { success: false, error: 'Only admins can delete events' };
  }

  const user = await getSafeUser();

  try {
    // Delete event (cascade will delete images, likes, comments)
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      logSecurityEvent('DATABASE_ERROR', { userId: user.id, eventId, error: error.message }, 'Error deleting event');
      console.error('Error deleting event:', error);
      return { success: false, error: error.message };
    }

    logSecurityEvent('EVENT_DELETED', { userId: user.id, eventId }, 'Event deleted successfully');
    return { success: true };
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { userId: user?.id, eventId, error: error.message }, 'Unexpected error deleting event');
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

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, error: 'Invalid event ID' };
  }

  if (!validateUUID(eventId)) {
    logSecurityEvent('INVALID_INPUT', { eventId }, 'Invalid UUID format in approveEvent');
    return { success: false, error: 'Invalid event ID format' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', { eventId }, 'Non-admin attempted to approve event');
    return { success: false, error: 'Only admins can approve events' };
  }

  const user = await getSafeUser();

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
      logSecurityEvent('DATABASE_ERROR', { userId: user.id, eventId, error: updateError.message }, 'Error approving event');
      console.error('Error approving event:', updateError);
      return { success: false, error: updateError.message };
    }

    logSecurityEvent('EVENT_APPROVED', { userId: user.id, eventId, newStatus }, 'Event approved successfully');

    // Get updated event
    return getEventById(eventId);
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { userId: user?.id, eventId, error: error.message }, 'Unexpected error approving event');
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
  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, error: 'Invalid event ID' };
  }

  const user = await getSafeUser();
  logSecurityEvent('EVENT_REJECTED', { userId: user?.id, eventId }, 'Event rejected by admin');
  
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

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, images: [], thumbnailIndex: 0, error: 'Invalid event ID' };
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

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, error: 'Invalid event ID' };
  }

  if (!Array.isArray(imageUrls)) {
    return { success: false, error: 'Invalid image URLs array' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', { eventId }, 'Non-admin attempted to manage images');
    return { success: false, error: 'Only admins can manage images' };
  }

  try {
    // Delete all existing images (but don't fail if none exist)
    const { error: deleteError } = await supabase
      .from('event_images')
      .delete()
      .eq('event_id', eventId);

    // Ignore delete errors as there might not be any existing images
    if (deleteError) {
      console.warn('Note: No existing images to delete (this is normal for new events)', deleteError.message);
    }

    // Insert new images
    if (imageUrls && imageUrls.length > 0) {
      const imageRows = imageUrls.map((url, index) => ({
        event_id: eventId,
        image_url: url,
        display_order: index === thumbnailIndex ? 0 : index + 1 // Thumbnail = 0, others = 1, 2, 3...
      }));

      // Insert all images in one batch (without .select() to avoid JSON coercion error)
      const { error: insertError } = await supabase
        .from('event_images')
        .insert(imageRows);

      if (insertError) {
        logSecurityEvent('DATABASE_ERROR', { eventId, error: insertError.message }, 'Error inserting images');
        console.error('Error inserting images:', insertError);
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { eventId, error: error.message }, 'Unexpected error saving event images');
    console.error('Unexpected error saving event images:', error);
    return { success: false, error: error.message };
  }
}


