// ===== DATE UTILITY FUNCTIONS FOR EVENTHIVE =====
// Functions to parse and format dates for database compatibility

/**
 * Parse a formatted date string into structured date/time objects
 * Input format: "November 7, 2025 (Friday) | 12:00 NN - 4:00 PM"
 * Output: { startDate, endDate, startTime, endTime, formattedDate }
 */
function parseDateString(dateString) {
  if (!dateString) return null;
  
  // Extract date part: "November 7, 2025 (Friday)"
  const dateMatch = dateString.match(/^([^|]+)/);
  if (!dateMatch) return null;
  
  const datePart = dateMatch[1].trim();
  // Remove day name in parentheses: "November 7, 2025"
  const dateOnly = datePart.replace(/\s*\([^)]+\)\s*/, '').trim();
  
  // Extract time part: "12:00 NN - 4:00 PM"
  const timeMatch = dateString.match(/\|\s*(.+)$/);
  if (!timeMatch) return null;
  
  const timePart = timeMatch[1].trim();
  const timeRange = timePart.split('-').map(t => t.trim());
  
  if (timeRange.length !== 2) return null;
  
  const [startTimeStr, endTimeStr] = timeRange;
  
  // Parse the date
  const baseDate = new Date(dateOnly);
  if (isNaN(baseDate.getTime())) return null;
  
  // Parse start time
  const startTime = parseTimeString(startTimeStr, baseDate);
  const endTime = parseTimeString(endTimeStr, baseDate);
  
  // If end time is earlier than start time, assume it's the next day
  if (endTime < startTime) {
    endTime.setDate(endTime.getDate() + 1);
  }
  
  return {
    startDate: startTime,
    endDate: endTime,
    startTime: formatTime(startTime),
    endTime: formatTime(endTime),
    formattedDate: dateString // Keep original format for display
  };
}

/**
 * Parse time string (e.g., "12:00 NN", "4:00 PM") into Date object
 */
function parseTimeString(timeStr, baseDate) {
  if (!timeStr || !baseDate) return null;
  
  // Normalize time string
  timeStr = timeStr.trim().toUpperCase();
  
  // Handle "NN" (noon) and "MN" (midnight)
  if (timeStr.includes('NN')) {
    timeStr = timeStr.replace('NN', 'PM').replace(/\d+:\d+/, '12:00');
  } else if (timeStr.includes('MN')) {
    timeStr = timeStr.replace('MN', 'AM').replace(/\d+:\d+/, '12:00');
  }
  
  // Extract hour and minute
  const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/);
  if (!timeMatch) return null;
  
  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const period = timeMatch[3];
  
  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  // Create date object with time
  const dateTime = new Date(baseDate);
  dateTime.setHours(hours, minutes, 0, 0);
  
  return dateTime;
}

/**
 * Format Date object to time string (HH:MM format)
 */
function formatTime(date) {
  if (!date) return null;
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}:00`;
}

/**
 * Format Date object to ISO 8601 string for database
 */
function formatDateForDatabase(date) {
  if (!date) return null;
  return date.toISOString();
}

/**
 * Calculate event status from start and end dates
 * @param {Date|string} startDate - Event start date
 * @param {Date|string} endDate - Event end date
 * @param {string} approvalStatus - 'Pending' if not approved, null if approved
 * @returns {string} - 'Pending' | 'Upcoming' | 'Ongoing' | 'Concluded'
 */
function calculateEventStatus(startDate, endDate, approvalStatus = null) {
  // If not approved, status is Pending
  if (approvalStatus === 'Pending') {
    return 'Pending';
  }
  
  const now = new Date();
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Pending'; // Default if dates are invalid
  }
  
  if (now < start) return 'Upcoming';
  if (now >= start && now <= end) return 'Ongoing';
  if (now > end) return 'Concluded';
  
  return 'Pending';
}

/**
 * Get status color class from status
 * @param {string} status - Event status
 * @returns {string} - CSS class name
 */
function getStatusColor(status) {
  const statusMap = {
    'Pending': 'pending',
    'Upcoming': 'upcoming',
    'Ongoing': 'ongoing',
    'Concluded': 'concluded'
  };
  return statusMap[status] || 'pending';
}

/**
 * Format date range for display
 * @param {Date|string} startDate - Event start date
 * @param {Date|string} endDate - Event end date
 * @returns {string} - Formatted date string
 */
function formatDateRangeForDisplay(startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return '';
  }
  
  // Format: "November 7, 2025 (Friday) | 12:00 NN - 4:00 PM"
  const options = { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric',
    weekday: 'long'
  };
  
  const dateStr = start.toLocaleDateString('en-US', options);
  const dayName = start.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Format time
  const startTime = formatTimeForDisplay(start);
  const endTime = formatTimeForDisplay(end);
  
  // Extract date without day name for cleaner format
  const dateOnly = start.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  return `${dateOnly} (${dayName}) | ${startTime} - ${endTime}`;
}

/**
 * Format time for display (12-hour format with AM/PM)
 */
function formatTimeForDisplay(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  hours = hours % 12;
  if (hours === 0) hours = 12;
  
  // Handle special cases
  if (hours === 12 && minutes === 0 && period === 'PM') {
    return '12:00 NN'; // Noon
  }
  if (hours === 12 && minutes === 0 && period === 'AM') {
    return '12:00 MN'; // Midnight
  }
  
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${hours}:${minutesStr} ${period}`;
}

/**
 * Transform frontend event object to database format
 * @param {Object} event - Frontend event object
 * @returns {Object} - Database-ready event object
 */
function eventToDatabase(event) {
  // Parse date - prefer parsed fields if available, otherwise parse from date string
  let startDate = null;
  let endDate = null;
  
  if (event.startDate && event.endDate) {
    // Use parsed date fields if available
    startDate = event.startDate instanceof Date ? event.startDate : new Date(event.startDate);
    endDate = event.endDate instanceof Date ? event.endDate : new Date(event.endDate);
  } else if (event.date) {
    // Fallback to parsing date string
    const parsedDate = parseDateString(event.date);
    if (parsedDate) {
      startDate = parsedDate.startDate;
      endDate = parsedDate.endDate;
    }
  }
  
  const dbEvent = {
    title: event.title,
    description: event.description,
    location: event.location,
    start_date: startDate ? formatDateForDatabase(startDate) : null,
    end_date: endDate ? formatDateForDatabase(endDate) : null,
    is_featured: event.isFeatured || false,
    college_code: event.mainCollege || event.college, // Main college for backward compatibility
    organization_name: event.organization, // Only use organization_name, not organization_id
    university_logo_url: event.universityLogo,
    status: event.status || 'Pending', // Will be calculated on insert/update
    created_at: event.createdAt || null,
    updated_at: event.updatedAt || null,
    created_by: event.createdBy || null
    // Note: Images and thumbnailIndex are handled separately via saveEventImages()
  };
  
  // Store multiple colleges as JSONB array
  // Always include colleges if it exists (even for single college) to ensure proper updates
  if (event.colleges && Array.isArray(event.colleges)) {
    if (event.colleges.length > 0) {
      dbEvent.colleges = event.colleges;
    } else {
      // If empty array, set to array with main college for consistency
      const mainCollege = event.mainCollege || event.college;
      if (mainCollege) {
        dbEvent.colleges = [mainCollege];
      }
    }
  } else if (event.mainCollege || event.college) {
    // If colleges array doesn't exist but mainCollege does, create array with just main college
    dbEvent.colleges = [event.mainCollege || event.college];
  }
  // If colleges is not set at all, don't include it (for inserts where column may not exist)
  
  // Store multiple organizations as JSONB array (ordered by selection)
  if (event.organizations && Array.isArray(event.organizations)) {
    if (event.organizations.length > 0) {
      dbEvent.organizations = event.organizations;
      // Also set organization_name to first one for backward compatibility
      dbEvent.organization_name = event.organizations[0];
    }
  } else if (event.organization) {
    // If only single organization exists, wrap it in array
    dbEvent.organizations = [event.organization];
  }
  // If organizations is not set at all, don't include it (for inserts where column may not exist)
  
  // Only include id if it's provided (for updates), otherwise let database generate it
  if (event.id) {
    dbEvent.id = event.id;
  }
  
  return dbEvent;
}

/**
 * Transform database event object to frontend format
 * @param {Object} dbEvent - Database event object
 * @param {Array} images - Array of image URLs (ordered by display_order)
 * @param {number} likesCount - Number of likes
 * @param {number} thumbnailIndex - Index of thumbnail image (optional, will be calculated if not provided)
 * @returns {Object} - Frontend event object
 */
function eventFromDatabase(dbEvent, images = [], likesCount = 0, thumbnailIndex = null) {
  const status = calculateEventStatus(dbEvent.start_date, dbEvent.end_date, dbEvent.status);
  
  // If thumbnailIndex not provided, default to 0 (first image)
  const finalThumbnailIndex = thumbnailIndex !== null && thumbnailIndex < images.length 
    ? thumbnailIndex 
    : 0;
  
  // Parse colleges from JSONB or use single college_code
  let colleges = [];
  let mainCollege = dbEvent.college_code;
  
  if (dbEvent.colleges) {
    try {
      // Supabase returns JSONB as array/object, but handle string case for safety
      if (Array.isArray(dbEvent.colleges)) {
        colleges = dbEvent.colleges;
      } else if (typeof dbEvent.colleges === 'string') {
        colleges = JSON.parse(dbEvent.colleges);
      } else {
        colleges = [];
      }
      
      // Ensure main college is in the array
      if (mainCollege && !colleges.includes(mainCollege)) {
        colleges.push(mainCollege);
      }
    } catch (e) {
      console.warn('Failed to parse colleges JSONB:', e);
      colleges = dbEvent.college_code ? [dbEvent.college_code] : [];
    }
  } else if (dbEvent.college_code) {
    colleges = [dbEvent.college_code];
  }
  
  // Parse organizations from JSONB or use single organization_name
  let organizations = [];
  
  if (dbEvent.organizations) {
    try {
      // Supabase returns JSONB as array/object, but handle string case for safety
      if (Array.isArray(dbEvent.organizations)) {
        organizations = dbEvent.organizations;
      } else if (typeof dbEvent.organizations === 'string') {
        organizations = JSON.parse(dbEvent.organizations);
      } else {
        organizations = [];
      }
    } catch (e) {
      console.warn('Failed to parse organizations JSONB:', e);
      organizations = dbEvent.organization_name ? [dbEvent.organization_name] : [];
    }
  } else if (dbEvent.organization_name) {
    // Fallback to single organization_name for backward compatibility
    organizations = [dbEvent.organization_name];
  }
  
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description,
    location: dbEvent.location,
    date: formatDateRangeForDisplay(dbEvent.start_date, dbEvent.end_date),
    status: status,
    statusColor: getStatusColor(status),
    isFeatured: dbEvent.is_featured || false,
    likes: likesCount,
    college: mainCollege, // Main college (for backward compatibility)
    colleges: colleges, // Array of all colleges
    mainCollege: mainCollege, // Main college for event card display
    collegeColor: getCollegeColorClass(mainCollege),
    organization: organizations[0] || dbEvent.organization_name || '', // First org for backward compatibility
    organizations: organizations, // Array of all organizations (ordered by selection)
    images: images,
    thumbnailIndex: finalThumbnailIndex, // Add thumbnailIndex to frontend object
    universityLogo: dbEvent.university_logo_url,
    createdAt: dbEvent.created_at,
    updatedAt: dbEvent.updated_at,
    createdBy: dbEvent.created_by,
    // Add parsed date fields for easier manipulation
    startDate: dbEvent.start_date ? new Date(dbEvent.start_date) : null,
    endDate: dbEvent.end_date ? new Date(dbEvent.end_date) : null,
    startTime: dbEvent.start_time || null,
    endTime: dbEvent.end_time || null
  };
}

/**
 * Get college color class from college code
 */
function getCollegeColorClass(collegeCode) {
  const colorMap = {
    'COS': 'cos',
    'COE': 'coe',
    'CAFA': 'cafa',
    'CLA': 'cla',
    'CIE': 'cie',
    'CIT': 'cit',
    'TUP': 'tup'
  };
  return colorMap[collegeCode] || 'tup';
}

