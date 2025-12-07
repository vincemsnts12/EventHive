// ===== SUPABASE SERVICES FOR LIKES, COMMENTS, AND PROFILES =====
// This file contains all Supabase database operations
// Moved to backend folder for better organization

// Ensure Supabase client is initialized
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
  }
  return supabaseClient;
}

// `getSafeUser()` is provided centrally in `js/backend/auth-utils.js`

// ===== LIKES SERVICES =====

/**
 * Toggle like for an event (like if not liked, unlike if liked)
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, liked: boolean, error?: string}>}
 */
async function toggleEventLike(eventId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  const user = await getSafeUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    logSecurityEvent('INVALID_INPUT', { eventId, userId: user.id }, 'Invalid eventId in toggleEventLike');
    return { success: false, error: 'Invalid event ID' };
  }

  try {
    // Check if user already liked this event
    const { data: existingLike, error: checkError } = await supabase
      .from('event_likes')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      logSecurityEvent('DATABASE_ERROR', { eventId, userId: user.id, error: checkError.message }, 'Error checking like');
      console.error('Error checking like:', checkError);
      return { success: false, error: checkError.message };
    }

    if (existingLike) {
      // Unlike: Delete the like
      const { error: deleteError } = await supabase
        .from('event_likes')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (deleteError) {
        logSecurityEvent('DATABASE_ERROR', { eventId, userId: user.id, error: deleteError.message }, 'Error unliking');
        console.error('Error unliking:', deleteError);
        return { success: false, error: deleteError.message };
      }

      return { success: true, liked: false };
    } else {
      // Like: Insert new like
      const { error: insertError } = await supabase
        .from('event_likes')
        .insert({
          event_id: eventId,
          user_id: user.id
        });

      if (insertError) {
        logSecurityEvent('DATABASE_ERROR', { eventId, userId: user.id, error: insertError.message }, 'Error liking');
        console.error('Error liking:', insertError);
        return { success: false, error: insertError.message };
      }

      return { success: true, liked: true };
    }
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { eventId, userId: user?.id, error: error.message }, 'Unexpected error toggling like');
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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, liked: false, error: 'Supabase not initialized' };
  }

  const user = await getSafeUser();
  if (!user) {
    return { success: true, liked: false }; // Not logged in = not liked
  }

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, liked: false, error: 'Invalid event ID' };
  }

  try {
    const { data, error } = await supabase
      .from('event_likes')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking user like:', error);
      return { success: false, liked: false, error: error.message };
    }

    return { success: true, liked: !!data };
  } catch (error) {
    console.error('Unexpected error checking user like:', error);
    return { success: false, liked: false, error: error.message };
  }
}

/**
 * Get all event IDs that the current user has liked
 * @returns {Promise<{success: boolean, eventIds: string[], error?: string}>}
 */
async function getUserLikedEventIds() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, eventIds: [], error: 'Supabase not initialized' };
  }

  const user = await getSafeUser();
  if (!user) {
    return { success: true, eventIds: [] }; // Not logged in = no likes
  }

  try {
    const { data, error } = await supabase
      .from('event_likes')
      .select('event_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error getting user liked events:', error);
      return { success: false, eventIds: [], error: error.message };
    }

    const eventIds = data ? data.map(row => row.event_id) : [];
    return { success: true, eventIds };
  } catch (error) {
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, comments: [], error: 'Supabase not initialized' };
  }

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return { success: false, comments: [], error: 'Invalid event ID' };
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user_id,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }); // Oldest first

    if (error) {
      console.error('Error getting comments:', error);
      return { success: false, comments: [], error: error.message };
    }

    // Transform data to match frontend structure
    const comments = (data || []).map(comment => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      userId: comment.user_id,
      user: {
        id: comment.profiles?.id || comment.user_id,
        username: comment.profiles?.username || 'Unknown',
        fullName: comment.profiles?.full_name || comment.profiles?.username || 'Unknown',
        avatarUrl: comment.profiles?.avatar_url || 'images/prof_default.svg'
      }
    }));

    return { success: true, comments };
  } catch (error) {
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  const user = await getSafeUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  // Input validation
  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    logSecurityEvent('INVALID_INPUT', { eventId, userId: user.id }, 'Invalid eventId in createComment');
    return { success: false, error: 'Invalid event ID' };
  }

  if (!content || typeof content !== 'string') {
    logSecurityEvent('INVALID_INPUT', { eventId, userId: user.id }, 'Invalid content in createComment');
    return { success: false, error: 'Comment cannot be empty' };
  }

  // Trim and validate content
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    return { success: false, error: 'Comment cannot be empty' };
  }

  if (trimmedContent.length > 200) {
    logSecurityEvent('INVALID_INPUT', { eventId, userId: user.id, contentLength: trimmedContent.length }, 'Comment exceeds length limit');
    return { success: false, error: 'Comment cannot exceed 200 characters' };
  }

  // Profanity filtering
  const filteredContent = filterProfanity(trimmedContent);
  if (filteredContent !== trimmedContent) {
    logSecurityEvent('PROFANITY_FILTERED', { eventId, userId: user.id }, 'Profanity detected in comment');
  }

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        event_id: eventId,
        user_id: user.id,
        content: filteredContent
      })
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user_id,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      logSecurityEvent('DATABASE_ERROR', { eventId, userId: user.id, error: error.message }, 'Error creating comment');
      console.error('Error creating comment:', error);
      return { success: false, error: error.message };
    }

    // Transform data to match frontend structure
    const comment = {
      id: data.id,
      content: data.content,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      userId: data.user_id,
      user: {
        id: data.profiles?.id || data.user_id,
        username: data.profiles?.username || 'Unknown',
        fullName: data.profiles?.full_name || data.profiles?.username || 'Unknown',
        avatarUrl: data.profiles?.avatar_url || 'images/prof_default.svg'
      }
    };

    logSecurityEvent('COMMENT_CREATED', { eventId, userId: user.id, commentId: data.id }, 'Comment created successfully');
    return { success: true, comment };
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { eventId, userId: user?.id, error: error.message }, 'Unexpected error creating comment');
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  const user = await getSafeUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  // Input validation
  if (!commentId || typeof commentId !== 'string' || commentId.trim().length === 0) {
    logSecurityEvent('INVALID_INPUT', { commentId, userId: user.id }, 'Invalid commentId in deleteComment');
    return { success: false, error: 'Invalid comment ID' };
  }

  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id); // Ensure user can only delete their own comments

    if (error) {
      logSecurityEvent('DATABASE_ERROR', { commentId, userId: user.id, error: error.message }, 'Error deleting comment');
      console.error('Error deleting comment:', error);
      return { success: false, error: error.message };
    }

    logSecurityEvent('COMMENT_DELETED', { commentId, userId: user.id }, 'Comment deleted successfully');
    return { success: true };
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { commentId, userId: user?.id, error: error.message }, 'Unexpected error deleting comment');
    console.error('Unexpected error deleting comment:', error);
    return { success: false, error: error.message };
  }
}

// ===== PROFILES SERVICES =====

/**
 * Get user profile by ID
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {Promise<{success: boolean, profile?: Object, error?: string}>}
 */
async function getUserProfile(userId = null) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // If no userId provided, get current user
  if (!userId) {
    const user = await getSafeUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }
    userId = user.id;
  }

  // Input validation
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return { success: false, error: 'Invalid user ID' };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error getting profile:', error);
      return { success: false, error: error.message };
    }

    return { success: true, profile: data };
  } catch (error) {
    console.error('Unexpected error getting profile:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user profile
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<{success: boolean, profile?: Object, error?: string}>}
 */
async function updateUserProfile(profileData) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  const user = await getSafeUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  // Input validation
  if (!profileData || typeof profileData !== 'object') {
    logSecurityEvent('INVALID_INPUT', { userId: user.id }, 'Invalid profileData in updateUserProfile');
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

  if (profileData.fullName !== undefined) {
    const fullName = validateFullName(profileData.fullName);
    if (!fullName) {
      return { success: false, error: 'Invalid full name format' };
    }
    validatedData.full_name = fullName;
  }

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

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(validatedData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      logSecurityEvent('DATABASE_ERROR', { userId: user.id, error: error.message }, 'Error updating profile');
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }

    logSecurityEvent('PROFILE_UPDATED', { userId: user.id }, 'Profile updated successfully');
    return { success: true, profile: data };
  } catch (error) {
    logSecurityEvent('UNEXPECTED_ERROR', { userId: user?.id, error: error.message }, 'Unexpected error updating profile');
    console.error('Unexpected error updating profile:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current authenticated user
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
async function getCurrentUser() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  try {
    // Use the safe helper which returns null when no session exists
    const user = await getSafeUser();
    if (!user) {
      return { success: true, user: null }; // Not logged in
    }
    return { success: true, user };
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, isAdmin: false, error: 'Supabase not initialized' };
  }

  const user = await getSafeUser();
  if (!user) {
    return { success: true, isAdmin: false }; // Not logged in = not admin
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error checking admin status:', error);
      return { success: false, isAdmin: false, error: error.message };
    }

    return { success: true, isAdmin: data?.is_admin || false };
  } catch (error) {
    console.error('Unexpected error checking admin status:', error);
    return { success: false, isAdmin: false, error: error.message };
  }
}


