// ===== SUPABASE STORAGE SERVICES FOR EVENT IMAGES =====
// This file handles image uploads to Supabase Storage
// Moved to backend folder with security enhancements

// Storage bucket name (configure this in Supabase Storage)
const EVENT_IMAGES_BUCKET = 'event-images';

// Ensure Supabase client is initialized
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
  }
  return supabaseClient;
}

// `getSafeUser()` is provided centrally in `js/backend/auth-utils.js`

/**
 * Check admin status from cache (same as eventhive-events-services.js)
 */
function checkAdminFromCacheStorage() {
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
          console.log(`uploadEventImage: Admin check from cache completed in ${adminCheckDuration}ms:`, { isAdmin, cacheValid });
        }
      }
    }
  } catch (e) {
    console.error('uploadEventImage: Error reading auth cache:', e);
  }
  
  return { isAdmin, cacheValid };
}

/**
 * Upload an image file to Supabase Storage using direct fetch API
 * @param {File} file - Image file to upload
 * @param {string} eventId - Event ID (for folder organization)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadEventImage(file, eventId) {
  console.log('uploadEventImage: Starting upload for event:', eventId);
  
  // Input validation
  if (!file || !(file instanceof File)) {
    console.error('uploadEventImage: Invalid file object');
    return { success: false, error: 'Invalid file' };
  }

  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    console.error('uploadEventImage: Invalid eventId');
    return { success: false, error: 'Invalid event ID' };
  }

  // Check if user is admin from cache (avoids hanging)
  const { isAdmin, cacheValid } = checkAdminFromCacheStorage();
  console.log('uploadEventImage: Admin check from cache:', { isAdmin, cacheValid });
  
  if (!isAdmin) {
    console.error('uploadEventImage: User is not admin');
    return { success: false, error: 'Only admins can upload images' };
  }

  // Get user ID from localStorage
  const userId = localStorage.getItem('eventhive_last_authenticated_user_id');
  console.log('uploadEventImage: User ID from localStorage:', userId);

  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!validTypes.includes(file.type)) {
    console.error('uploadEventImage: Invalid file type:', file.type);
    return { success: false, error: 'Invalid file type. Only JPG and PNG files are allowed.' };
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    console.error('uploadEventImage: File too large:', file.size);
    return { success: false, error: 'File size exceeds 5MB limit.' };
  }

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    // Sanitize file extension
    if (!/^[a-zA-Z0-9]+$/.test(fileExt)) {
      return { success: false, error: 'Invalid file extension' };
    }
    
    const fileName = `${eventId}/${timestamp}-${randomStr}.${fileExt}`;
    console.log('uploadEventImage: Generated filename:', fileName);

    // Get Supabase config
    const SUPABASE_URL = window.__EH_SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('uploadEventImage: Supabase config not available');
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
      console.error('uploadEventImage: Error getting access token:', e);
    }

    if (!accessToken) {
      console.error('uploadEventImage: No access token found');
      return { success: false, error: 'Authentication token not found. Please log in again.' };
    }

    console.log('uploadEventImage: Access token obtained, uploading file...');

    // Upload file using direct fetch API
    const uploadController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadController.abort(), 30000); // 30s timeout for uploads

    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${EVENT_IMAGES_BUCKET}/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': file.type,
          'x-upsert': 'false'
        },
        body: file,
        signal: uploadController.signal
      }
    );

    clearTimeout(uploadTimeout);
    console.log('uploadEventImage: Upload response status:', uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('uploadEventImage: Upload failed:', uploadResponse.status, errorText);
      return { success: false, error: `Upload failed: ${errorText}` };
    }

    // Construct public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${EVENT_IMAGES_BUCKET}/${fileName}`;
    console.log('uploadEventImage: Upload successful, public URL:', publicUrl);

    return { success: true, url: publicUrl };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('uploadEventImage: Upload timed out');
      return { success: false, error: 'Upload timed out. Please try again.' };
    }
    console.error('uploadEventImage: Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upload multiple images
 * @param {Array<File>} files - Array of image files
 * @param {string} eventId - Event ID
 * @returns {Promise<{success: boolean, urls: Array<string>, errors: Array<string>}>}
 */
async function uploadEventImages(files, eventId) {
  // Input validation
  if (!Array.isArray(files) || files.length === 0) {
    return { success: false, urls: [], errors: ['No files provided'] };
  }

  if (files.length > 5) {
    logSecurityEvent('INVALID_INPUT', { eventId, fileCount: files.length }, 'Too many files attempted');
    return { success: false, urls: [], errors: ['Maximum 5 images allowed'] };
  }

  const results = await Promise.all(
    files.map(file => uploadEventImage(file, eventId))
  );

  const urls = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.success) {
      urls.push(result.url);
    } else {
      errors.push(`File ${index + 1}: ${result.error}`);
    }
  });

  return {
    success: errors.length === 0,
    urls,
    errors
  };
}

/**
 * Delete an image from Supabase Storage using direct fetch API
 * @param {string} imageUrl - Full URL of the image to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteEventImage(imageUrl) {
  console.log('deleteEventImage: Starting delete for URL:', imageUrl);

  // Input validation
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
    console.error('deleteEventImage: Invalid imageUrl');
    return { success: false, error: 'Invalid image URL' };
  }

  // Check if user is admin from cache (avoids hanging)
  const { isAdmin } = checkAdminFromCacheStorage();
  if (!isAdmin) {
    console.error('deleteEventImage: User is not admin');
    return { success: false, error: 'Only admins can delete images' };
  }

  try {
    // Extract file path from URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/event-images/[path]
    const urlParts = imageUrl.split('/event-images/');
    if (urlParts.length !== 2) {
      console.error('deleteEventImage: Invalid image URL format');
      return { success: false, error: 'Invalid image URL format' };
    }

    const filePath = urlParts[1];
    
    // Validate file path (prevent directory traversal)
    if (filePath.includes('..') || filePath.includes('//')) {
      console.error('deleteEventImage: Suspicious file path detected');
      return { success: false, error: 'Invalid file path' };
    }

    console.log('deleteEventImage: File path:', filePath);

    // Get Supabase config
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
      console.error('deleteEventImage: Error getting access token:', e);
    }

    if (!accessToken) {
      return { success: false, error: 'Authentication token not found. Please log in again.' };
    }

    // Delete file using direct fetch API
    const deleteController = new AbortController();
    const deleteTimeout = setTimeout(() => deleteController.abort(), 15000);

    const deleteResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${EVENT_IMAGES_BUCKET}/${filePath}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_ANON_KEY
        },
        signal: deleteController.signal
      }
    );

    clearTimeout(deleteTimeout);
    console.log('deleteEventImage: Delete response status:', deleteResponse.status);

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const errorText = await deleteResponse.text();
      console.error('deleteEventImage: Delete failed:', deleteResponse.status, errorText);
      return { success: false, error: `Delete failed: ${errorText}` };
    }

    console.log('deleteEventImage: Delete successful');
    return { success: true };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('deleteEventImage: Delete timed out');
      return { success: false, error: 'Delete timed out. Please try again.' };
    }
    console.error('deleteEventImage: Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete multiple images
 * @param {Array<string>} imageUrls - Array of image URLs
 * @returns {Promise<{success: boolean, errors: Array<string>}>}
 */
async function deleteEventImages(imageUrls) {
  // Input validation
  if (!Array.isArray(imageUrls)) {
    return { success: false, errors: ['Invalid image URLs array'] };
  }

  const results = await Promise.all(
    imageUrls.map(url => deleteEventImage(url))
  );

  const errors = results
    .filter(result => !result.success)
    .map(result => result.error);

  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Get public URL for an image (if already uploaded)
 * @param {string} filePath - File path in storage
 * @returns {string} Public URL
 */
function getEventImageUrl(filePath) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Input validation
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }

  // Validate file path (prevent directory traversal)
  if (filePath.includes('..') || filePath.includes('//')) {
    return null;
  }

  const { data } = supabase.storage
    .from(EVENT_IMAGES_BUCKET)
    .getPublicUrl(filePath);

  return data?.publicUrl || null;
}


