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
  const parsedDate = parseDateString(event.date);
  
  return {
    id: event.id || null, // Will be generated by database if null
    title: event.title,
    description: event.description,
    location: event.location,
    start_date: parsedDate ? formatDateForDatabase(parsedDate.startDate) : null,
    end_date: parsedDate ? formatDateForDatabase(parsedDate.endDate) : null,
    is_featured: event.isFeatured || false,
    college_code: event.college,
    organization_name: event.organization,
    university_logo_url: event.universityLogo,
    status: event.status || 'Pending', // Will be calculated on insert/update
    created_at: event.createdAt || null,
    updated_at: event.updatedAt || null,
    created_by: event.createdBy || null,
    // Images will be handled separately in event_images table
    images: event.images || []
  };
}

/**
 * Transform database event object to frontend format
 * @param {Object} dbEvent - Database event object
 * @param {Array} images - Array of image URLs
 * @param {number} likesCount - Number of likes
 * @returns {Object} - Frontend event object
 */
function eventFromDatabase(dbEvent, images = [], likesCount = 0) {
  const status = calculateEventStatus(dbEvent.start_date, dbEvent.end_date, dbEvent.status);
  
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
    college: dbEvent.college_code,
    collegeColor: getCollegeColorClass(dbEvent.college_code),
    organization: dbEvent.organization_name,
    images: images,
    universityLogo: dbEvent.university_logo_url,
    createdAt: dbEvent.created_at,
    updatedAt: dbEvent.updated_at,
    createdBy: dbEvent.created_by
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

