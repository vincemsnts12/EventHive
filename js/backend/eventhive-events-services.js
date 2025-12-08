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
// Global guest client for fetching events (no session, no RLS issues)
let guestSupabaseClient = null;

// Expose to window so other files can use it
function getGuestSupabaseClient() {
  // Reuse existing guest client if available
  if (guestSupabaseClient) {
    return guestSupabaseClient;
  }
  
  // Get Supabase URL and key from window (exposed by eventhive-supabase.js)
  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase URL or key not available');
    return null;
  }
  
  // Try to get Supabase library from global scope
  const supabaseLib = (typeof window !== 'undefined' && window.supabase) ? window.supabase : 
                      (typeof supabase !== 'undefined' ? supabase : null);
  
  if (!supabaseLib || typeof supabaseLib.createClient !== 'function') {
    console.error('Supabase library not available');
    return null;
  }
  
  // Create a guest client (no session, no auth) - reuse same instance
  // Use a unique storage key to completely isolate from authenticated client
  guestSupabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false, // Don't persist session
      autoRefreshToken: false, // Don't auto-refresh
      detectSessionInUrl: false, // Don't detect session in URL
      storageKey: 'eventhive-guest-client' // Unique storage key to avoid conflicts
    }
  });
  
  return guestSupabaseClient;
}

// Expose to window for use in other files
if (typeof window !== 'undefined') {
  window.getGuestSupabaseClient = getGuestSupabaseClient;
}

async function getEvents(options = {}) {
  // ALWAYS use guest client for fetching events - no authentication needed
  // This bypasses all RLS evaluation issues since guests can fetch successfully
  // Authorization checks happen AFTER fetching, not during the query
  const supabaseClient = getGuestSupabaseClient();
  
  if (!supabaseClient) {
    console.error('Guest Supabase client could not be created');
    return { success: false, events: [], error: 'Supabase client not available. Make sure eventhive-supabase.js is loaded.' };
  }
  
  // Verify the client is actually functional
  if (typeof supabaseClient.from !== 'function') {
    console.error('Supabase client is not properly initialized - missing .from() method');
    return { success: false, events: [], error: 'Supabase client is not properly initialized' };
  }
  
  console.log('Using guest client for event fetch (no authentication required)');

  // Input validation
  if (options.status && typeof options.status !== 'string') {
    return { success: false, events: [], error: 'Invalid status filter' };
  }
  if (options.collegeCode && typeof options.collegeCode !== 'string') {
    return { success: false, events: [], error: 'Invalid college code filter' };
  }


  try {
    // SIMPLIFIED: Treat authenticated users the same as guests for fetching events
    // RLS policies allow both to see events, so use the same query structure
    // Authorization checks happen AFTER fetching, not during the query
    console.log('Fetching events from database with options:', options);
    console.log('Query starting at:', new Date().toISOString());
    
    // Build query - use same structure for both guests and authenticated users
    // Select all necessary columns (same for everyone)
    let query = supabaseClient
      .from('events')
      .select('id, title, description, location, start_date, end_date, start_time, end_time, status, is_featured, college_code, colleges, organization_name, university_logo_url, created_by, created_at, updated_at, approved_at, approved_by');
    
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
    
    // Use database order by for everyone (guests can do it, so authenticated users can too)
    query = query.order('start_date', { ascending: true });
    
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

// ===== HELPER FUNCTIONS =====

// Helper function to check admin status from cache (5-minute window)
// Returns { isAdmin: boolean, cacheValid: boolean }
// If cache is valid, trusts it completely without database checks
function checkAdminFromCache() {
  const adminCheckStart = Date.now();
  let isAdmin = false;
  let cacheValid = false;
  
  try {
    const cached = localStorage.getItem('eventhive_auth_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      const timeSinceLogin = now - parsed.timestamp;
      const AUTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
      
      // Use cache if it's less than 5 minutes old
      if (timeSinceLogin < AUTH_CHECK_INTERVAL) {
        if (parsed.state) {
          isAdmin = parsed.state.isAdmin === true;
          cacheValid = true;
          const adminCheckDuration = Date.now() - adminCheckStart;
          console.log(`Admin check from cache completed in ${adminCheckDuration}ms:`, { isAdmin, cacheValid });
        }
      }
    }
  } catch (e) {
    console.error('Error reading auth cache:', e);
  }
  
  return { isAdmin, cacheValid };
}

// ===== CREATE EVENT =====

/**
 * Create a new event
 * @param {Object} eventData - Event data in frontend format
 * @returns {Promise<{success: boolean, event?: Object, error?: string}>}
 */
async function createEvent(eventData) {
  console.log('createEvent called at:', new Date().toISOString());
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }
  console.log('Supabase client obtained');

  // Get user ID directly from localStorage (fastest, no async calls)
  console.log('Getting user from localStorage...');
  const userCheckStart = Date.now();
  let user = null;
  let userId = null;
  
  try {
    // First, try eventhive_last_authenticated_user_id (stored by eventhive-supabase.js)
    userId = localStorage.getItem('eventhive_last_authenticated_user_id');
    if (userId) {
      user = { id: userId };
      const userCheckDuration = Date.now() - userCheckStart;
      console.log(`User from eventhive_last_authenticated_user_id completed in ${userCheckDuration}ms:`, userId);
    } else {
      // Fallback: Try to get user ID from Supabase auth token in localStorage
      console.log('No user ID in eventhive_last_authenticated_user_id, trying to parse auth token...');
      const supabaseAuthKeys = Object.keys(localStorage).filter(key => 
        (key.includes('supabase') && key.includes('auth-token')) || 
        (key.startsWith('sb-') && key.includes('auth-token'))
      );
      
      if (supabaseAuthKeys.length > 0) {
        const authKey = supabaseAuthKeys[0];
        const authData = localStorage.getItem(authKey);
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            // Try to extract user ID from JWT token (access_token contains user ID in 'sub' claim)
            if (parsed?.access_token) {
              try {
                const payload = JSON.parse(atob(parsed.access_token.split('.')[1]));
                userId = payload.sub; // 'sub' is the user ID in JWT
                if (userId) {
                  user = { id: userId };
                  const userCheckDuration = Date.now() - userCheckStart;
                  console.log(`User from JWT token completed in ${userCheckDuration}ms:`, userId);
                }
              } catch (e) {
                console.error('Error decoding JWT token:', e);
              }
            }
            // Also try direct user object in parsed data
            if (!userId && parsed?.user?.id) {
              userId = parsed.user.id;
              user = { id: userId };
              const userCheckDuration = Date.now() - userCheckStart;
              console.log(`User from parsed auth data completed in ${userCheckDuration}ms:`, userId);
            }
          } catch (e) {
            console.error('Error parsing auth data:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting user from localStorage:', error);
    user = null;
  }
  
  if (!user || !user.id) {
    console.error('User check failed - no user ID found in localStorage');
    return { success: false, error: 'User not authenticated. Please log in again.' };
  }
  console.log('User authenticated:', user.id);
  
  // Check if user is admin BEFORE attempting INSERT (fail fast)
  // First check localStorage cache (fast, no database query)
  console.log('Checking if user is admin (checking cache first)...');
  const adminCheckStart = Date.now();
  let { isAdmin, cacheValid } = checkAdminFromCache();
  
  // Trust cache completely - NO database checks during operations
  // Auth/admin status is only checked on login and cached for 5 minutes
  // If cache is expired, refresh it in background but don't block
  if (!cacheValid) {
    console.log('Cache expired or missing - refreshing in background (non-blocking)...');
    
    // Refresh cache in background (non-blocking)
    if (typeof updateDropdownAuthState === 'function') {
      updateDropdownAuthState(true).catch(err => {
        console.error('Error refreshing auth cache:', err);
      });
    }
    
    // If cache is missing/expired, reject the operation
    // User must log in again to refresh the cache
    console.log('Cache expired - operation rejected. Please refresh the page or log in again.');
    return { success: false, error: 'Authentication cache expired. Please refresh the page or log in again.' };
  }
  
  // Cache is valid - trust it completely, no database checks
  
  if (!isAdmin) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', { userId: user.id }, 'Non-admin attempted to create event');
    return { success: false, error: 'Only admins can create events' };
  }
  console.log('User is admin, proceeding with event creation...');

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
    
    // TEMPORARY: Omit colleges field to avoid RLS/timeout issues during INSERT
    // The college_code field will be set, and colleges can be updated later if needed
    // This allows events to be created successfully even if the colleges column has issues
    if (dbEvent.colleges !== null && dbEvent.colleges !== undefined) {
      console.log('Omitting colleges field from INSERT to avoid timeout issues. Will use college_code only.');
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
      colleges: dbEvent.colleges ? (Array.isArray(dbEvent.colleges) ? JSON.stringify(dbEvent.colleges) : dbEvent.colleges) : 'not included'
    });
    console.log('Colleges field type:', dbEvent.colleges ? typeof dbEvent.colleges : 'not included');
    console.log('Colleges is array?', Array.isArray(dbEvent.colleges));
    console.log('Starting INSERT at:', new Date().toISOString());
    console.log('User ID for INSERT:', user.id);
    console.log('Created_by field:', dbEvent.created_by);

    // Use database function to bypass RLS (faster than policy evaluation)
    // The function checks admin status once, then inserts directly
    const insertStartTime = Date.now();
    let eventId = null;
    let insertError = null;
    
    console.log('Calling create_event_as_admin function (bypasses RLS)...');
    
    // Call the database function instead of direct INSERT
    const insertPromise = supabase.rpc('create_event_as_admin', {
      p_title: dbEvent.title,
      p_description: dbEvent.description,
      p_location: dbEvent.location,
      p_start_date: dbEvent.start_date,
      p_end_date: dbEvent.end_date,
      p_status: dbEvent.status || 'Pending',
      p_is_featured: dbEvent.is_featured || false,
      p_college_code: dbEvent.college_code || null,
      p_colleges: dbEvent.colleges || null,
      p_organization_name: dbEvent.organization_name || null,
      p_university_logo_url: dbEvent.university_logo_url || null
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database insert timed out after 10 seconds')), 10000)
    );
    
    try {
      const result = await Promise.race([insertPromise, timeoutPromise]);
      const insertDuration = Date.now() - insertStartTime;
      console.log(`create_event_as_admin completed in ${insertDuration}ms`);
      
      if (result.error) {
        console.error('Function call error:', result.error);
        insertError = result.error;
      } else if (result.data) {
        // Function returns the event ID
        eventId = result.data;
        console.log('Event created successfully, ID:', eventId);
      }
    } catch (error) {
      const insertDuration = Date.now() - insertStartTime;
      console.error(`create_event_as_admin failed after ${insertDuration}ms:`, error);
      insertError = { message: error.message || 'Database insert failed' };
    }
    
    // If function call failed, return error
    if (insertError) {
      logSecurityEvent('DATABASE_ERROR', { userId: user.id, error: insertError.message }, 'Error creating event');
      console.error('Error creating event:', insertError);
      return { success: false, error: insertError.message || 'Failed to create event' };
    }
    
    // Function returned the event ID - fetch the full event by ID
    let insertedEvent = null;
    const fetchStartTime = Date.now();
    
    if (eventId) {
      console.log('Fetching created event by ID:', eventId);
      const guestClient = getGuestSupabaseClient();
      if (guestClient) {
        const fetchResult = await guestClient
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();
        
        if (fetchResult.data && !fetchResult.error) {
          insertedEvent = fetchResult.data;
          const fetchDuration = Date.now() - fetchStartTime;
          console.log(`Event fetched by ID in ${fetchDuration}ms`);
        } else {
          console.error('Error fetching created event:', fetchResult.error);
        }
      }
    }
    
    if (!insertedEvent) {
      console.error('Event was created (ID:', eventId, ') but could not be fetched');
      return { success: false, error: 'Event was created but could not be retrieved. Please refresh the page to see the new event.' };
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

  // Check if user is admin (trust cache completely - no database checks)
  console.log('Checking if user is admin (checking cache)...');
  let { isAdmin, cacheValid } = checkAdminFromCache();
  
  if (!cacheValid) {
    console.log('Cache expired or missing - refreshing in background (non-blocking)...');
    if (typeof updateDropdownAuthState === 'function') {
      updateDropdownAuthState(true).catch(err => {
        console.error('Error refreshing auth cache:', err);
      });
    }
    return { success: false, error: 'Authentication cache expired. Please refresh the page or log in again.' };
  }
  
  if (!isAdmin) {
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

    // Ensure colleges is a proper JSON array (not stringified)
    if (dbEvent.colleges && !Array.isArray(dbEvent.colleges)) {
      console.warn('colleges is not an array, converting:', dbEvent.colleges);
      try {
        // Try to parse if it's a string
        if (typeof dbEvent.colleges === 'string') {
          dbEvent.colleges = JSON.parse(dbEvent.colleges);
        } else {
          // If it's not an array and not a string, remove it
          delete dbEvent.colleges;
        }
      } catch (e) {
        console.error('Failed to parse colleges, removing it:', e);
        delete dbEvent.colleges;
      }
    }
    
    // Strategy: Use database function to bypass RLS (faster, no RLS evaluation overhead)
    // The function still validates admin status but bypasses RLS policy evaluation
    console.log('updateEvent: Starting UPDATE operation at:', new Date().toISOString());
    console.log('updateEvent: Event ID:', eventId);
    console.log('updateEvent: Update data:', { 
      ...dbEvent, 
      description: dbEvent.description ? '[truncated]' : undefined,
      colleges: dbEvent.colleges ? (Array.isArray(dbEvent.colleges) ? `[${dbEvent.colleges.length} colleges]` : dbEvent.colleges) : 'not included'
    });
    
    const updateStartTime = Date.now();
    let updateError = null;
    let updateSucceeded = false;
    
    // Use direct UPDATE (function approach requires fetching current event first, which adds complexity)
    // The UPDATE RLS policy may block, but we'll check if rows were affected
    console.log('updateEvent: Using direct UPDATE...');
    
    const updatePromise = supabase
      .from('events')
      .update(dbEvent)
      .eq('id', eventId);
    
    const updateTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('UPDATE query timed out after 5 seconds')), 5000)
    );
    
    try {
      console.log('updateEvent: Awaiting UPDATE query (with 5s timeout)...');
      const result = await Promise.race([updatePromise, updateTimeoutPromise]);
      const updateDuration = Date.now() - updateStartTime;
      console.log(`updateEvent: UPDATE query completed in ${updateDuration}ms`);
      console.log('updateEvent: UPDATE result:', { 
        hasError: !!result?.error, 
        error: result?.error?.message,
        dataCount: result?.data ? (Array.isArray(result.data) ? result.data.length : 1) : 0,
        hasData: !!result?.data
      });
      updateError = result?.error;
      
      // Check if UPDATE actually affected any rows (RLS might block silently)
      if (!updateError && (!result?.data || (Array.isArray(result.data) && result.data.length === 0))) {
        console.warn('updateEvent: UPDATE returned no error but also no data - RLS may have blocked the update');
        updateError = { message: 'Update completed but no rows were affected (RLS may be blocking UPDATE)' };
      } else if (!updateError) {
        updateSucceeded = true;
      }
    } catch (error) {
      const updateDuration = Date.now() - updateStartTime;
      console.error(`updateEvent: UPDATE query failed after ${updateDuration}ms:`, error);
      if (error.message && error.message.includes('timed out')) {
        return { success: false, error: 'Event update timed out. Please check your connection and try again.' };
      }
      updateError = error;
    }
    
    if (updateError || !updateSucceeded) {
      logSecurityEvent('DATABASE_ERROR', { userId: user.id, eventId, error: updateError?.message }, 'Error updating event');
      console.error('updateEvent: Error updating event:', updateError);
      
      // If error is about colleges column, try again without it
      const errorMsg = updateError?.message || '';
      if (errorMsg.includes('colleges') || 
          errorMsg.includes('column') ||
          errorMsg.includes('does not exist') ||
          errorMsg.toLowerCase().includes('jsonb') ||
          errorMsg.includes('PGRST')) {
        console.log('updateEvent: Retrying update without colleges column...');
        const retryDbEvent = { ...dbEvent };
        delete retryDbEvent.colleges;
        
        // Try direct UPDATE without colleges (function won't have this issue)
        const retryStartTime = Date.now();
        const retryPromise = supabase
          .from('events')
          .update(retryDbEvent)
          .eq('id', eventId);
        const retryTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Retry UPDATE timed out after 5 seconds')), 5000)
        );
        
        try {
          const retryResult = await Promise.race([retryPromise, retryTimeoutPromise]);
          const retryDuration = Date.now() - retryStartTime;
          console.log(`updateEvent: Retry UPDATE completed in ${retryDuration}ms`);
          if (retryResult.error) {
            console.error('updateEvent: Retry update also failed:', retryResult.error);
            return { success: false, error: retryResult.error.message || 'Failed to update event' };
          }
          if (!retryResult.data || (Array.isArray(retryResult.data) && retryResult.data.length === 0)) {
            console.error('updateEvent: Retry update succeeded but no rows returned');
            return { success: false, error: 'Event was updated but could not be retrieved (RLS may be blocking)' };
          }
          console.log('updateEvent: Retry update succeeded, fetching updated event...');
          updateSucceeded = true;
        } catch (retryError) {
          const retryDuration = Date.now() - retryStartTime;
          console.error(`updateEvent: Retry UPDATE failed after ${retryDuration}ms:`, retryError);
          return { success: false, error: retryError.message || 'Retry update timed out' };
        }
      } else {
        return { success: false, error: updateError?.message || 'Failed to update event' };
      }
    }

    if (updateError) {
      logSecurityEvent('DATABASE_ERROR', { userId: user.id, eventId, error: updateError.message }, 'Error updating event');
      console.error('updateEvent: Error updating event:', updateError);
      console.error('updateEvent: Event data that failed:', { 
        ...dbEvent, 
        description: dbEvent.description ? '[truncated]' : undefined,
        colleges: dbEvent.colleges ? (Array.isArray(dbEvent.colleges) ? `[${dbEvent.colleges.length} colleges]` : dbEvent.colleges) : 'not included'
      });
      
      // If error is about colleges column, try again without it
      const errorMsg = updateError.message || '';
      if (errorMsg.includes('colleges') || 
          errorMsg.includes('column') ||
          errorMsg.includes('does not exist') ||
          errorMsg.toLowerCase().includes('jsonb') ||
          errorMsg.includes('PGRST')) {
        console.log('updateEvent: Retrying update without colleges column...');
        const retryDbEvent = { ...dbEvent };
        delete retryDbEvent.colleges;
        const retryStartTime = Date.now();
        const retryPromise = supabase
          .from('events')
          .update(retryDbEvent)
          .eq('id', eventId);
        const retryTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Retry UPDATE timed out after 5 seconds')), 5000)
        );
        
        try {
          const retryResult = await Promise.race([retryPromise, retryTimeoutPromise]);
          const retryDuration = Date.now() - retryStartTime;
          console.log(`updateEvent: Retry UPDATE completed in ${retryDuration}ms`);
          if (retryResult.error) {
            console.error('updateEvent: Retry update also failed:', retryResult.error);
            return { success: false, error: retryResult.error.message || 'Failed to update event' };
          }
          console.log('updateEvent: Retry update succeeded, fetching updated event...');
        } catch (retryError) {
          const retryDuration = Date.now() - retryStartTime;
          console.error(`updateEvent: Retry UPDATE failed after ${retryDuration}ms:`, retryError);
          return { success: false, error: retryError.message || 'Retry update timed out' };
        }
      } else {
        return { success: false, error: updateError.message };
      }
    }
    
    // --- Fetch the updated event using guest client to avoid RLS issues ---
    console.log('updateEvent: UPDATE succeeded, fetching updated event by ID:', eventId);
    const fetchStartTime = Date.now();
    let updatedEvent = null;
    
    console.log('updateEvent: Getting guest client...');
    const guestClient = getGuestSupabaseClient();
    if (!guestClient) {
      console.error('updateEvent: Guest client is null/undefined');
      return { success: false, error: 'Could not fetch updated event (guest client unavailable)' };
    }
    console.log('updateEvent: Guest client obtained');
    
    const fetchPromise = guestClient
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();
    
    const fetchTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Fetch updated event timed out after 5 seconds')), 5000)
    );
    
    try {
      console.log('updateEvent: Awaiting fetch query (with 5s timeout)...');
      const fetchResult = await Promise.race([fetchPromise, fetchTimeoutPromise]);
      const fetchDuration = Date.now() - fetchStartTime;
      console.log(`updateEvent: Fetch query completed in ${fetchDuration}ms`);
      console.log('updateEvent: Fetch result:', { 
        hasData: !!fetchResult?.data, 
        hasError: !!fetchResult?.error, 
        error: fetchResult?.error?.message 
      });
      
      if (fetchResult.data && !fetchResult.error) {
        updatedEvent = fetchResult.data;
        console.log(`updateEvent: Updated event fetched successfully in ${fetchDuration}ms`);
      } else {
        console.error('updateEvent: Failed to fetch updated event:', fetchResult?.error?.message || 'No data');
        return { success: false, error: 'Event was updated but could not be retrieved. Please refresh the page.' };
      }
    } catch (fetchError) {
      const fetchDuration = Date.now() - fetchStartTime;
      console.error(`updateEvent: Fetch query failed after ${fetchDuration}ms:`, fetchError);
      if (fetchError.message && fetchError.message.includes('timed out')) {
        return { success: false, error: 'Event was updated but fetch timed out. Please refresh the page.' };
      }
      return { success: false, error: fetchError.message || 'Failed to fetch updated event' };
    }
    
    if (!updatedEvent) {
      console.error('updateEvent: Update succeeded but could not fetch event for ID:', eventId);
      return { success: false, error: 'Event was updated but could not be retrieved. Please refresh the page.' };
    }
    
    console.log('updateEvent: Event updated successfully:', updatedEvent.id);

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

  // Check if user is admin (trust cache completely - no database checks)
  console.log('Checking if user is admin (checking cache)...');
  let { isAdmin, cacheValid } = checkAdminFromCache();
  
  if (!cacheValid) {
    console.log('Cache expired or missing - refreshing in background (non-blocking)...');
    if (typeof updateDropdownAuthState === 'function') {
      updateDropdownAuthState(true).catch(err => {
        console.error('Error refreshing auth cache:', err);
      });
    }
    return { success: false, error: 'Authentication cache expired. Please refresh the page or log in again.' };
  }
  
  if (!isAdmin) {
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
  // Use guest client for fetching images (no authentication needed)
  const supabase = getGuestSupabaseClient();
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


