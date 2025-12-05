// ===== SUPABASE STORAGE SERVICES FOR EVENT IMAGES =====
// This file handles image uploads to Supabase Storage

// Storage bucket name (configure this in Supabase Storage)
const EVENT_IMAGES_BUCKET = 'event-images';

// Ensure Supabase client is initialized
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = initSupabase();
  }
  return supabaseClient;
}

/**
 * Upload an image file to Supabase Storage
 * @param {File} file - Image file to upload
 * @param {string} eventId - Event ID (for folder organization)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadEventImage(file, eventId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    return { success: false, error: 'Only admins can upload images' };
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Only JPG and PNG files are allowed.' };
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { success: false, error: 'File size exceeds 5MB limit.' };
  }

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileExt = file.name.split('.').pop();
    const fileName = `${eventId}/${timestamp}-${randomStr}.${fileExt}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(EVENT_IMAGES_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading image:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(EVENT_IMAGES_BUCKET)
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return { success: false, error: 'Failed to get public URL' };
    }

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error('Unexpected error uploading image:', error);
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
 * Delete an image from Supabase Storage
 * @param {string} imageUrl - Full URL of the image to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteEventImage(imageUrl) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }

  // Check if user is admin
  const adminCheck = await checkIfUserIsAdmin();
  if (!adminCheck.success || !adminCheck.isAdmin) {
    return { success: false, error: 'Only admins can delete images' };
  }

  try {
    // Extract file path from URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/event-images/[path]
    const urlParts = imageUrl.split('/event-images/');
    if (urlParts.length !== 2) {
      return { success: false, error: 'Invalid image URL format' };
    }

    const filePath = urlParts[1];

    // Delete file from storage
    const { error } = await supabase.storage
      .from(EVENT_IMAGES_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error deleting image:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete multiple images
 * @param {Array<string>} imageUrls - Array of image URLs
 * @returns {Promise<{success: boolean, errors: Array<string>}>}
 */
async function deleteEventImages(imageUrls) {
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

  const { data } = supabase.storage
    .from(EVENT_IMAGES_BUCKET)
    .getPublicUrl(filePath);

  return data?.publicUrl || null;
}

