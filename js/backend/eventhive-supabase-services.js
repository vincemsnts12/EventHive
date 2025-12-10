// ===== SUPABASE SERVICES FOR LIKES, COMMENTS, AND PROFILES =====
// This file contains all Supabase database operations
// Moved to backend folder for better organization
// NOTE: Requires eventhive-supabase.js to be loaded first (provides getSupabaseClient())

// `getSafeUser()` is provided centrally in `js/backend/auth-utils.js`

// ===== LIKES SERVICES =====

/**
 * Toggle like for an event (like if not liked, unlike if liked)
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, liked: boolean, error?: string}>}
 */
async function toggleEventLike(eventId) {
  // Get user ID from localStorage (check if logged in)
  let userId = null;
  try {
    userId = localStorage.getItem('eventhive_last_authenticated_user_id');
    if (!userId) {
      // Fallback: Try to get user ID from Supabase auth token in localStorage
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
            if (parsed?.access_token) {
              try {
                const payload = JSON.parse(atob(parsed.access_token.split('.')[1]));
                userId = payload.sub;
              } catch (e) {
                console.error('Error decoding JWT token:', e);
              }
            }
            if (!userId && parsed?.user?.id) {
              userId = parsed.user.id;
            }
          } catch (e) {
            console.error('Error parsing auth data:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting user from localStorage:', error);
  }

  if (!userId) {
    return { success: false, error: 'User not authenticated. Please log in to like events.' };
  }

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    logSecurityEvent('INVALID_INPUT', { eventId, userId }, 'Invalid eventId in toggleEventLike');
    return { success: false, error: 'Invalid event ID' };
  }

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Supabase configuration not available' };
  }

  // Get access token from localStorage
  let accessToken = null;
  try {
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') && key.includes('auth-token')
    );
    if (supabaseAuthKeys.length > 0) {
      const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
      accessToken = authData?.access_token;
    }
  } catch (e) {
    console.error('Error getting access token:', e);
  }

  if (!accessToken) {
    return { success: false, error: 'Authentication token not found. Please log in again.' };
  }

  try {
    // Use direct fetch API to check if user already liked this event
    console.log('toggleEventLike: Using direct fetch API...');
    console.log('toggleEventLike: Event ID:', eventId, 'User ID:', userId);

    // First fetch: Check if like exists (with separate timeout)
    const checkController = new AbortController();
    const checkTimeout = setTimeout(() => {
      console.error('toggleEventLike: Check request timed out after 10 seconds');
      checkController.abort();
    }, 10000);

    console.log('toggleEventLike: Starting check request...');
    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/event_likes?event_id=eq.${eventId}&user_id=eq.${userId}&select=id`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: checkController.signal
      }
    );

    clearTimeout(checkTimeout);
    console.log('toggleEventLike: Check request completed, status:', checkResponse.status);

    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      logSecurityEvent('DATABASE_ERROR', { eventId, userId, error: `HTTP ${checkResponse.status}: ${errorText}` }, 'Error checking like');
      console.error('Error checking like:', checkResponse.status, errorText);
      return { success: false, error: `HTTP ${checkResponse.status}: ${errorText}` };
    }

    const existingLikes = await checkResponse.json();
    const hasLiked = Array.isArray(existingLikes) && existingLikes.length > 0;
    console.log('toggleEventLike: Has liked:', hasLiked);

    if (hasLiked) {
      // Unlike: Delete the like
      const deleteController = new AbortController();
      const deleteTimeout = setTimeout(() => {
        console.error('toggleEventLike: Delete request timed out after 10 seconds');
        deleteController.abort();
      }, 10000);

      console.log('toggleEventLike: Starting delete request...');
      const deleteResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/event_likes?event_id=eq.${eventId}&user_id=eq.${userId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`
          },
          signal: deleteController.signal
        }
      );

      clearTimeout(deleteTimeout);
      console.log('toggleEventLike: Delete request completed, status:', deleteResponse.status);

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        logSecurityEvent('DATABASE_ERROR', { eventId, userId, error: `HTTP ${deleteResponse.status}: ${errorText}` }, 'Error unliking');
        console.error('Error unliking:', deleteResponse.status, errorText);
        return { success: false, error: `HTTP ${deleteResponse.status}: ${errorText}` };
      }

      logSecurityEvent('EVENT_UNLIKED', { eventId, userId }, 'Event unliked successfully');
      console.log('toggleEventLike: Successfully unliked event');
      return { success: true, liked: false };
    } else {
      // Like: Insert new like
      const insertController = new AbortController();
      const insertTimeout = setTimeout(() => {
        console.error('toggleEventLike: Insert request timed out after 10 seconds');
        insertController.abort();
      }, 10000);

      console.log('toggleEventLike: Starting insert request...');
      const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/event_likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          event_id: eventId,
          user_id: userId
        }),
        signal: insertController.signal
      });

      clearTimeout(insertTimeout);
      console.log('toggleEventLike: Insert request completed, status:', insertResponse.status);

      if (!insertResponse.ok) {
        const errorText = await insertResponse.text();
        logSecurityEvent('DATABASE_ERROR', { eventId, userId, error: `HTTP ${insertResponse.status}: ${errorText}` }, 'Error liking');
        console.error('Error liking:', insertResponse.status, errorText);
        return { success: false, error: `HTTP ${insertResponse.status}: ${errorText}` };
      }

      logSecurityEvent('EVENT_LIKED', { eventId, userId }, 'Event liked successfully');
      console.log('toggleEventLike: Successfully liked event');
      return { success: true, liked: true };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      logSecurityEvent('DATABASE_ERROR', { eventId, userId, error: 'Toggle like timed out' }, 'Error toggling like');
      return { success: false, error: 'Request timed out after 15 seconds' };
    }
    logSecurityEvent('UNEXPECTED_ERROR', { eventId, userId, error: error.message }, 'Unexpected error toggling like');
    console.error('Unexpected error toggling like:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get like count for an event
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
async function getEventLikeCount(eventId) {
  // Use guest client for fetching like counts (no authentication needed)
  // Get from window (exposed by eventhive-events-services.js) or use regular client as fallback
  let supabase;
  if (typeof window !== 'undefined' && typeof window.getGuestSupabaseClient === 'function') {
    supabase = window.getGuestSupabaseClient();
  } else if (typeof getGuestSupabaseClient === 'function') {
    supabase = getGuestSupabaseClient();
  } else {
    // Fallback to regular client if guest client function not available
    supabase = getSupabaseClient();
  }

  if (!supabase) {
    return { success: false, count: 0, error: 'Supabase not initialized' };
  }

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, count: 0, error: 'Invalid event ID' };
  }

  try {
    const { count, error } = await supabase
      .from('event_likes')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (error) {
      console.error('Error getting like count:', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Unexpected error getting like count:', error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Check if current user has liked an event
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, liked: boolean, error?: string}>}
 */
async function hasUserLikedEvent(eventId) {
  // Get user ID from localStorage (guests will have null)
  let userId = null;
  try {
    userId = localStorage.getItem('eventhive_last_authenticated_user_id');
    if (!userId) {
      // Fallback: Try to get user ID from Supabase auth token in localStorage
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
            if (parsed?.access_token) {
              try {
                const payload = JSON.parse(atob(parsed.access_token.split('.')[1]));
                userId = payload.sub;
              } catch (e) {
                // Ignore errors
              }
            }
            if (!userId && parsed?.user?.id) {
              userId = parsed.user.id;
            }
          } catch (e) {
            // Ignore errors
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors - guests will have userId = null
  }

  // Not logged in = not liked
  if (!userId) {
    return { success: true, liked: false };
  }

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, liked: false, error: 'Invalid event ID' };
  }

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, liked: false, error: 'Supabase configuration not available' };
  }

  // Get access token from localStorage
  let accessToken = null;
  try {
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') && key.includes('auth-token')
    );
    if (supabaseAuthKeys.length > 0) {
      const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
      accessToken = authData?.access_token;
    }
  } catch (e) {
    console.error('Error getting access token:', e);
  }

  if (!accessToken) {
    return { success: true, liked: false }; // No token = not liked
  }

  try {
    // Use direct fetch API to check if user liked this event
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 10000);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/event_likes?event_id=eq.${eventId}&user_id=eq.${userId}&select=id`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: fetchController.signal
      }
    );

    clearTimeout(fetchTimeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error checking user like:', response.status, errorText);
      return { success: false, liked: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const hasLiked = Array.isArray(data) && data.length > 0;

    return { success: true, liked: hasLiked };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('hasUserLikedEvent: Request timed out');
      return { success: false, liked: false, error: 'Request timed out' };
    }
    console.error('Unexpected error checking user like:', error);
    return { success: false, liked: false, error: error.message };
  }
}

/**
 * Get all event IDs that the current user has liked
 * @returns {Promise<{success: boolean, eventIds: string[], error?: string}>}
 */
async function getUserLikedEventIds() {
  // Get user ID from localStorage (faster than getSafeUser)
  const userId = localStorage.getItem('eventhive_last_authenticated_user_id');
  if (!userId) {
    return { success: true, eventIds: [] }; // Not logged in = no likes
  }

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, eventIds: [], error: 'Supabase configuration not available' };
  }

  // Get access token
  let accessToken = null;
  try {
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') && key.includes('auth-token')
    );
    if (supabaseAuthKeys.length > 0) {
      const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
      accessToken = authData?.access_token;
    }
  } catch (e) {
    console.error('Error getting access token:', e);
  }

  if (!accessToken) {
    return { success: true, eventIds: [] }; // No token = no likes
  }

  try {
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 10000);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/event_likes?user_id=eq.${userId}&select=event_id`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: fetchController.signal
      }
    );

    clearTimeout(fetchTimeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error getting user liked events:', response.status, errorText);
      return { success: false, eventIds: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const eventIds = Array.isArray(data) ? data.map(row => row.event_id) : [];
    return { success: true, eventIds };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, eventIds: [], error: 'Request timed out' };
    }
    console.error('Unexpected error getting user liked events:', error);
    return { success: false, eventIds: [], error: error.message };
  }
}

// ===== COMMENTS SERVICES =====

/**
 * Get all comments for an event (oldest first)
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, comments: Array, error?: string}>}
 */
async function getEventComments(eventId) {
  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, comments: [], error: 'Invalid event ID' };
  }

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, comments: [], error: 'Supabase configuration not available' };
  }

  try {
    // Use direct fetch API to get comments (public data, no auth needed)
    console.log('getEventComments: Using direct fetch API...');

    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 15000);

    // Fetch comments
    const commentsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?event_id=eq.${eventId}&order=created_at.asc&select=id,content,created_at,updated_at,user_id`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        signal: fetchController.signal
      }
    );

    clearTimeout(fetchTimeout);

    if (!commentsResponse.ok) {
      const errorText = await commentsResponse.text();
      console.error('Error getting comments:', commentsResponse.status, errorText);
      return { success: false, comments: [], error: `HTTP ${commentsResponse.status}: ${errorText}` };
    }

    const commentsData = await commentsResponse.json();

    if (!commentsData || commentsData.length === 0) {
      return { success: true, comments: [] };
    }

    // Get unique user IDs from comments
    const userIds = [...new Set(commentsData.map(c => c.user_id).filter(Boolean))];

    // Fetch profiles for all users in one query
    let profilesMap = {};
    if (userIds.length > 0) {
      // PostgREST uses parentheses for 'in' operator
      const userIdsParam = userIds.map(id => `"${id}"`).join(',');
      const profilesResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${userIdsParam})&select=id,username,avatar_url`,
        {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          },
          signal: fetchController.signal
        }
      );

      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json();
        if (profilesData) {
          // Create a map for quick lookup
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {});
        }
      }
    }

    // Transform data to match frontend structure
    const comments = commentsData.map(comment => {
      const profile = profilesMap[comment.user_id];
      return {
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        userId: comment.user_id,
        user: {
          id: profile?.id || comment.user_id,
          username: profile?.username || 'Unknown',
          fullName: profile?.username || 'Unknown',
          avatarUrl: profile?.avatar_url || 'images/prof_default.svg'
        }
      };
    });

    return { success: true, comments };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('getEventComments: Fetch timed out');
      return { success: false, comments: [], error: 'Request timed out after 15 seconds' };
    }
    console.error('Unexpected error getting comments:', error);
    return { success: false, comments: [], error: error.message };
  }
}

/**
 * Create a new comment on an event
 * @param {string} eventId - Event ID
 * @param {string} content - Comment content (max 200 chars)
 * @returns {Promise<{success: boolean, comment?: Object, error?: string}>}
 */
async function createComment(eventId, content) {
  // Get user ID from localStorage (check if logged in)
  let userId = null;
  try {
    userId = localStorage.getItem('eventhive_last_authenticated_user_id');
    if (!userId) {
      // Fallback: Try to get user ID from Supabase auth token in localStorage
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
            if (parsed?.access_token) {
              try {
                const payload = JSON.parse(atob(parsed.access_token.split('.')[1]));
                userId = payload.sub;
              } catch (e) {
                console.error('Error decoding JWT token:', e);
              }
            }
            if (!userId && parsed?.user?.id) {
              userId = parsed.user.id;
            }
          } catch (e) {
            console.error('Error parsing auth data:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting user from localStorage:', error);
  }

  if (!userId) {
    return { success: false, error: 'User not authenticated. Please log in to comment.' };
  }

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    logSecurityEvent('INVALID_INPUT', { eventId, userId }, 'Invalid eventId in createComment');
    return { success: false, error: 'Invalid event ID' };
  }

  if (!content || typeof content !== 'string') {
    logSecurityEvent('INVALID_INPUT', { eventId, userId }, 'Invalid content in createComment');
    return { success: false, error: 'Comment cannot be empty' };
  }

  // Trim and validate content
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    return { success: false, error: 'Comment cannot be empty' };
  }

  if (trimmedContent.length > 200) {
    logSecurityEvent('INVALID_INPUT', { eventId, userId, contentLength: trimmedContent.length }, 'Comment exceeds length limit');
    return { success: false, error: 'Comment cannot exceed 200 characters' };
  }

  // Profanity filtering
  const filteredContent = filterProfanity(trimmedContent);
  if (filteredContent !== trimmedContent) {
    logSecurityEvent('PROFANITY_FILTERED', { eventId, userId }, 'Profanity detected in comment');
  }

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Supabase configuration not available' };
  }

  // Get access token from localStorage
  let accessToken = null;
  try {
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') && key.includes('auth-token')
    );
    if (supabaseAuthKeys.length > 0) {
      const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
      accessToken = authData?.access_token;
    }
  } catch (e) {
    console.error('Error getting access token:', e);
  }

  if (!accessToken) {
    return { success: false, error: 'Authentication token not found. Please log in again.' };
  }

  try {
    // Use direct fetch API to create comment
    console.log('createComment: Using direct fetch API...');

    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 15000);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        event_id: eventId,
        user_id: userId,
        content: filteredContent
      }),
      signal: fetchController.signal
    });

    clearTimeout(fetchTimeout);

    if (!response.ok) {
      const errorText = await response.text();
      logSecurityEvent('DATABASE_ERROR', { eventId, userId, error: `HTTP ${response.status}: ${errorText}` }, 'Error creating comment');
      console.error('Error creating comment:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const commentDataArray = await response.json();
    const commentData = Array.isArray(commentDataArray) ? commentDataArray[0] : commentDataArray;

    // Fetch profile separately using direct fetch
    let profile = null;
    try {
      const profileResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,username,avatar_url`,
        {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        profile = Array.isArray(profileData) && profileData.length > 0 ? profileData[0] : null;
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    }

    // Transform data to match frontend structure
    const comment = {
      id: commentData.id,
      content: commentData.content,
      createdAt: commentData.created_at,
      updatedAt: commentData.updated_at,
      userId: commentData.user_id,
      user: {
        id: profile?.id || commentData.user_id,
        username: profile?.username || 'Unknown',
        fullName: profile?.username || 'Unknown',
        avatarUrl: profile?.avatar_url || 'images/prof_default.svg'
      }
    };

    logSecurityEvent('COMMENT_CREATED', { eventId, userId, commentId: commentData.id }, 'Comment created successfully');
    return { success: true, comment };
  } catch (error) {
    if (error.name === 'AbortError') {
      logSecurityEvent('DATABASE_ERROR', { eventId, userId, error: 'Create timed out' }, 'Error creating comment');
      return { success: false, error: 'Comment creation timed out after 15 seconds' };
    }
    logSecurityEvent('UNEXPECTED_ERROR', { eventId, userId, error: error.message }, 'Unexpected error creating comment');
    console.error('Unexpected error creating comment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a comment
 * @param {string} commentId - Comment ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteComment(commentId) {
  // Get user ID from localStorage (check if logged in)
  let userId = null;
  try {
    userId = localStorage.getItem('eventhive_last_authenticated_user_id');
    if (!userId) {
      // Fallback: Try to get user ID from Supabase auth token in localStorage
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
            if (parsed?.access_token) {
              try {
                const payload = JSON.parse(atob(parsed.access_token.split('.')[1]));
                userId = payload.sub;
              } catch (e) {
                console.error('Error decoding JWT token:', e);
              }
            }
            if (!userId && parsed?.user?.id) {
              userId = parsed.user.id;
            }
          } catch (e) {
            console.error('Error parsing auth data:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting user from localStorage:', error);
  }

  if (!userId) {
    return { success: false, error: 'User not authenticated. Please log in to delete comments.' };
  }

  // Input validation
  if (!commentId || typeof commentId !== 'string' || commentId.trim().length === 0) {
    logSecurityEvent('INVALID_INPUT', { commentId, userId }, 'Invalid commentId in deleteComment');
    return { success: false, error: 'Invalid comment ID' };
  }

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Supabase configuration not available' };
  }

  // Get access token from localStorage
  let accessToken = null;
  try {
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') && key.includes('auth-token')
    );
    if (supabaseAuthKeys.length > 0) {
      const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
      accessToken = authData?.access_token;
    }
  } catch (e) {
    console.error('Error getting access token:', e);
  }

  if (!accessToken) {
    return { success: false, error: 'Authentication token not found. Please log in again.' };
  }

  try {
    // Use direct fetch API to delete comment
    // RLS policy ensures user can only delete their own comments
    console.log('deleteComment: Using direct fetch API...');

    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 15000);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}&user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`
        },
        signal: fetchController.signal
      }
    );

    clearTimeout(fetchTimeout);

    if (!response.ok) {
      const errorText = await response.text();
      logSecurityEvent('DATABASE_ERROR', { commentId, userId, error: `HTTP ${response.status}: ${errorText}` }, 'Error deleting comment');
      console.error('Error deleting comment:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    logSecurityEvent('COMMENT_DELETED', { commentId, userId }, 'Comment deleted successfully');
    return { success: true };
  } catch (error) {
    if (error.name === 'AbortError') {
      logSecurityEvent('DATABASE_ERROR', { commentId, userId, error: 'Delete timed out' }, 'Error deleting comment');
      return { success: false, error: 'Comment deletion timed out after 15 seconds' };
    }
    logSecurityEvent('UNEXPECTED_ERROR', { commentId, userId, error: error.message }, 'Unexpected error deleting comment');
    console.error('Unexpected error deleting comment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user profile by ID
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {Promise<{success: boolean, profile?: Object, error?: string}>}
 */
async function getUserProfile(userId = null) {
  // If no userId provided, get current user from localStorage
  if (!userId) {
    userId = localStorage.getItem('eventhive_last_authenticated_user_id');
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }
  }

  // Input validation
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return { success: false, error: 'Invalid user ID' };
  }

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Supabase configuration not available' };
  }

  try {
    // Use direct fetch API (no Supabase client - prevents hanging)
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => {
      console.error('getUserProfile: Request timed out after 10 seconds');
      fetchController.abort();
    }, 10000);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        signal: fetchController.signal
      }
    );

    clearTimeout(fetchTimeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error getting profile:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();

    // Return single profile (or null if not found)
    const profile = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    return { success: true, profile };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('getUserProfile: Request timed out');
      return { success: false, error: 'Request timed out after 10 seconds' };
    }
    console.error('Unexpected error getting profile:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user profile by username (for public profile viewing)
 * @param {string} username - Username to look up
 * @returns {Promise<{success: boolean, profile?: Object, error?: string}>}
 */
async function getProfileByUsername(username) {
  // Input validation
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return { success: false, error: 'Invalid username' };
  }

  const trimmedUsername = username.trim().toLowerCase();

  // Validate username format (same as validateUsername in security-services.js)
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(trimmedUsername)) {
    return { success: false, error: 'Invalid username format' };
  }

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Supabase configuration not available' };
  }

  // Get access token (required for RPC call)
  let accessToken = null;
  try {
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') && key.includes('auth-token')
    );
    if (supabaseAuthKeys.length > 0) {
      const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
      accessToken = authData?.access_token;
    }
  } catch (e) {
    console.error('Error getting access token:', e);
  }

  if (!accessToken) {
    return { success: false, error: 'Authentication required to view profiles' };
  }

  try {
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => {
      console.error('getProfileByUsername: Request timed out after 10 seconds');
      fetchController.abort();
    }, 10000);

    // Use RPC function for secure lookup (includes email from auth.users)
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_profile_by_username`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_username: trimmedUsername }),
        signal: fetchController.signal
      }
    );

    clearTimeout(fetchTimeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error getting profile by username:', response.status, errorText);

      // Check if it's an auth error
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'Authentication required to view profiles' };
      }

      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();

    // RPC returns array of rows
    const profile = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!profile) {
      return { success: false, error: 'User not found' };
    }

    return { success: true, profile };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('getProfileByUsername: Request timed out');
      return { success: false, error: 'Request timed out after 10 seconds' };
    }
    console.error('Unexpected error getting profile by username:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user profile
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<{success: boolean, profile?: Object, error?: string}>}
 */
async function updateUserProfile(profileData) {
  // Get user ID from localStorage (faster than getSafeUser which can hang)
  let userId = localStorage.getItem('eventhive_last_authenticated_user_id');
  if (!userId) {
    return { success: false, error: 'User not authenticated' };
  }

  // Input validation
  if (!profileData || typeof profileData !== 'object') {
    logSecurityEvent('INVALID_INPUT', { userId }, 'Invalid profileData in updateUserProfile');
    return { success: false, error: 'Invalid profile data' };
  }

  // Validate and sanitize inputs
  const validatedData = {};
  if (profileData.username !== undefined) {
    const username = validateUsername(profileData.username);
    if (!username) {
      return { success: false, error: 'Invalid username format' };
    }
    validatedData.username = username;
  }

  // Note: fullName is no longer used - we only have username now

  if (profileData.bio !== undefined) {
    const bio = validateBio(profileData.bio);
    validatedData.bio = bio; // Can be empty/null
  }

  if (profileData.avatarUrl !== undefined) {
    const avatarUrl = validateUrl(profileData.avatarUrl);
    if (avatarUrl === false) {
      return { success: false, error: 'Invalid avatar URL format' };
    }
    validatedData.avatar_url = avatarUrl;
  }

  if (profileData.coverPhotoUrl !== undefined) {
    const coverPhotoUrl = validateUrl(profileData.coverPhotoUrl);
    if (coverPhotoUrl === false) {
      return { success: false, error: 'Invalid cover photo URL format' };
    }
    validatedData.cover_photo_url = coverPhotoUrl;
  }

  validatedData.updated_at = new Date().toISOString();

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'Supabase configuration not available' };
  }

  // Get access token from localStorage
  let accessToken = null;
  try {
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('sb-') && key.includes('auth-token')
    );
    if (supabaseAuthKeys.length > 0) {
      const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
      accessToken = authData?.access_token;
    }
  } catch (e) {
    console.error('Error getting access token:', e);
  }

  if (!accessToken) {
    return { success: false, error: 'Authentication token not found. Please log in again.' };
  }

  try {
    // Use direct fetch API (prevents hanging)
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => {
      console.error('updateUserProfile: Request timed out after 15 seconds');
      fetchController.abort();
    }, 15000);

    console.log('updateUserProfile: Sending update via fetch API...', validatedData);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(validatedData),
        signal: fetchController.signal
      }
    );

    clearTimeout(fetchTimeout);

    if (!response.ok) {
      const errorText = await response.text();
      logSecurityEvent('DATABASE_ERROR', { userId, error: `HTTP ${response.status}: ${errorText}` }, 'Error updating profile');
      console.error('Error updating profile:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const profile = Array.isArray(data) && data.length > 0 ? data[0] : data;

    logSecurityEvent('PROFILE_UPDATED', { userId }, 'Profile updated successfully');
    console.log('updateUserProfile: Profile updated successfully');
    return { success: true, profile };
  } catch (error) {
    if (error.name === 'AbortError') {
      logSecurityEvent('DATABASE_ERROR', { userId, error: 'Update timed out' }, 'Error updating profile');
      return { success: false, error: 'Profile update timed out after 15 seconds' };
    }
    logSecurityEvent('UNEXPECTED_ERROR', { userId, error: error.message }, 'Unexpected error updating profile');
    console.error('Unexpected error updating profile:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current authenticated user
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
async function getCurrentUser() {
  try {
    // Get user ID from localStorage to avoid hanging Supabase client
    const userId = localStorage.getItem('eventhive_last_authenticated_user_id');

    if (!userId) {
      return { success: true, user: null }; // Not logged in
    }

    // Return minimal user object with just the ID
    // Full profile can be fetched separately if needed
    return { success: true, user: { id: userId } };
  } catch (error) {
    console.error('Unexpected error getting current user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if current user is an admin/checker
 * @returns {Promise<{success: boolean, isAdmin: boolean, error?: string}>}
 */
async function checkIfUserIsAdmin() {
  // Get user ID from localStorage (faster than getSafeUser)
  const userId = localStorage.getItem('eventhive_last_authenticated_user_id');
  if (!userId) {
    return { success: true, isAdmin: false }; // Not logged in = not admin
  }

  const SUPABASE_URL = window.__EH_SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, isAdmin: false, error: 'Supabase configuration not available' };
  }

  try {
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 10000);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=is_admin`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        signal: fetchController.signal
      }
    );

    clearTimeout(fetchTimeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error checking admin status:', response.status, errorText);
      return { success: false, isAdmin: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const profile = Array.isArray(data) && data.length > 0 ? data[0] : null;

    return { success: true, isAdmin: profile?.is_admin || false };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, isAdmin: false, error: 'Request timed out' };
    }
    console.error('Unexpected error checking admin status:', error);
    return { success: false, isAdmin: false, error: error.message };
  }
}

// ===== ORGANIZATIONS SERVICES =====

/**
 * Get all organizations from the database
 * @returns {Promise<{success: boolean, organizations: Array, error?: string}>}
 */
async function getOrganizations() {
  // Use guest client for reading organizations (public data, no auth needed)
  // This avoids the stale authenticated client issue
  let supabase;
  if (typeof window !== 'undefined' && typeof window.getGuestSupabaseClient === 'function') {
    supabase = window.getGuestSupabaseClient();
  } else if (typeof getGuestSupabaseClient === 'function') {
    supabase = getGuestSupabaseClient();
  } else {
    // Fallback to regular client if guest client not available
    console.warn('Guest client not available for getOrganizations, using regular client');
    supabase = getSupabaseClient();
  }

  if (!supabase) {
    return { success: false, organizations: [], error: 'Supabase not initialized' };
  }

  try {
    console.log('Fetching organizations...');
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error getting organizations:', error);
      return { success: false, organizations: [], error: error.message };
    }

    console.log(`Fetched ${data?.length || 0} organizations`);
    return { success: true, organizations: data || [] };
  } catch (error) {
    console.error('Unexpected error getting organizations:', error);
    return { success: false, organizations: [], error: error.message };
  }
}

/**
 * Create a new organization
 * @param {string} name - Organization name
 * @param {string} description - Optional description
 * @returns {Promise<{success: boolean, organization?: Object, error?: string}>}
 */
async function createOrganization(name, description = '') {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // Input validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { success: false, error: 'Organization name is required' };
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 255) {
    return { success: false, error: 'Organization name is too long (max 255 characters)' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', {}, 'Non-admin attempted to create organization');
    return { success: false, error: 'Only admins can create organizations' };
  }

  try {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: trimmedName,
        description: description?.trim() || null
      })
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505' || error.message.includes('duplicate')) {
        return { success: false, error: 'An organization with this name already exists' };
      }
      console.error('Error creating organization:', error);
      return { success: false, error: error.message };
    }

    logSecurityEvent('ORGANIZATION_CREATED', { name: trimmedName }, 'Organization created successfully');
    return { success: true, organization: data };
  } catch (error) {
    console.error('Unexpected error creating organization:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an organization
 * @param {string} orgId - Organization ID
 * @param {Object} updates - Fields to update (name, description)
 * @returns {Promise<{success: boolean, organization?: Object, error?: string}>}
 */
async function updateOrganization(orgId, updates) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // Input validation
  if (!orgId || typeof orgId !== 'string') {
    return { success: false, error: 'Invalid organization ID' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', { orgId }, 'Non-admin attempted to update organization');
    return { success: false, error: 'Only admins can update organizations' };
  }

  try {
    const updateData = {};
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (trimmedName.length === 0) {
        return { success: false, error: 'Organization name cannot be empty' };
      }
      if (trimmedName.length > 255) {
        return { success: false, error: 'Organization name is too long (max 255 characters)' };
      }
      updateData.name = trimmedName;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description?.trim() || null;
    }

    const { data, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', orgId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate')) {
        return { success: false, error: 'An organization with this name already exists' };
      }
      console.error('Error updating organization:', error);
      return { success: false, error: error.message };
    }

    logSecurityEvent('ORGANIZATION_UPDATED', { orgId }, 'Organization updated successfully');
    return { success: true, organization: data };
  } catch (error) {
    console.error('Unexpected error updating organization:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteOrganization(orgId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // Input validation
  if (!orgId || typeof orgId !== 'string') {
    return { success: false, error: 'Invalid organization ID' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', { orgId }, 'Non-admin attempted to delete organization');
    return { success: false, error: 'Only admins can delete organizations' };
  }

  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    if (error) {
      console.error('Error deleting organization:', error);
      return { success: false, error: error.message };
    }

    logSecurityEvent('ORGANIZATION_DELETED', { orgId }, 'Organization deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error deleting organization:', error);
    return { success: false, error: error.message };
  }
}


