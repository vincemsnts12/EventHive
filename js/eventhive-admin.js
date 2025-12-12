// ===== ADMIN DASHBOARD FUNCTIONALITY =====

// Available colleges for selection
const availableColleges = [
  { code: 'COS', name: 'College of Science', color: 'cos' },
  { code: 'COE', name: 'College of Engineering', color: 'coe' },
  { code: 'CAFA', name: 'College of Architecture and Fine Arts', color: 'cafa' },
  { code: 'CLA', name: 'College of Liberal Arts', color: 'cla' },
  { code: 'CIE', name: 'College of Industrial Education', color: 'cie' },
  { code: 'CIT', name: 'College of Industrial Technology', color: 'cit' },
  { code: 'TUP', name: 'TUP System-wide', color: 'tup' }
];

// Available organizations (loaded from database)
let availableOrganizations = [];
// Cache organization objects (id -> {id, name, description}) test push
let organizationsCache = {};

/**
 * Load organizations from the database
 * Called on page load and after adding new organizations
 */
async function loadOrganizationsFromDatabase() {
  if (typeof getOrganizations !== 'function') {
    console.warn('getOrganizations function not available, using fallback');
    // Fallback organizations
    availableOrganizations = [
      'AWS Learning Club - TUP Manila',
      'Google Developer Groups on Campus TUP Manila',
      'TUP USG Manila',
      'TUP CAFA Student Council',
      'TUP Arts Society',
      'TUP Entrepreneurship Club'
    ];
    return;
  }

  try {
    const result = await getOrganizations();
    if (result.success && result.organizations) {
      // Extract names for backward compatibility with existing code
      availableOrganizations = result.organizations.map(org => org.name);
      // Cache full organization objects
      organizationsCache = {};
      result.organizations.forEach(org => {
        organizationsCache[org.id] = org;
      });
      console.log(`Loaded ${availableOrganizations.length} organizations from database`);
    } else {
      console.warn('Failed to load organizations:', result.error);
    }
  } catch (error) {
    console.error('Error loading organizations:', error);
  }
}

// ===== PENDING EVENTS DATA =====
// Pending events are loaded from Supabase database
// This object will be populated by Supabase queries (see eventhive-admin-init.js)
let pendingEventsData = {};

// Current editing state
let currentEditingEventId = null;
let currentEditingField = null;
let currentEditingTable = null; // 'published' or 'pending'
let rowsInEditMode = new Set(); // Track which rows are in edit mode

// Helper: validate UUID (use existing validateUUID if available)
function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  if (typeof validateUUID === 'function') return validateUUID(id);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// ===== FORMAT DATE TO SHORTENED VERSION =====
function formatShortDate(dateString) {
  // Input: "November 7, 2025 (Friday) | 12:00 NN - 4:00 PM"
  // Output: "11/7/25 | 12NN-4PM"

  const parts = dateString.split(' | ');
  if (parts.length !== 2) return dateString;

  const datePart = parts[0];
  const timePart = parts[1];

  // Extract date
  const dateMatch = datePart.match(/(\w+)\s+(\d+),\s+(\d+)/);
  if (!dateMatch) return dateString;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const month = monthNames.indexOf(dateMatch[1]) + 1;
  const day = dateMatch[2];
  const year = dateMatch[3].slice(-2);

  // Format time
  // Split time range and format each time separately
  const timeRange = timePart.split(' - ').map(time => {
    // Handle special case: "12:00 NN" -> "12NN"
    if (time.trim() === '12:00 NN') {
      return '12NN';
    }
    // Handle special case: "12:00 MN" -> "12MN"
    if (time.trim() === '12:00 MN') {
      return '12MN';
    }
    // For other times, preserve the colon and remove space before AM/PM
    return time.trim().replace(' AM', 'AM').replace(' PM', 'PM');
  });

  let timeFormatted = timeRange.join('-');

  return `${month}/${day}/${year} | ${timeFormatted}`;
}

// ===== SORT EVENTS (Active First, Ended at Bottom) =====
function sortEvents(events) {
  const sorted = Object.entries(events).sort((a, b) => {
    const statusOrder = { 'Upcoming': 1, 'Ongoing': 2, 'Concluded': 3 };
    const statusA = statusOrder[a[1].status] || 999;
    const statusB = statusOrder[b[1].status] || 999;

    if (statusA !== statusB) {
      return statusA - statusB;
    }

    // If same status, sort by date (earliest first)
    return a[1].date.localeCompare(b[1].date);
  });

  return sorted;
}

// ===== POPULATE PUBLISHED EVENTS TABLE =====
function populatePublishedEventsTable() {
  const tbody = document.getElementById('publishedEventsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // Filter out pending events from published table
  const publishedEvents = {};
  for (const eventId in eventsData) {
    const event = eventsData[eventId];
    if (event.status !== 'Pending') {
      publishedEvents[eventId] = event;
    }
  }

  const sortedEvents = sortEvents(publishedEvents);

  sortedEvents.forEach(([eventId, event]) => {
    const row = document.createElement('tr');
    row.setAttribute('data-event-id', eventId);
    const isEnded = event.status === 'Concluded';
    if (event.isFeatured) {
      row.classList.add('featured-event');
    }
    if (isEnded) {
      row.classList.add('ended-event');
    }

    // Title (scrollable, clickable)
    const titleCell = document.createElement('td');
    titleCell.className = 'title-cell';
    titleCell.setAttribute('data-label', 'Title');
    const titleSpan = document.createElement('span');
    titleSpan.className = 'title-scrollable';
    titleSpan.textContent = event.title;
    titleSpan.setAttribute('data-event-id', eventId);
    titleSpan.addEventListener('click', () => {
      if (rowsInEditMode.has(eventId)) {
        currentEditingTable = 'published';
        openEditTitleModal(eventId, event.title);
      } else {
        openViewTitleModal(event.title);
      }
    });
    titleCell.appendChild(titleSpan);
    row.appendChild(titleCell);

    // Description (clickable)
    const descCell = document.createElement('td');
    descCell.className = 'desc-cell';
    descCell.setAttribute('data-label', 'Description');
    const descSpan = document.createElement('span');
    descSpan.className = 'desc-clickable';
    descSpan.textContent = event.description;
    descSpan.setAttribute('data-event-id', eventId);
    descSpan.addEventListener('click', () => {
      if (rowsInEditMode.has(eventId)) {
        currentEditingTable = 'published';
        openEditDescModal(eventId, event.description);
      } else {
        openViewDescModal(event.description);
      }
    });
    descCell.appendChild(descSpan);
    row.appendChild(descCell);

    // Location (clickable icon)
    const locationCell = document.createElement('td');
    locationCell.className = 'location-cell';
    locationCell.setAttribute('data-label', 'Location');
    const locationIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    locationIcon.setAttribute('class', 'location-icon');
    locationIcon.setAttribute('viewBox', '0 0 24 24');
    locationIcon.setAttribute('fill', 'currentColor');
    locationIcon.innerHTML = '<path d="M12 2L3 9V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V9L12 2Z"/><path d="M9 22V12H15V22" fill="#FFFBF0"/>';
    locationIcon.setAttribute('data-event-id', eventId);
    locationIcon.setAttribute('data-location', event.location);
    locationIcon.addEventListener('click', () => {
      if (rowsInEditMode.has(eventId)) {
        currentEditingTable = 'published';
        openEditLocationModal(eventId, event.location);
      } else {
        openViewLocationModal(event.location);
      }
    });
    locationCell.appendChild(locationIcon);
    row.appendChild(locationCell);

    // Date & Time (clickable)
    const dateCell = document.createElement('td');
    dateCell.className = 'date-cell';
    dateCell.setAttribute('data-label', 'Date & Time');
    const dateDisplay = document.createElement('div');
    dateDisplay.className = 'date-display';
    dateDisplay.style.cursor = 'pointer';
    dateDisplay.setAttribute('data-event-id', eventId);
    dateDisplay.addEventListener('click', () => {
      if (rowsInEditMode.has(eventId)) {
        currentEditingTable = 'published';
        openEditDateModal(eventId, event);
      } else {
        openViewDateModal(event.date);
      }
    });
    const dateIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dateIcon.setAttribute('class', 'date-icon');
    dateIcon.setAttribute('viewBox', '0 0 24 24');
    dateIcon.setAttribute('fill', 'currentColor');
    dateIcon.innerHTML = '<path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3 4.9 3 6V20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20Z"/>';
    dateDisplay.appendChild(dateIcon);
    const dateText = document.createElement('span');
    dateText.textContent = formatShortDate(event.date);
    dateDisplay.appendChild(dateText);
    dateCell.appendChild(dateDisplay);
    row.appendChild(dateCell);

    // College Tags - show all colleges
    const collegeCell = document.createElement('td');
    collegeCell.className = 'tags-cell';
    collegeCell.setAttribute('data-label', 'College');
    const collegeContainer = document.createElement('div');
    collegeContainer.className = 'tags-container';

    // Get colleges array (support both old single college and new multiple colleges)
    const colleges = event.colleges || (event.college ? [event.college] : []);
    const mainCollegeCode = event.mainCollege || event.college || colleges[0] || 'TUP';
    const mainCollegeObj = availableColleges.find(c => c.code === mainCollegeCode);

    // Show main college tag
    const collegeTag = document.createElement('span');
    collegeTag.className = `tag-item tag-item--college ${mainCollegeObj?.color === 'tup' ? 'tag-item--tup' : ''}`;
    collegeTag.textContent = mainCollegeCode;
    collegeTag.title = mainCollegeObj?.name || mainCollegeCode;
    collegeTag.setAttribute('data-event-id', eventId);
    collegeTag.addEventListener('click', () => {
      if (rowsInEditMode.has(eventId)) {
        currentEditingTable = 'published';
        openEditCollegeModal(eventId, mainCollegeCode);
      } else {
        openViewCollegesModal(colleges, mainCollegeCode);
      }
    });
    collegeContainer.appendChild(collegeTag);

    // Show +N indicator if there are additional colleges
    if (colleges.length > 1) {
      const additionalColleges = colleges.filter(c => c !== mainCollegeCode);
      const countTag = document.createElement('span');
      countTag.className = 'tag-item tag-item--count';
      countTag.textContent = `+${additionalColleges.length}`;
      countTag.title = additionalColleges.map(code => {
        const col = availableColleges.find(c => c.code === code);
        return col ? col.name : code;
      }).join(', ');
      countTag.addEventListener('click', () => {
        if (rowsInEditMode.has(eventId)) {
          currentEditingTable = 'published';
          openEditCollegeModal(eventId, mainCollegeCode);
        } else {
          openViewCollegesModal(colleges, mainCollegeCode);
        }
      });
      collegeContainer.appendChild(countTag);
    }

    row.appendChild(collegeCell);
    collegeCell.appendChild(collegeContainer);

    // Organization Tags (show main + indicator)
    const orgCell = document.createElement('td');
    orgCell.className = 'tags-cell';
    orgCell.setAttribute('data-label', 'Organization');
    const orgContainer = document.createElement('div');
    orgContainer.className = 'tags-container';

    // Get organizations array (support both new array and old single field)
    const orgs = event.organizations && event.organizations.length > 0
      ? event.organizations
      : (event.organization ? [event.organization] : []);

    if (orgs.length > 0) {
      // Show first organization
      const orgTag = document.createElement('span');
      orgTag.className = 'tag-item tag-item--org';
      orgTag.textContent = orgs[0];
      orgTag.setAttribute('data-event-id', eventId);
      orgTag.addEventListener('click', () => {
        if (rowsInEditMode.has(eventId)) {
          currentEditingTable = 'published';
          openEditOrgModal(eventId, event.organization);
        } else {
          openViewOrgsModal(orgs);
        }
      });
      orgContainer.appendChild(orgTag);

      // Show +N indicator if there are additional organizations
      if (orgs.length > 1) {
        const countTag = document.createElement('span');
        countTag.className = 'tag-item tag-item--count';
        countTag.textContent = `+${orgs.length - 1}`;
        countTag.title = orgs.slice(1).join(', ');
        countTag.addEventListener('click', () => {
          if (rowsInEditMode.has(eventId)) {
            currentEditingTable = 'published';
            openEditOrgModal(eventId, event.organization);
          } else {
            openViewOrgsModal(orgs);
          }
        });
        orgContainer.appendChild(countTag);
      }
    } else {
      // Show placeholder if no organizations
      const orgTag = document.createElement('span');
      orgTag.className = 'tag-item tag-item--org tag-item--placeholder';
      orgTag.textContent = 'Select Organization';
      orgTag.setAttribute('data-event-id', eventId);
      orgTag.addEventListener('click', () => {
        if (rowsInEditMode.has(eventId)) {
          currentEditingTable = 'published';
          openEditOrgModal(eventId, event.organization);
        }
      });
      orgContainer.appendChild(orgTag);
    }

    orgCell.appendChild(orgContainer);
    row.appendChild(orgCell);

    // Status
    const statusCell = document.createElement('td');
    statusCell.className = 'status-cell';
    statusCell.setAttribute('data-label', 'Status');
    const statusBadge = document.createElement('span');
    // Derive statusColor from status
    const statusColor = typeof getStatusColor !== 'undefined'
      ? getStatusColor(event.status)
      : event.status.toLowerCase();
    statusBadge.className = `status-badge ${statusColor}`;
    statusBadge.innerHTML = `<span class="status-dot"></span> ${event.status}`;
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    // Images (clickable icon)
    const imagesCell = document.createElement('td');
    imagesCell.className = 'images-cell';
    imagesCell.setAttribute('data-label', 'Images');
    const imagesIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    imagesIcon.setAttribute('class', 'images-icon');
    imagesIcon.setAttribute('viewBox', '0 0 24 24');
    imagesIcon.setAttribute('fill', 'currentColor');
    imagesIcon.setAttribute('width', '24');
    imagesIcon.setAttribute('height', '24');
    imagesIcon.innerHTML = '<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>';
    imagesIcon.style.cursor = 'pointer';
    imagesIcon.style.fill = '#666';
    imagesIcon.style.transition = 'all 0.2s ease';
    imagesIcon.setAttribute('data-event-id', eventId);
    imagesIcon.addEventListener('click', () => {
      currentEditingTable = 'published';
      openImagesModal(eventId, event);
    });
    imagesIcon.addEventListener('mouseenter', () => {
      imagesIcon.style.fill = '#B81E20';
      imagesIcon.style.transform = 'scale(1.1)';
    });
    imagesIcon.addEventListener('mouseleave', () => {
      imagesIcon.style.fill = '#666';
      imagesIcon.style.transform = 'scale(1)';
    });
    imagesCell.appendChild(imagesIcon);
    row.appendChild(imagesCell);

    // Actions
    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions-cell';
    actionsCell.setAttribute('data-label', 'Actions');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions-buttons';
    actionsDiv.id = `actions-${eventId}`;

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn action-btn--edit';
    editBtn.setAttribute('data-event-id', eventId);
    editBtn.setAttribute('data-table', 'published');
    editBtn.setAttribute('title', 'Edit');
    editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    editBtn.addEventListener('click', () => toggleEditMode(eventId, 'published', row));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn action-btn--delete';
    deleteBtn.setAttribute('data-event-id', eventId);
    deleteBtn.setAttribute('data-table', 'published');
    deleteBtn.setAttribute('title', 'Delete');
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
        // Delete from Supabase if function available
        if (typeof deleteEvent === 'function') {
          const result = await deleteEvent(eventId);
          if (!result.success) {
            alert(`Error deleting event: ${result.error}`);
            return;
          }
        }

        // Remove from local data
        delete eventsData[eventId];
        rowsInEditMode.delete(eventId);
        populatePublishedEventsTable();
      }
    });

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    actionsCell.appendChild(actionsDiv);
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });
}

// ===== FORMAT TODAY'S DATE FOR EVENT =====
function formatTodayDate() {
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = dayNames[today.getDay()];
  const month = monthNames[today.getMonth()];
  const day = today.getDate();
  const year = today.getFullYear();

  // Default time: 9:00 AM - 5:00 PM
  const dateString = `${month} ${day}, ${year} (${dayName}) | 9:00 AM - 5:00 PM`;

  return dateString;
}

// ===== COUNT UNEDITED EVENTS =====
// Counts events that still have ALL default values (completely untouched)
function countUneditedEvents() {
  let count = 0;
  for (const eventId in pendingEventsData) {
    const event = pendingEventsData[eventId];
    // Check if event has ALL default values (completely unedited)
    // Only count as unedited if BOTH title AND description are still defaults
    if (event.title === 'Add Title' && event.description === 'Add Description') {
      count++;
    }
  }
  return count;
}

// ===== CREATE NEW PENDING EVENT =====
async function createNewPendingEvent() {
  // Check if we've reached the maximum of 3 unedited events
  const uneditedCount = countUneditedEvents();
  if (uneditedCount >= 3) {
    alert('You can only have a maximum of 3 unedited events. Please edit or delete existing events before creating new ones.');
    return;
  }

  // Check if createEvent function is available
  if (typeof createEvent !== 'function') {
    alert('An error has occurred, a new event was not created.');
    return;
  }

  const todayDate = formatTodayDate();

  // Create Date objects for start and end times (today, 9 AM - 5 PM)
  const today = new Date();
  const startDate = new Date(today);
  startDate.setHours(9, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setHours(17, 0, 0, 0);

  // Create new event with default values (matching old implementation structure)
  const newEvent = {
    title: 'Add Title',
    description: 'Add Description',
    location: 'Add Location',
    date: todayDate,
    startDate: startDate, // Explicit Date object for database
    endDate: endDate, // Explicit Date object for database
    // Explicit time fields (HH:MM:SS) to avoid timezone shifts
    startTime: '09:00:00',
    endTime: '17:00:00',
    status: 'Pending',
    isFeatured: false,
    likes: 0,
    college: 'TUP', // Main college (for backward compatibility)
    colleges: ['TUP'], // Array of all colleges
    mainCollege: 'TUP', // Main college for event card display
    collegeColor: 'tup',
    organization: 'TUP USG Manila',
    images: [], // Empty images array
    thumbnailIndex: 0,
    universityLogo: 'images/tup.png',
    createdAt: null,
    updatedAt: null,
    createdBy: null
  };

  // Show loading state - change cursor to loading
  document.body.style.cursor = 'wait';
  const addRow = document.querySelector('.add-new-event-row');
  if (addRow) {
    addRow.style.opacity = '0.5';
    addRow.style.pointerEvents = 'none';
  }

  try {
    // Create event directly in database with timeout protection
    // Note: events-services.js has its own 15s timeout, this is a backup
    const createPromise = createEvent(newEvent);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Event creation timed out after 30 seconds')), 30000)
    );

    const result = await Promise.race([createPromise, timeoutPromise]);

    // Restore cursor immediately after promise resolves
    document.body.style.cursor = '';
    if (addRow) {
      addRow.style.opacity = '1';
      addRow.style.pointerEvents = 'auto';
    }

    if (result && result.success && result.event && result.event.id) {
      // Add event to pendingEventsData with DB ID
      pendingEventsData[result.event.id] = result.event;

      console.log('Event created successfully:', result.event.id);

      // Refresh table and scroll to new event
      populatePendingEventsTable();
      setTimeout(() => {
        const newRow = document.querySelector(`tr[data-event-id="${result.event.id}"]`);
        if (newRow) {
          newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } else {
      // Show error message with more details in console
      const errorMsg = result?.error || 'Unknown error';
      console.error('Failed to create event:', errorMsg);
      console.error('Event data that failed:', newEvent);
      console.error('Full result:', result);
      alert('An error has occurred, a new event was not created. Check console for details.');
    }
  } catch (error) {
    // Restore cursor on error (always restore, even on timeout)
    document.body.style.cursor = '';
    if (addRow) {
      addRow.style.opacity = '1';
      addRow.style.pointerEvents = 'auto';
    }

    // Show error message with details
    console.error('Error creating event:', error);
    console.error('Error stack:', error.stack);
    console.error('Event data that failed:', newEvent);

    if (error.message && error.message.includes('timed out')) {
      alert('Event creation is taking too long. Please check your connection and try again.');
    } else {
      alert('An error has occurred, a new event was not created. Check console for details.');
    }
  }
}

// ===== BUILD ADD NEW EVENT ROW =====
function buildAddNewEventRow() {
  const row = document.createElement('tr');
  row.className = 'add-new-event-row';
  row.style.cursor = 'pointer';
  row.style.backgroundColor = '#f5f5f5';

  row.addEventListener('click', () => {
    createNewPendingEvent();
  });

  row.addEventListener('mouseenter', () => {
    row.style.backgroundColor = '#e8e8e8';
  });

  row.addEventListener('mouseleave', () => {
    row.style.backgroundColor = '#f5f5f5';
  });

  // Create a single cell that spans all columns
  const cell = document.createElement('td');
  cell.colSpan = 9; // Title, Description, Location, Date & Time, College, Organization, Status, Images, Actions
  cell.style.textAlign = 'center';
  cell.style.padding = '20px';
  cell.style.fontSize = '1.2rem';
  cell.style.color = '#666';

  // Add plus icon
  const plusIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  plusIcon.setAttribute('width', '32');
  plusIcon.setAttribute('height', '32');
  plusIcon.setAttribute('viewBox', '0 0 24 24');
  plusIcon.setAttribute('fill', 'currentColor');
  plusIcon.style.verticalAlign = 'middle';
  plusIcon.style.marginRight = '10px';
  plusIcon.innerHTML = '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>';

  const text = document.createTextNode('Add New Event');

  cell.appendChild(plusIcon);
  cell.appendChild(text);
  row.appendChild(cell);

  return row;
}

// ===== POPULATE PENDING EVENTS TABLE =====
function populatePendingEventsTable() {
  const tbody = document.getElementById('pendingEventsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const sortedPending = sortEvents(pendingEventsData);

  sortedPending.forEach(([eventId, event]) => {
    const row = document.createElement('tr');
    row.setAttribute('data-event-id', eventId);

    // Title (scrollable, clickable)
    const titleCell = document.createElement('td');
    titleCell.className = 'title-cell';
    titleCell.setAttribute('data-label', 'Title');
    const titleSpan = document.createElement('span');
    titleSpan.className = 'title-scrollable';
    titleSpan.textContent = event.title;
    titleSpan.setAttribute('data-event-id', eventId);
    titleSpan.addEventListener('click', () => {
      // Pending events are always editable (no edit mode needed)
      currentEditingTable = 'pending';
      openEditTitleModal(eventId, event.title);
    });
    titleCell.appendChild(titleSpan);
    row.appendChild(titleCell);

    // Description (clickable)
    const descCell = document.createElement('td');
    descCell.className = 'desc-cell';
    descCell.setAttribute('data-label', 'Description');
    const descSpan = document.createElement('span');
    descSpan.className = 'desc-clickable';
    descSpan.textContent = event.description;
    descSpan.setAttribute('data-event-id', eventId);
    descSpan.addEventListener('click', () => {
      // Pending events are always editable (no edit mode needed)
      currentEditingTable = 'pending';
      openEditDescModal(eventId, event.description);
    });
    descCell.appendChild(descSpan);
    row.appendChild(descCell);

    // Location (clickable icon)
    const locationCell = document.createElement('td');
    locationCell.className = 'location-cell';
    locationCell.setAttribute('data-label', 'Location');
    const locationIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    locationIcon.setAttribute('class', 'location-icon');
    locationIcon.setAttribute('viewBox', '0 0 24 24');
    locationIcon.setAttribute('fill', 'currentColor');
    locationIcon.innerHTML = '<path d="M12 2L3 9V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V9L12 2Z"/><path d="M9 22V12H15V22" fill="#FFFBF0"/>';
    locationIcon.setAttribute('data-event-id', eventId);
    locationIcon.setAttribute('data-location', event.location);
    locationIcon.addEventListener('click', () => {
      // Pending events are always editable (no edit mode needed)
      currentEditingTable = 'pending';
      openEditLocationModal(eventId, event.location);
    });
    locationCell.appendChild(locationIcon);
    row.appendChild(locationCell);

    // Date & Time (clickable - always editable for pending events)
    const dateCell = document.createElement('td');
    dateCell.className = 'date-cell';
    dateCell.setAttribute('data-label', 'Date & Time');
    const dateDisplay = document.createElement('div');
    dateDisplay.className = 'date-display';
    dateDisplay.style.cursor = 'pointer';
    dateDisplay.setAttribute('data-event-id', eventId);
    dateDisplay.addEventListener('click', () => {
      // Pending events are always editable (no edit mode needed)
      currentEditingTable = 'pending';
      openEditDateModal(eventId, event);
    });
    const dateIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dateIcon.setAttribute('class', 'date-icon');
    dateIcon.setAttribute('viewBox', '0 0 24 24');
    dateIcon.setAttribute('fill', 'currentColor');
    dateIcon.innerHTML = '<path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3 4.9 3 6V20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20Z"/>';
    dateDisplay.appendChild(dateIcon);
    const dateText = document.createElement('span');
    dateText.textContent = formatShortDate(event.date);
    dateDisplay.appendChild(dateText);
    dateCell.appendChild(dateDisplay);
    row.appendChild(dateCell);

    // College Tags (show main + indicator)
    const collegeCell = document.createElement('td');
    collegeCell.className = 'tags-cell';
    collegeCell.setAttribute('data-label', 'College');
    const collegeContainer = document.createElement('div');
    collegeContainer.className = 'tags-container';

    // Get all colleges for this event
    const pendingColleges = event.colleges && event.colleges.length > 0
      ? event.colleges
      : (event.college ? [event.college] : ['TUP']);
    const pendingMainCollegeCode = event.mainCollege || event.college || pendingColleges[0];
    const pendingMainCollegeObj = availableColleges.find(c => c.code === pendingMainCollegeCode);

    // Show main college tag
    const pendingCollegeTag = document.createElement('span');
    pendingCollegeTag.className = `tag-item tag-item--college ${pendingMainCollegeObj?.color === 'tup' ? 'tag-item--tup' : ''}`;
    pendingCollegeTag.textContent = pendingMainCollegeCode;
    pendingCollegeTag.title = pendingMainCollegeObj?.name || pendingMainCollegeCode;
    pendingCollegeTag.setAttribute('data-event-id', eventId);
    pendingCollegeTag.addEventListener('click', () => {
      currentEditingTable = 'pending';
      openEditCollegeModal(eventId, pendingMainCollegeCode);
    });
    collegeContainer.appendChild(pendingCollegeTag);

    // Show +N indicator if there are additional colleges
    if (pendingColleges.length > 1) {
      const additionalPendingColleges = pendingColleges.filter(c => c !== pendingMainCollegeCode);
      const pendingCollegeCountTag = document.createElement('span');
      pendingCollegeCountTag.className = 'tag-item tag-item--count';
      pendingCollegeCountTag.textContent = `+${additionalPendingColleges.length}`;
      pendingCollegeCountTag.title = additionalPendingColleges.map(code => {
        const col = availableColleges.find(c => c.code === code);
        return col ? col.name : code;
      }).join(', ');
      pendingCollegeCountTag.addEventListener('click', () => {
        currentEditingTable = 'pending';
        openEditCollegeModal(eventId, pendingMainCollegeCode);
      });
      collegeContainer.appendChild(pendingCollegeCountTag);
    }

    row.appendChild(collegeCell);
    collegeCell.appendChild(collegeContainer);

    // Organization Tags (show main + indicator)
    const orgCell = document.createElement('td');
    orgCell.className = 'tags-cell';
    orgCell.setAttribute('data-label', 'Organization');
    const orgContainer = document.createElement('div');
    orgContainer.className = 'tags-container';

    // Get organizations array (support both new array and old single field)
    const pendingOrgs = event.organizations && event.organizations.length > 0
      ? event.organizations
      : (event.organization ? [event.organization] : []);

    if (pendingOrgs.length > 0) {
      // Show first organization
      const pendingOrgTag = document.createElement('span');
      pendingOrgTag.className = 'tag-item tag-item--org';
      pendingOrgTag.textContent = pendingOrgs[0];
      pendingOrgTag.setAttribute('data-event-id', eventId);
      pendingOrgTag.addEventListener('click', () => {
        currentEditingTable = 'pending';
        openEditOrgModal(eventId, event.organization);
      });
      orgContainer.appendChild(pendingOrgTag);

      // Show +N indicator if there are additional organizations
      if (pendingOrgs.length > 1) {
        const pendingOrgCountTag = document.createElement('span');
        pendingOrgCountTag.className = 'tag-item tag-item--count';
        pendingOrgCountTag.textContent = `+${pendingOrgs.length - 1}`;
        pendingOrgCountTag.title = pendingOrgs.slice(1).join(', ');
        pendingOrgCountTag.addEventListener('click', () => {
          currentEditingTable = 'pending';
          openEditOrgModal(eventId, event.organization);
        });
        orgContainer.appendChild(pendingOrgCountTag);
      }
    } else {
      // Show placeholder if no organizations
      const pendingOrgTag = document.createElement('span');
      pendingOrgTag.className = 'tag-item tag-item--org tag-item--placeholder';
      pendingOrgTag.textContent = 'Select Organization';
      pendingOrgTag.setAttribute('data-event-id', eventId);
      pendingOrgTag.addEventListener('click', () => {
        currentEditingTable = 'pending';
        openEditOrgModal(eventId, event.organization);
      });
      orgContainer.appendChild(pendingOrgTag);
    }

    orgCell.appendChild(orgContainer);
    row.appendChild(orgCell);

    // Status
    const statusCell = document.createElement('td');
    statusCell.className = 'status-cell';
    statusCell.setAttribute('data-label', 'Status');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge pending';
    statusBadge.innerHTML = `<span class="status-dot"></span> ${event.status}`;
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    // Images (clickable icon)
    const imagesCell = document.createElement('td');
    imagesCell.className = 'images-cell';
    imagesCell.setAttribute('data-label', 'Images');
    const imagesIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    imagesIcon.setAttribute('class', 'images-icon');
    imagesIcon.setAttribute('viewBox', '0 0 24 24');
    imagesIcon.setAttribute('fill', 'currentColor');
    imagesIcon.setAttribute('width', '24');
    imagesIcon.setAttribute('height', '24');
    imagesIcon.innerHTML = '<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>';
    imagesIcon.style.cursor = 'pointer';
    imagesIcon.style.fill = '#666';
    imagesIcon.style.transition = 'all 0.2s ease';
    imagesIcon.setAttribute('data-event-id', eventId);
    imagesIcon.addEventListener('click', () => {
      currentEditingTable = 'pending';
      openImagesModal(eventId, event);
    });
    imagesIcon.addEventListener('mouseenter', () => {
      imagesIcon.style.fill = '#B81E20';
      imagesIcon.style.transform = 'scale(1.1)';
    });
    imagesIcon.addEventListener('mouseleave', () => {
      imagesIcon.style.fill = '#666';
      imagesIcon.style.transform = 'scale(1)';
    });
    imagesCell.appendChild(imagesIcon);
    row.appendChild(imagesCell);

    // Actions (Approve & Reject)
    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions-cell';
    actionsCell.setAttribute('data-label', 'Actions');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions-buttons';

    const approveBtn = document.createElement('button');
    approveBtn.className = 'action-btn action-btn--approve';
    approveBtn.setAttribute('data-event-id', eventId);
    approveBtn.setAttribute('title', 'Approve');
    approveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    approveBtn.addEventListener('click', () => approvePendingEvent(eventId));

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'action-btn action-btn--reject';
    rejectBtn.setAttribute('data-event-id', eventId);
    rejectBtn.setAttribute('title', 'Reject');
    rejectBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    rejectBtn.addEventListener('click', () => rejectPendingEvent(eventId));

    actionsDiv.appendChild(approveBtn);
    actionsDiv.appendChild(rejectBtn);
    actionsCell.appendChild(actionsDiv);
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });

  // Add the "+" row at the bottom
  const addRow = buildAddNewEventRow();
  tbody.appendChild(addRow);
}

// ===== APPROVE PENDING EVENT =====
async function approvePendingEvent(eventId) {
  if (!pendingEventsData[eventId]) {
    alert('Event not found');
    return;
  }

  const pendingEvent = pendingEventsData[eventId];

  // Approve in Supabase if function available
  if (typeof approveEvent === 'function') {
    // Check if event already exists in the database (has valid UUID)
    if (isValidUUID(eventId)) {
      // Event already in database - just approve it (update status)
      console.log('Approving existing database event:', eventId);
      const approveResult = await approveEvent(eventId);
      if (!approveResult.success) {
        alert(`Error approving event: ${approveResult.error}`);
        return;
      }

      // Update local data with approved event
      if (approveResult.event) {
        eventsData[eventId] = approveResult.event;
        delete pendingEventsData[eventId];
      }
    } else if (typeof createEvent === 'function') {
      // Event is local-only draft - create first, then approve
      console.log('Creating and approving local draft event:', eventId);
      const createResult = await createEvent(pendingEvent);
      if (!createResult.success) {
        alert(`Error creating event: ${createResult.error}`);
        return;
      }

      const createdEvent = createResult.event;
      if (!createdEvent || !createdEvent.id) {
        alert('Error: created event missing id');
        return;
      }

      // Now approve the newly created event
      const approveResult = await approveEvent(createdEvent.id);
      if (!approveResult.success) {
        alert(`Error approving event: ${approveResult.error}`);
        return;
      }

      // Update local data with approved event
      if (approveResult.event) {
        const newEventId = approveResult.event.id;
        eventsData[newEventId] = approveResult.event;
        delete pendingEventsData[eventId];
      }
    }
  } else {
    // Fallback: local approval (for development)
    const newEventId = `event-${Object.keys(eventsData).length + 1}`;
    eventsData[newEventId] = {
      ...pendingEvent,
      status: 'Upcoming'
    };
    delete pendingEventsData[eventId];
  }

  // Refresh both tables
  populatePublishedEventsTable();
  populatePendingEventsTable();
}

// ===== REJECT PENDING EVENT =====
async function rejectPendingEvent(eventId) {
  if (!pendingEventsData[eventId]) {
    alert('Event not found');
    return;
  }

  const event = pendingEventsData[eventId];

  if (!confirm(`Are you sure you want to reject "${event.title}"?`)) {
    return;
  }

  // Reject in Supabase if function available
  if (typeof rejectEvent === 'function') {
    const result = await rejectEvent(eventId);
    if (!result.success) {
      alert(`Error rejecting event: ${result.error}`);
      return;
    }
  }

  // Remove from pending
  delete pendingEventsData[eventId];

  // Refresh pending table
  populatePendingEventsTable();
}

// ===== TOGGLE EDIT MODE FOR ROW =====
function toggleEditMode(eventId, tableType, rowElement) {
  const isInEditMode = rowsInEditMode.has(eventId);

  if (isInEditMode) {
    // Exit edit mode
    rowsInEditMode.delete(eventId);
    rowElement.classList.remove('edit-mode');
    updateActionButtons(eventId, tableType, false);
  } else {
    // Enter edit mode
    rowsInEditMode.add(eventId);
    rowElement.classList.add('edit-mode');
    updateActionButtons(eventId, tableType, true);
  }
}

// ===== UPDATE ACTION BUTTONS =====
function updateActionButtons(eventId, tableType, isEditMode) {
  const actionsDiv = document.getElementById(`actions-${eventId}`);
  if (!actionsDiv) return;

  actionsDiv.innerHTML = '';

  if (isEditMode) {
    // Show Save and Cancel buttons only (no delete in edit mode)
    const saveBtn = document.createElement('button');
    saveBtn.className = 'action-btn action-btn--save';
    saveBtn.setAttribute('data-event-id', eventId);
    saveBtn.setAttribute('title', 'Save Changes');
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    saveBtn.addEventListener('click', () => {
      // Save changes (all modals already handle saving)
      rowsInEditMode.delete(eventId);
      const row = document.querySelector(`tr[data-event-id="${eventId}"]`) ||
        Array.from(document.querySelectorAll('#publishedEventsTableBody tr')).find(r =>
          r.querySelector(`[data-event-id="${eventId}"]`));
      if (row) {
        row.classList.remove('edit-mode');
        updateActionButtons(eventId, tableType, false);
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'action-btn action-btn--cancel';
    cancelBtn.setAttribute('data-event-id', eventId);
    cancelBtn.setAttribute('title', 'Cancel');
    cancelBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    cancelBtn.addEventListener('click', () => {
      rowsInEditMode.delete(eventId);
      const row = document.querySelector(`tr[data-event-id="${eventId}"]`) ||
        Array.from(document.querySelectorAll('#publishedEventsTableBody tr')).find(r =>
          r.querySelector(`[data-event-id="${eventId}"]`));
      if (row) {
        row.classList.remove('edit-mode');
        updateActionButtons(eventId, tableType, false);
        // Reload table to reset any unsaved changes
        populatePublishedEventsTable();
      }
    });

    // Save on left, Cancel on right
    actionsDiv.appendChild(saveBtn);
    actionsDiv.appendChild(cancelBtn);
  } else {
    // Show Edit and Delete buttons
    const event = eventsData[eventId];

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn action-btn--edit';
    editBtn.setAttribute('data-event-id', eventId);
    editBtn.setAttribute('data-table', tableType);
    editBtn.setAttribute('title', 'Edit');
    editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    editBtn.addEventListener('click', () => {
      const row = Array.from(document.querySelectorAll('#publishedEventsTableBody tr')).find(r =>
        r.querySelector(`[data-event-id="${eventId}"]`));
      if (row) toggleEditMode(eventId, tableType, row);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn action-btn--delete';
    deleteBtn.setAttribute('data-event-id', eventId);
    deleteBtn.setAttribute('data-table', tableType);
    deleteBtn.setAttribute('title', 'Delete');
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
        delete eventsData[eventId];
        rowsInEditMode.delete(eventId);
        populatePublishedEventsTable();
      }
    });

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
  }
}

// ===== MODAL FUNCTIONS =====

function openEditTitleModal(eventId, currentTitle) {
  currentEditingEventId = eventId;
  currentEditingField = 'title';
  if (!currentEditingTable) currentEditingTable = 'published';
  document.getElementById('editTitleInput').value = currentTitle;

  const featureCheckbox = document.getElementById('featureEventCheckbox');
  if (featureCheckbox) {
    const source = currentEditingTable === 'pending' ? pendingEventsData : eventsData;
    const eventData = source?.[eventId];
    featureCheckbox.checked = !!eventData?.isFeatured;
  }
  document.getElementById('editTitleModal').classList.add('active');
}

function openEditDescModal(eventId, currentDesc) {
  currentEditingEventId = eventId;
  currentEditingField = 'description';
  if (!currentEditingTable) currentEditingTable = 'published';
  document.getElementById('editDescInput').value = currentDesc;
  document.getElementById('editDescModal').classList.add('active');
}

function openEditLocationModal(eventId, currentLocation) {
  currentEditingEventId = eventId;
  currentEditingField = 'location';
  if (!currentEditingTable) currentEditingTable = 'published';
  document.getElementById('editLocationInput').value = currentLocation;
  document.getElementById('editLocationModal').classList.add('active');
}

function openEditCollegeModal(eventId, currentCollege) {
  currentEditingEventId = eventId;
  currentEditingField = 'college';
  if (!currentEditingTable) currentEditingTable = 'published';

  const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
  const event = source[eventId];

  // Get current colleges (support both old single college and new multiple colleges)
  const currentColleges = event.colleges || (event.college ? [event.college] : []);
  const mainCollege = event.mainCollege || event.college || 'TUP';

  const selector = document.getElementById('collegeTagSelector');
  selector.innerHTML = '';

  // Create a flex container for side-by-side layout
  const flexContainer = document.createElement('div');
  flexContainer.style.display = 'flex';
  flexContainer.style.gap = '2rem';
  flexContainer.style.alignItems = 'flex-start';

  // Left side: Main College Dropdown
  const leftColumn = document.createElement('div');
  leftColumn.style.flex = '1';

  const mainLabel = document.createElement('label');
  mainLabel.textContent = 'Main College (for event card display):';
  mainLabel.style.display = 'block';
  mainLabel.style.marginBottom = '10px';
  mainLabel.style.fontWeight = 'bold';
  mainLabel.style.color = '#333';
  leftColumn.appendChild(mainLabel);

  const mainCollegeSelect = document.createElement('select');
  mainCollegeSelect.id = 'mainCollegeSelect';
  mainCollegeSelect.style.width = '100%';
  mainCollegeSelect.style.padding = '10px';
  mainCollegeSelect.style.border = '2px solid #e0e0e0';
  mainCollegeSelect.style.borderRadius = '8px';
  mainCollegeSelect.style.fontSize = '1rem';
  mainCollegeSelect.style.backgroundColor = '#fff';
  mainCollegeSelect.style.cursor = 'pointer';

  availableColleges.forEach(college => {
    const option = document.createElement('option');
    option.value = college.code;
    option.textContent = college.name;
    if (mainCollege === college.code) {
      option.selected = true;
    }
    mainCollegeSelect.appendChild(option);
  });

  leftColumn.appendChild(mainCollegeSelect);

  // Right side: Collaboration Colleges Checkboxes
  const rightColumn = document.createElement('div');
  rightColumn.style.flex = '1';

  const collabLabel = document.createElement('div');
  collabLabel.textContent = 'Collaboration Colleges:';
  collabLabel.style.marginBottom = '10px';
  collabLabel.style.fontWeight = 'bold';
  collabLabel.style.color = '#333';
  rightColumn.appendChild(collabLabel);

  const checkboxesContainer = document.createElement('div');
  checkboxesContainer.id = 'collegeCheckboxesContainer';
  checkboxesContainer.style.maxHeight = '300px';
  checkboxesContainer.style.overflowY = 'auto';
  checkboxesContainer.style.border = '2px solid #e0e0e0';
  checkboxesContainer.style.borderRadius = '8px';
  checkboxesContainer.style.padding = '10px';

  // Function to rebuild checkboxes (excludes the currently selected main college)
  function rebuildCollegeCheckboxes(selectedMainCollege, checkedColleges) {
    checkboxesContainer.innerHTML = '';

    availableColleges.forEach(college => {
      // Skip the main college from checkboxes
      if (college.code === selectedMainCollege) {
        return;
      }

      const item = document.createElement('div');
      item.className = 'tag-checkbox-item';
      item.style.marginBottom = '8px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `college-${college.code}`;
      checkbox.value = college.code;
      checkbox.checked = checkedColleges.includes(college.code);

      const label = document.createElement('label');
      label.setAttribute('for', `college-${college.code}`);
      label.textContent = college.name;
      label.style.marginLeft = '8px';
      label.style.cursor = 'pointer';

      item.appendChild(checkbox);
      item.appendChild(label);
      checkboxesContainer.appendChild(item);
    });
  }

  // Initial build of checkboxes
  rebuildCollegeCheckboxes(mainCollege, currentColleges);

  // When main college changes, rebuild checkboxes (excluding the new main college)
  mainCollegeSelect.addEventListener('change', function () {
    // Get currently checked collaboration colleges
    const checkedBoxes = checkboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const checkedColleges = Array.from(checkedBoxes).map(cb => cb.value);

    // Rebuild checkboxes excluding the newly selected main college
    rebuildCollegeCheckboxes(this.value, checkedColleges);
  });

  rightColumn.appendChild(checkboxesContainer);

  // Add both columns to flex container
  flexContainer.appendChild(leftColumn);
  flexContainer.appendChild(rightColumn);
  selector.appendChild(flexContainer);

  document.getElementById('editCollegeModal').classList.add('active');
}

// Track selected organizations in order
let selectedOrganizationsOrder = [];

function openEditOrgModal(eventId, currentOrg) {
  currentEditingEventId = eventId;
  currentEditingField = 'organization';
  if (!currentEditingTable) currentEditingTable = 'published';

  const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
  const event = source[eventId];

  // Get current organizations (support both old single org and new array)
  const currentOrgs = event.organizations || (event.organization ? [event.organization] : []);
  selectedOrganizationsOrder = [...currentOrgs]; // Initialize with current order

  const selector = document.getElementById('orgTagSelector');
  selector.innerHTML = '';

  // Add search input
  const searchContainer = document.createElement('div');
  searchContainer.style.marginBottom = '15px';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'orgSearchInput';
  searchInput.placeholder = 'Search organizations...';
  searchInput.style.width = '100%';
  searchInput.style.padding = '10px';
  searchInput.style.border = '2px solid #e0e0e0';
  searchInput.style.borderRadius = '8px';
  searchInput.style.fontSize = '1rem';
  searchInput.style.boxSizing = 'border-box';

  searchContainer.appendChild(searchInput);
  selector.appendChild(searchContainer);

  // Container for checkboxes
  const checkboxesContainer = document.createElement('div');
  checkboxesContainer.id = 'orgCheckboxesContainer';
  checkboxesContainer.style.maxHeight = '300px';
  checkboxesContainer.style.overflowY = 'auto';
  selector.appendChild(checkboxesContainer);

  // Function to render organization checkboxes
  function renderOrgCheckboxes(searchTerm = '') {
    checkboxesContainer.innerHTML = '';
    const searchLower = searchTerm.toLowerCase();

    // Separate checked and unchecked orgs
    const checkedOrgs = selectedOrganizationsOrder.filter(org =>
      availableOrganizations.includes(org)
    );
    const uncheckedOrgs = availableOrganizations.filter(org =>
      !selectedOrganizationsOrder.includes(org)
    );

    // Render checked orgs first (always visible, not filtered)
    checkedOrgs.forEach((org, index) => {
      const item = createOrgCheckboxItem(org, true, index + 1);
      checkboxesContainer.appendChild(item);
    });

    // Add separator if there are checked orgs
    if (checkedOrgs.length > 0 && uncheckedOrgs.length > 0) {
      const separator = document.createElement('div');
      separator.style.borderTop = '1px solid #e0e0e0';
      separator.style.margin = '10px 0';
      checkboxesContainer.appendChild(separator);
    }

    // Render unchecked orgs (filtered by search)
    uncheckedOrgs.forEach(org => {
      // Filter by search term
      if (searchTerm && !org.toLowerCase().includes(searchLower)) {
        return;
      }
      const item = createOrgCheckboxItem(org, false);
      checkboxesContainer.appendChild(item);
    });
  }

  // Function to create a checkbox item
  function createOrgCheckboxItem(org, isChecked, orderNumber = null) {
    const item = document.createElement('div');
    item.className = 'tag-checkbox-item';
    item.style.marginBottom = '8px';
    item.style.display = 'flex';
    item.style.alignItems = 'center';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `org-${org.replace(/\s+/g, '-')}`;
    checkbox.value = org;
    checkbox.checked = isChecked;
    checkbox.style.marginRight = '8px';

    // When checkbox changes, update order and re-render
    checkbox.addEventListener('change', function () {
      if (this.checked) {
        // Add to end of selected list
        if (!selectedOrganizationsOrder.includes(org)) {
          selectedOrganizationsOrder.push(org);
        }
      } else {
        // Remove from selected list
        selectedOrganizationsOrder = selectedOrganizationsOrder.filter(o => o !== org);
      }
      renderOrgCheckboxes(searchInput.value);
    });

    const label = document.createElement('label');
    label.setAttribute('for', `org-${org.replace(/\s+/g, '-')}`);
    label.style.cursor = 'pointer';
    label.style.flex = '1';

    // Show order number for checked items
    if (isChecked && orderNumber) {
      label.innerHTML = `<span style="background: #B81E20; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-right: 8px;">${orderNumber}</span>${org}`;
    } else {
      label.textContent = org;
    }

    item.appendChild(checkbox);
    item.appendChild(label);

    return item;
  }

  // Initial render
  renderOrgCheckboxes();

  // Search functionality
  searchInput.addEventListener('input', function () {
    renderOrgCheckboxes(this.value);
  });

  document.getElementById('editOrgModal').classList.add('active');

  // Focus search input
  setTimeout(() => searchInput.focus(), 100);
}

function openViewDateModal(dateString) {
  document.getElementById('viewDateText').textContent = dateString;
  document.getElementById('viewDateModal').classList.add('active');
}

function openEditDateModal(eventId, event) {
  // Guard: only allow edit modal for published rows that are actually in edit mode
  if (currentEditingTable === 'published' && !rowsInEditMode.has(eventId)) {
    // Not in edit mode; fall back to view-only modal
    if (event?.date) {
      openViewDateModal(event.date);
    }
    return;
  }

  currentEditingEventId = eventId;
  currentEditingField = 'date';
  if (!currentEditingTable) currentEditingTable = 'published';

  // Parse the current date to populate the form
  const parsedDate = parseDateString(event.date);

  if (parsedDate) {
    // Format dates for input fields (YYYY-MM-DD)
    const startDateInput = document.getElementById('editStartDate');
    const startTimeInput = document.getElementById('editStartTime');
    const endTimeInput = document.getElementById('editEndTime');

    // Use start date for the single date field (both start and end use the same date)
    if (startDateInput && parsedDate.startDate) {
      const startDate = new Date(parsedDate.startDate);
      startDateInput.value = startDate.toISOString().split('T')[0];
    }

    if (startTimeInput && parsedDate.startTime) {
      startTimeInput.value = parsedDate.startTime.substring(0, 5); // HH:MM format
    }

    if (endTimeInput && parsedDate.endTime) {
      endTimeInput.value = parsedDate.endTime.substring(0, 5); // HH:MM format
    }
  }

  document.getElementById('editDateModal').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  currentEditingEventId = null;
  currentEditingField = null;
  currentEditingTable = null;
}

// ===== VIEW-ONLY MODAL FUNCTIONS =====

function openViewTitleModal(title) {
  document.getElementById('viewTitleText').textContent = title;
  document.getElementById('viewTitleModal').classList.add('active');
}

function openViewDescModal(description) {
  document.getElementById('viewDescText').textContent = description;
  document.getElementById('viewDescModal').classList.add('active');
}

function openViewLocationModal(location) {
  document.getElementById('viewLocationText').textContent = location;
  document.getElementById('viewLocationModal').classList.add('active');
}

function openViewCollegesModal(colleges, mainCollege) {
  const container = document.getElementById('viewCollegesList');
  container.innerHTML = '';

  colleges.forEach(collegeCode => {
    const college = availableColleges.find(c => c.code === collegeCode);
    if (!college) return;

    const tag = document.createElement('span');
    tag.className = `tag-item tag-item--college ${college.color === 'tup' ? 'tag-item--tup' : ''}`;
    tag.textContent = `${college.code} - ${college.name}`;

    // Mark main college
    if (collegeCode === mainCollege) {
      tag.style.fontWeight = 'bold';
      tag.innerHTML += ' <small>(Main)</small>';
    }

    container.appendChild(tag);
  });

  document.getElementById('viewCollegesModal').classList.add('active');
}

function openViewOrgsModal(organizations) {
  const container = document.getElementById('viewOrgsList');
  container.innerHTML = '';

  organizations.forEach((org, index) => {
    const tag = document.createElement('span');
    tag.className = 'tag-item tag-item--org';
    tag.textContent = org;

    // Mark first organization
    if (index === 0) {
      tag.style.fontWeight = 'bold';
      tag.innerHTML += ' <small>(Primary)</small>';
    }

    container.appendChild(tag);
  });

  document.getElementById('viewOrgsModal').classList.add('active');
}

// ===== SAVE FUNCTIONS =====

async function saveTitleEdit() {
  if (!currentEditingEventId || !currentEditingTable) {
    console.error('saveTitleEdit: Missing eventId or table - modal context lost');
    alert('Error: Event context lost. Please close and reopen the modal.');
    return;
  }
  const newTitle = document.getElementById('editTitleInput').value.trim();
  const featureCheckbox = document.getElementById('featureEventCheckbox');
  const isFeatured = featureCheckbox ? featureCheckbox.checked : false;

  if (!newTitle) {
    alert('Title cannot be empty');
    return;
  }

  const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
  const event = source[currentEditingEventId];

  if (!event) {
    alert('Event not found');
    return;
  }

  // Show loading cursor
  document.body.style.cursor = 'wait';

  try {
    // Update local data first (for immediate UI feedback)
    event.title = newTitle;
    event.isFeatured = isFeatured;

    // Save to Supabase if function available
    if (typeof updateEvent === 'function' && currentEditingTable === 'published') {
      const result = await updateEvent(currentEditingEventId, event);
      if (!result.success) {
        alert(`Error saving title: ${result.error}`);
        return;
      }
      if (result.event) Object.assign(event, result.event);
      rowsInEditMode.delete(currentEditingEventId);
    } else if (currentEditingTable === 'pending') {
      // For pending events: if we have a valid DB id, attempt to persist edits immediately.
      if (isValidUUID(event.id) && typeof updateEvent === 'function') {
        const result = await updateEvent(event.id, event);
        if (!result.success) {
          // Persist failed - keep local change and inform the user
          console.warn('Failed to persist pending edit:', result.error);
          alert(`Draft saved locally. Sync failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
      }
    }

    // Save table type BEFORE closing modal (closeModal clears it)
    const tableToRefresh = currentEditingTable;
    closeModal('editTitleModal');

    // Refresh table
    if (tableToRefresh === 'published') {
      populatePublishedEventsTable();
    } else {
      populatePendingEventsTable();
    }
  } finally {
    // Restore cursor
    document.body.style.cursor = '';
  }
}

async function saveDescEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;
  const newDesc = document.getElementById('editDescInput').value.trim();

  if (!newDesc) {
    alert('Description cannot be empty');
    return;
  }

  const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
  const event = source[currentEditingEventId];

  if (!event) {
    alert('Event not found');
    return;
  }

  // Show loading cursor
  document.body.style.cursor = 'wait';

  try {
    // Update local data
    event.description = newDesc;

    // Save to Supabase if function available
    if (typeof updateEvent === 'function' && currentEditingTable === 'published') {
      const result = await updateEvent(currentEditingEventId, event);
      if (!result.success) {
        alert(`Error saving description: ${result.error}`);
        return;
      }
      if (result.event) Object.assign(event, result.event);
      rowsInEditMode.delete(currentEditingEventId);
    } else if (currentEditingTable === 'pending') {
      if (isValidUUID(event.id) && typeof updateEvent === 'function') {
        const result = await updateEvent(event.id, event);
        if (!result.success) {
          console.warn('Failed to persist pending description edit:', result.error);
          alert(`Draft saved locally. Sync failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
      }
    }

    // Save table type BEFORE closing modal (closeModal clears it)
    const tableToRefresh = currentEditingTable;
    closeModal('editDescModal');

    // Refresh table
    if (tableToRefresh === 'published') {
      populatePublishedEventsTable();
    } else {
      populatePendingEventsTable();
    }
  } finally {
    // Restore cursor
    document.body.style.cursor = '';
  }
}

async function saveLocationEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;
  const newLocation = document.getElementById('editLocationInput').value.trim();

  if (!newLocation) {
    alert('Location cannot be empty');
    return;
  }

  const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
  const event = source[currentEditingEventId];

  if (!event) {
    alert('Event not found');
    return;
  }

  // Show loading cursor
  document.body.style.cursor = 'wait';

  try {
    // Update local data
    event.location = newLocation;

    // Save to Supabase if function available
    if (typeof updateEvent === 'function' && currentEditingTable === 'published') {
      const result = await updateEvent(currentEditingEventId, event);
      if (!result.success) {
        alert(`Error saving location: ${result.error}`);
        return;
      }
      if (result.event) Object.assign(event, result.event);
      rowsInEditMode.delete(currentEditingEventId);
    } else if (currentEditingTable === 'pending') {
      if (isValidUUID(event.id) && typeof updateEvent === 'function') {
        const result = await updateEvent(event.id, event);
        if (!result.success) {
          console.warn('Failed to persist pending location edit:', result.error);
          alert(`Draft saved locally. Sync failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
      }
    }

    // Save table type BEFORE closing modal (closeModal clears it)
    const tableToRefresh = currentEditingTable;
    closeModal('editLocationModal');

    // Refresh table
    if (tableToRefresh === 'published') {
      populatePublishedEventsTable();
    } else {
      populatePendingEventsTable();
    }
  } finally {
    // Restore cursor
    document.body.style.cursor = '';
  }
}

async function saveCollegeEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;

  // Get main college from dropdown
  const mainCollegeSelect = document.getElementById('mainCollegeSelect');
  if (!mainCollegeSelect) {
    alert('Main college dropdown not found');
    return;
  }

  const mainCollegeCode = mainCollegeSelect.value;
  if (!mainCollegeCode) {
    alert('Please select a main college');
    return;
  }

  const mainCollege = availableColleges.find(c => c.code === mainCollegeCode);
  if (!mainCollege) {
    alert('Invalid main college selection');
    return;
  }

  // Get collaboration colleges (checkboxes) - main college is already excluded from checkboxes
  const checked = document.querySelectorAll('#collegeTagSelector input[type="checkbox"]:checked');
  const colleges = Array.from(checked).map(cb => cb.value);

  // Always include main college in colleges array (at the beginning)
  if (!colleges.includes(mainCollegeCode)) {
    colleges.unshift(mainCollegeCode); // Add at the beginning
  }

  // Ensure colleges is always an array with at least the main college
  if (colleges.length === 0) {
    colleges.push(mainCollegeCode);
  }

  const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
  const event = source[currentEditingEventId];

  if (!event) {
    alert('Event not found');
    return;
  }

  // Show loading cursor
  document.body.style.cursor = 'wait';

  try {
    // Prepare update data (don't modify original event yet)
    const updateData = {
      ...event,
      colleges: colleges, // Array of all colleges
      mainCollege: mainCollegeCode, // Main college for card display
      college: mainCollegeCode, // Keep for backward compatibility
      collegeColor: mainCollege.color // Color for main college
    };

    // Save to Supabase if function available
    if (typeof updateEvent === 'function' && currentEditingTable === 'published') {
      const result = await updateEvent(currentEditingEventId, updateData);
      if (!result.success) {
        console.error('Failed to update college:', result.error);
        alert(`Error saving college: ${result.error}`);
        return;
      }
      // Only update local data if database save succeeded
      if (result.event) {
        Object.assign(event, result.event);
      } else {
        // Fallback: update local data with what we tried to save
        Object.assign(event, updateData);
      }
      rowsInEditMode.delete(currentEditingEventId);
    } else if (currentEditingTable === 'pending') {
      if (isValidUUID(event.id) && typeof updateEvent === 'function') {
        const result = await updateEvent(event.id, updateData);
        if (!result.success) {
          console.warn('Failed to persist pending college edit:', result.error);
          console.warn('Update data that failed:', {
            ...updateData,
            description: '[truncated]',
            colleges: updateData.colleges ? `[${updateData.colleges.length} colleges]` : 'none'
          });
          // Update local data even if database save failed (draft mode)
          Object.assign(event, updateData);
          alert(`Draft saved locally. Sync failed: ${result.error}`);
        } else {
          // Database save succeeded - use the returned event data
          if (result.event) {
            Object.assign(event, result.event);
          } else {
            Object.assign(event, updateData);
          }
        }
      } else {
        // No valid UUID or updateEvent not available - just update locally
        Object.assign(event, updateData);
      }
    } else {
      // No database save attempted - just update locally
      Object.assign(event, updateData);
    }

    // Save table type BEFORE closing modal (closeModal clears it)
    const tableToRefresh = currentEditingTable;
    closeModal('editCollegeModal');

    // Refresh table
    if (tableToRefresh === 'published') {
      populatePublishedEventsTable();
    } else {
      populatePendingEventsTable();
    }
  } catch (error) {
    console.error('Unexpected error in saveCollegeEdit:', error);
    alert(`An unexpected error occurred: ${error.message}`);
  } finally {
    // Restore cursor
    document.body.style.cursor = '';
  }
}

async function saveOrgEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;

  if (selectedOrganizationsOrder.length === 0) {
    alert('Please select at least one organization');
    return;
  }

  const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
  const event = source[currentEditingEventId];

  if (!event) {
    alert('Event not found');
    return;
  }

  // Show loading cursor
  document.body.style.cursor = 'wait';

  try {
    // Update local data with all selected organizations (in order)
    event.organizations = [...selectedOrganizationsOrder];
    // Keep organization (singular) for backward compatibility - use first selected
    event.organization = selectedOrganizationsOrder[0];

    // Save to Supabase if function available
    if (typeof updateEvent === 'function' && currentEditingTable === 'published') {
      const result = await updateEvent(currentEditingEventId, event);
      if (!result.success) {
        alert(`Error saving organizations: ${result.error}`);
        return;
      }
      if (result.event) Object.assign(event, result.event);
      rowsInEditMode.delete(currentEditingEventId);
    } else if (currentEditingTable === 'pending') {
      if (isValidUUID(event.id) && typeof updateEvent === 'function') {
        const result = await updateEvent(event.id, event);
        if (!result.success) {
          console.warn('Failed to persist pending organizations edit:', result.error);
          alert(`Draft saved locally. Sync failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
      }
    }

    // Save table type BEFORE closing modal (closeModal clears it)
    const tableToRefresh = currentEditingTable;
    closeModal('editOrgModal');

    // Refresh table
    if (tableToRefresh === 'published') {
      populatePublishedEventsTable();
    } else {
      populatePendingEventsTable();
    }
  } finally {
    // Restore cursor
    document.body.style.cursor = '';
  }
}

async function saveDateEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;

  const startDateInput = document.getElementById('editStartDate');
  const startTimeInput = document.getElementById('editStartTime');
  const endTimeInput = document.getElementById('editEndTime');

  if (!startDateInput || !startTimeInput || !endTimeInput) {
    alert('Please fill in all date and time fields');
    return;
  }

  const date = startDateInput.value;
  const startTime = startTimeInput.value;
  const endTime = endTimeInput.value;

  if (!date || !startTime || !endTime) {
    alert('Please fill in all date and time fields');
    return;
  }

  // Combine date and time into Date objects (using the same date for both start and end)
  const startDateTime = new Date(`${date}T${startTime}`);
  const endDateTime = new Date(`${date}T${endTime}`);

  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    alert('Invalid date or time format');
    return;
  }

  if (endDateTime < startDateTime) {
    alert('End time must be after start time');
    return;
  }

  // Show loading cursor
  document.body.style.cursor = 'wait';

  try {
    // Format the date string for display (using formatDateRangeForDisplay)
    const formattedDate = typeof formatDateRangeForDisplay !== 'undefined'
      ? formatDateRangeForDisplay(startDateTime, endDateTime)
      : `${date} ${startTime} - ${endTime}`;

    // Update the event data
    const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
    const event = source[currentEditingEventId];

    if (event) {
      // Update the date string
      event.date = formattedDate;

      // Update parsed date fields
      event.startDate = startDateTime;
      event.endDate = endDateTime;
      // Persist time (camelCase; DB mapping handled downstream)
      event.startTime = `${startTime}:00`;
      event.endTime = `${endTime}:00`;

      // Recalculate status from dates
      if (typeof calculateEventStatus !== 'undefined') {
        event.status = calculateEventStatus(startDateTime, endDateTime, event.status === 'Pending' ? 'Pending' : null);
      }

      // Persist published edits as well
      if (currentEditingTable === 'published' && typeof updateEvent === 'function') {
        const result = await updateEvent(currentEditingEventId, event);
        if (!result.success) {
          console.warn('Failed to persist published date edit:', result.error);
          alert(`Save failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
        rowsInEditMode.delete(currentEditingEventId);
      } else if (currentEditingTable === 'pending') {
        // Persist pending date edits if possible
        if (isValidUUID(event.id) && typeof updateEvent === 'function') {
          const result = await updateEvent(event.id, event);
          if (!result.success) {
            console.warn('Failed to persist pending date edit:', result.error);
            alert(`Draft saved locally. Sync failed: ${result.error}`);
          } else if (result.event) {
            Object.assign(event, result.event);
          }
        }
      }
    }

    // Save table type BEFORE closing modal (closeModal clears it)
    const tableToRefresh = currentEditingTable;
    closeModal('editDateModal');

    // Refresh the table
    if (tableToRefresh === 'published') {
      populatePublishedEventsTable();
    } else {
      populatePendingEventsTable();
    }
  } catch (error) {
    console.error('Error saving date edit:', error);
    alert('Failed to save date changes. Please try again.');
  } finally {
    // Restore cursor
    document.body.style.cursor = '';
  }
}

// ===== IMAGES MANAGEMENT =====
let currentEditingImages = [];
let currentThumbnailIndex = 0;

function openImagesModal(eventId, event) {
  currentEditingEventId = eventId;
  if (!currentEditingTable) currentEditingTable = 'published';

  // Check if in edit mode (for published events only)
  const isEditMode = currentEditingTable === 'published'
    ? rowsInEditMode.has(eventId)
    : true; // Pending events are always editable

  // Initialize images array (use event.images or default to universityLogo as example only)
  // Only show default logo if there are no real images uploaded
  currentEditingImages = event.images && event.images.length > 0
    ? [...event.images]
    : []; // Start with empty array - default logo is just for display, not in editing array

  // Get thumbnail index (first image is thumbnail by default, or check if there's a thumbnailIndex property)
  currentThumbnailIndex = event.thumbnailIndex !== undefined ? event.thumbnailIndex : 0;

  // Ensure thumbnail index is valid
  if (currentThumbnailIndex >= currentEditingImages.length) {
    currentThumbnailIndex = 0;
  }

  // Update modal title based on edit mode
  const modalTitle = document.querySelector('#imagesModal .admin-modal-header h2');
  if (modalTitle) {
    modalTitle.textContent = isEditMode ? 'Manage Event Images' : 'Event Images';
  }

  // Show/hide upload section and action buttons based on edit mode
  const uploadSection = document.querySelector('.images-upload-section');
  const actionButtons = document.querySelector('#imagesModal .admin-modal-actions');

  if (uploadSection) {
    uploadSection.style.display = isEditMode ? 'block' : 'none';
  }

  if (actionButtons) {
    // Hide Cancel/Save buttons in view mode, show Close button instead
    if (!isEditMode) {
      // Remove existing buttons
      actionButtons.innerHTML = '';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'admin-btn admin-btn--cancel';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', () => closeModal('imagesModal'));
      actionButtons.appendChild(closeBtn);
    } else {
      // Restore Cancel/Save buttons
      actionButtons.innerHTML = '';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'admin-btn admin-btn--cancel';
      cancelBtn.id = 'cancelImagesEdit';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => closeModal('imagesModal'));

      const saveBtn = document.createElement('button');
      saveBtn.className = 'admin-btn admin-btn--save';
      saveBtn.id = 'saveImagesEdit';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', saveImagesEdit);

      actionButtons.appendChild(cancelBtn);
      actionButtons.appendChild(saveBtn);
    }
  }

  renderImagesGallery(isEditMode);
  document.getElementById('imagesModal').classList.add('active');
}

function renderImagesGallery(isEditMode = true) {
  const gallery = document.getElementById('imagesGallery');
  if (!gallery) return;

  gallery.innerHTML = '';

  // Show example image if no real images uploaded (only in edit mode)
  if (currentEditingImages.length === 0 && isEditMode) {
    const exampleItem = document.createElement('div');
    exampleItem.className = 'image-item';
    exampleItem.style.opacity = '0.6';

    const exampleWrapper = document.createElement('div');
    exampleWrapper.className = 'image-wrapper';

    const exampleImg = document.createElement('img');
    const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
    const event = source[currentEditingEventId];
    exampleImg.src = event?.universityLogo || 'images/tup.png';
    exampleImg.alt = 'Example image';
    exampleImg.style.opacity = '0.5';

    const exampleLabel = document.createElement('div');
    exampleLabel.style.position = 'absolute';
    exampleLabel.style.top = '50%';
    exampleLabel.style.left = '50%';
    exampleLabel.style.transform = 'translate(-50%, -50%)';
    exampleLabel.style.background = 'rgba(0, 0, 0, 0.7)';
    exampleLabel.style.color = 'white';
    exampleLabel.style.padding = '8px 16px';
    exampleLabel.style.borderRadius = '4px';
    exampleLabel.style.fontSize = '0.85rem';
    exampleLabel.style.fontWeight = '600';
    exampleLabel.style.zIndex = '10';
    exampleLabel.textContent = 'Example - Upload images to replace';

    exampleWrapper.appendChild(exampleImg);
    exampleWrapper.appendChild(exampleLabel);
    exampleItem.appendChild(exampleWrapper);
    gallery.appendChild(exampleItem);
    return;
  }

  if (currentEditingImages.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'images-empty-message';
    emptyMsg.textContent = 'No images available.';
    gallery.appendChild(emptyMsg);
    return;
  }

  currentEditingImages.forEach((imageUrl, index) => {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    if (index === currentThumbnailIndex) {
      imageItem.classList.add('image-item--thumbnail');
    }

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'image-wrapper';

    // Make image clickable to view larger (both modes)
    imageWrapper.style.cursor = 'pointer';
    imageWrapper.addEventListener('click', (e) => {
      // Only open in new tab if not clicking on action buttons
      if (!e.target.closest('.image-actions')) {
        window.open(imageUrl, '_blank');
      }
    });

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `Event image ${index + 1}`;
    img.onerror = function () {
      this.src = 'images/tup.png';
    };

    // Only show overlay and actions in edit mode
    if (isEditMode) {
      const overlay = document.createElement('div');
      overlay.className = 'image-overlay';

      const thumbnailBadge = document.createElement('div');
      thumbnailBadge.className = 'thumbnail-badge';
      thumbnailBadge.textContent = 'Thumbnail';
      thumbnailBadge.style.display = index === currentThumbnailIndex ? 'block' : 'none';

      const actions = document.createElement('div');
      actions.className = 'image-actions';

      const setThumbnailBtn = document.createElement('button');
      setThumbnailBtn.className = 'image-action-btn';
      setThumbnailBtn.textContent = index === currentThumbnailIndex ? '✓ Thumbnail' : 'Set as Thumbnail';
      setThumbnailBtn.disabled = index === currentThumbnailIndex;
      setThumbnailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setThumbnail(index);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'image-action-btn image-action-btn--delete';
      deleteBtn.title = 'Delete image';
      deleteBtn.innerHTML = '✕ Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteImage(index);
      });

      actions.appendChild(setThumbnailBtn);
      actions.appendChild(deleteBtn);

      overlay.appendChild(thumbnailBadge);
      overlay.appendChild(actions);

      imageWrapper.appendChild(overlay);
    } else {
      // View mode: just show thumbnail badge if it's the thumbnail
      if (index === currentThumbnailIndex) {
        const thumbnailBadge = document.createElement('div');
        thumbnailBadge.className = 'thumbnail-badge';
        thumbnailBadge.textContent = 'Thumbnail';
        thumbnailBadge.style.position = 'absolute';
        thumbnailBadge.style.top = '10px';
        thumbnailBadge.style.left = '10px';
        thumbnailBadge.style.zIndex = '2';
        imageWrapper.appendChild(thumbnailBadge);
      }
    }

    imageWrapper.appendChild(img);
    imageItem.appendChild(imageWrapper);

    gallery.appendChild(imageItem);
  });
}

function setThumbnail(index) {
  if (index >= 0 && index < currentEditingImages.length) {
    currentThumbnailIndex = index;
    // Re-render with edit mode (always true when this function is called)
    renderImagesGallery(true);
  }
}

function deleteImage(index) {
  if (confirm('Are you sure you want to delete this image?')) {
    currentEditingImages.splice(index, 1);

    // If no images left, reset to empty array (will show example image)
    if (currentEditingImages.length === 0) {
      currentThumbnailIndex = 0;
    } else {
      // Adjust thumbnail index if needed
      if (currentThumbnailIndex >= currentEditingImages.length) {
        currentThumbnailIndex = Math.max(0, currentEditingImages.length - 1);
      } else if (currentThumbnailIndex > index) {
        currentThumbnailIndex--;
      }
    }

    // Re-render with edit mode (always true when this function is called)
    renderImagesGallery(true);
  }
}

async function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  const errorDiv = document.getElementById('imageUploadError');

  // Validate file count
  const totalImages = currentEditingImages.length + files.length;
  if (totalImages > 5) {
    errorDiv.textContent = `You can only upload up to 5 images. Currently have ${currentEditingImages.length}, trying to add ${files.length}.`;
    errorDiv.style.display = 'block';
    event.target.value = ''; // Reset input
    return;
  }

  // Validate file types
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const invalidFiles = files.filter(file => !validTypes.includes(file.type));

  if (invalidFiles.length > 0) {
    errorDiv.textContent = `Invalid file type(s). Only JPG and PNG files are allowed.`;
    errorDiv.style.display = 'block';
    event.target.value = ''; // Reset input
    return;
  }

  // Hide error if validation passes
  errorDiv.style.display = 'none';

  // Show loading state
  errorDiv.textContent = 'Uploading images...';
  errorDiv.style.display = 'block';
  errorDiv.style.color = '#666';

  // Upload files to Supabase Storage
  if (typeof uploadEventImages === 'function' && currentEditingEventId) {
    try {
      const uploadResult = await uploadEventImages(files, currentEditingEventId);

      if (uploadResult.success && uploadResult.urls.length > 0) {
        // Remove default logo if it exists (it's just an example)
        const defaultLogo = 'images/tup.png';
        currentEditingImages = currentEditingImages.filter(img => img !== defaultLogo);

        // Add uploaded URLs to current editing images
        currentEditingImages.push(...uploadResult.urls);

        // If this is the first real image, set it as thumbnail
        if (currentEditingImages.length === uploadResult.urls.length) {
          currentThumbnailIndex = 0;
        }

        errorDiv.style.display = 'none';
        renderImagesGallery(true);
      } else {
        // Show errors
        const errorMsg = uploadResult.errors && uploadResult.errors.length > 0
          ? uploadResult.errors.join('; ')
          : 'Failed to upload images. Please try again.';
        errorDiv.textContent = errorMsg;
        errorDiv.style.color = '#B81E20';
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      errorDiv.textContent = `Error uploading images: ${error.message}`;
      errorDiv.style.color = '#B81E20';
      errorDiv.style.display = 'block';
    }
  } else {
    // Fallback: use FileReader if Supabase not available (for development)
    console.warn('Supabase Storage not available, using FileReader fallback');
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target.result;
        // Remove default logo if it exists (it's just an example)
        const defaultLogo = 'images/tup.png';
        currentEditingImages = currentEditingImages.filter(img => img !== defaultLogo);

        currentEditingImages.push(imageUrl);
        if (currentEditingImages.length === 1) {
          currentThumbnailIndex = 0;
        }
        renderImagesGallery(true);
      };
      reader.onerror = () => {
        errorDiv.textContent = 'Error reading file. Please try again.';
        errorDiv.style.color = '#B81E20';
        errorDiv.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }

  // Reset input
  event.target.value = '';
}

async function saveImagesEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;

  // Show loading cursor
  document.body.style.cursor = 'wait';

  try {
    // Ensure thumbnail index is valid
    if (currentThumbnailIndex >= currentEditingImages.length) {
      currentThumbnailIndex = 0;
    }

    // Don't add default logo - if no images, save empty array
    // The default logo is only for display purposes as an example

    // Update event in Supabase if functions are available
    if (typeof updateEvent === 'function') {
      if (currentEditingTable === 'published') {
        const source = eventsData;
        const event = source[currentEditingEventId];

        if (event) {
          // Update event with new images and thumbnail index
          // Include saveImages flag to explicitly save images
          const updatedEvent = {
            ...event,
            images: [...currentEditingImages],
            thumbnailIndex: currentThumbnailIndex,
            saveImages: true  // Flag to tell updateEvent to save images
          };

          const result = await updateEvent(currentEditingEventId, updatedEvent);

          if (result.success) {
            // Update local data
            event.images = [...currentEditingImages];
            event.thumbnailIndex = currentThumbnailIndex;
          } else {
            alert(`Error saving images: ${result.error}`);
            return;
          }
        }
      } else {
        // For pending events: persist images to event_images table immediately (so they survive reloads)
        const source = pendingEventsData;
        const event = source[currentEditingEventId];

        if (event && isValidUUID(currentEditingEventId) && typeof saveEventImages === 'function') {
          // Attempt to persist images to database
          const saveResult = await saveEventImages(currentEditingEventId, currentEditingImages, currentThumbnailIndex);
          if (!saveResult.success) {
            console.warn('Failed to persist pending images:', saveResult.error);
            // Still update local copy for UI consistency
          }
        }

        // Update local data
        if (event) {
          event.images = [...currentEditingImages];
          event.thumbnailIndex = currentThumbnailIndex;
        }
      }
    } else {
      // Fallback: update local data only (for development)
      const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
      const event = source[currentEditingEventId];

      if (event) {
        event.images = [...currentEditingImages];
        event.thumbnailIndex = currentThumbnailIndex;
      }
    }

    // Save table type BEFORE closing modal (closeModal clears it)
    const tableToRefresh = currentEditingTable;
    closeModal('imagesModal');

    // Refresh the table
    if (tableToRefresh === 'published') {
      populatePublishedEventsTable();
    } else {
      populatePendingEventsTable();
    }
  } finally {
    // Restore cursor
    document.body.style.cursor = '';
  }
}

async function addNewOrganization() {
  const input = document.getElementById('newOrgInput');
  const newOrg = input.value.trim();

  if (!newOrg) {
    alert('Please enter an organization name');
    return;
  }

  if (availableOrganizations.includes(newOrg)) {
    alert('This organization already exists');
    input.value = '';
    return;
  }

  // Show loading state
  const addBtn = document.getElementById('addNewOrgBtn');
  const originalBtnText = addBtn.textContent;
  addBtn.textContent = 'Adding...';
  addBtn.disabled = true;

  try {
    // Save to database if function available
    if (typeof createOrganization === 'function') {
      const result = await createOrganization(newOrg);

      if (!result.success) {
        alert(`Error adding organization: ${result.error}`);
        return;
      }

      // Add to cache
      if (result.organization) {
        organizationsCache[result.organization.id] = result.organization;
      }

      console.log('Organization created successfully:', newOrg);
    }

    // Add to local array
    availableOrganizations.push(newOrg);
    input.value = '';

    // Reopen modal to show new org (and auto-select it)
    const eventId = currentEditingEventId;
    openEditOrgModal(eventId, newOrg);

  } catch (error) {
    console.error('Error adding organization:', error);
    alert(`Error adding organization: ${error.message}`);
  } finally {
    // Restore button state
    addBtn.textContent = originalBtnText;
    addBtn.disabled = false;
  }
}

// ===== FLAGGED COMMENTS MANAGEMENT =====

/**
 * Load flagged comments directly from comments table
 * Uses direct fetch API (no RPC, no blocking) - same pattern as events
 * Admin verification is already done by admin-init.js
 */

async function loadFlaggedComments() {
  const loadingDiv = document.getElementById('flaggedCommentsLoading');
  const tableEl = document.getElementById('flaggedCommentsTable');
  const tbody = document.getElementById('flaggedCommentsTableBody');
  const emptyDiv = document.getElementById('flaggedCommentsEmpty');
  const section = document.getElementById('flaggedCommentsSection');

  if (!tbody) return;

  // Show loading
  if (loadingDiv) loadingDiv.style.display = 'block';
  if (tableEl) tableEl.style.display = 'none';
  if (emptyDiv) emptyDiv.style.display = 'none';

  try {
    const SUPABASE_URL = window.__EH_SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured for flagged comments');
      if (loadingDiv) loadingDiv.textContent = 'Supabase not configured';
      return;
    }

    // Get auth token for authenticated request
    let accessToken = null;
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      (key.includes('supabase') && key.includes('auth-token')) ||
      (key.startsWith('sb-') && key.includes('auth-token'))
    );
    if (supabaseAuthKeys.length > 0) {
      const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
      accessToken = authData?.access_token;
    }

    // Direct fetch from comments table with flag_count >= 3
    // Simple query without joins - PostgREST embedded resources can fail without proper FK setup
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?flag_count=gte.1&select=id,content,user_id,event_id,flag_count,created_at&order=flag_count.desc,created_at.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': accessToken ? `Bearer ${accessToken}` : undefined,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flagged comments fetch error:', response.status, errorText);
      if (loadingDiv) loadingDiv.textContent = `Error: ${response.status}`;
      return;
    }

    const comments = await response.json();

    // Hide loading
    if (loadingDiv) loadingDiv.style.display = 'none';

    if (!comments || comments.length === 0) {
      if (emptyDiv) emptyDiv.style.display = 'block';
      if (section) section.style.display = 'block';
      return;
    }

    // Fetch usernames and event titles in batch (parallel)
    const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
    const eventIds = [...new Set(comments.map(c => c.event_id).filter(Boolean))];

    const profilesMap = {};
    const eventsMap = {};

    // Fetch profiles
    if (userIds.length > 0) {
      try {
        const userIdsParam = userIds.map(id => `"${id}"`).join(',');
        const profilesRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=in.(${userIdsParam})&select=id,username`,
          {
            method: 'GET',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
          }
        );
        if (profilesRes.ok) {
          const profiles = await profilesRes.json();
          profiles.forEach(p => { profilesMap[p.id] = p.username; });
        }
      } catch (e) { console.warn('Failed to fetch profiles:', e); }
    }

    // Fetch events
    if (eventIds.length > 0) {
      try {
        const eventIdsParam = eventIds.map(id => `"${id}"`).join(',');
        const eventsRes = await fetch(
          `${SUPABASE_URL}/rest/v1/events?id=in.(${eventIdsParam})&select=id,title`,
          {
            method: 'GET',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
          }
        );
        if (eventsRes.ok) {
          const events = await eventsRes.json();
          events.forEach(e => { eventsMap[e.id] = e.title; });
        }
      } catch (e) { console.warn('Failed to fetch events:', e); }
    }

    // Show section and table
    if (section) section.style.display = 'block';
    if (tableEl) tableEl.style.display = 'table';
    tbody.innerHTML = '';

    comments.forEach(comment => {
      const row = document.createElement('tr');

      // Truncate comment text
      const truncatedText = comment.content && comment.content.length > 100
        ? comment.content.substring(0, 100) + '...'
        : (comment.content || '[No content]');

      // Get username and event title from separate fetches
      const authorUsername = profilesMap[comment.user_id] || 'Unknown';
      const eventTitle = eventsMap[comment.event_id] || 'Unknown Event';

      // Check if comment is truncated (needs modal)
      const isTruncated = comment.content && comment.content.length > 100;
      const clickableStyle = isTruncated ? 'cursor: pointer; text-decoration: underline; text-decoration-style: dotted;' : '';
      const clickableAttr = isTruncated ? `onclick="showCommentPreview('${comment.id}', '${escapeHtml(comment.content || '').replace(/'/g, "\\'")}', this)"` : '';

      row.innerHTML = `
        <td class="flagged-comment-text" title="${isTruncated ? 'Click to view full comment' : ''}" style="${clickableStyle}" ${clickableAttr} data-comment-id="${comment.id}" data-full-content="${escapeHtml(comment.content || '')}">${escapeHtml(truncatedText)}</td>
        <td>
          <a href="eventhive-profile.html?uid=${comment.user_id}" class="flagged-author-link" target="_blank">
            ${escapeHtml(authorUsername)}
          </a>
        </td>
        <td>
          <a href="eventhive-events.html?event=${comment.event_id}" class="flagged-event-link" target="_blank">
            ${escapeHtml(eventTitle)}
          </a>
        </td>
        <td>
          <span class="flag-count-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.3"/>
              <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>
            </svg>
            ${comment.flag_count}
          </span>
        </td>
        <td>
          <button class="delete-flagged-btn" onclick="deleteFlaggedComment('${comment.id}')">
            Delete
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });


  } catch (error) {
    console.warn('Flagged comments not available:', error.message);
    // Show empty state instead of hiding section
    if (loadingDiv) loadingDiv.style.display = 'none';
    if (emptyDiv) {
      emptyDiv.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.3; margin-bottom: 10px;">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>Could not load flagged comments.</p>
      `;
      emptyDiv.style.display = 'block';
    }
  }
}



// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function deleteFlaggedComment(commentId) {
  if (!confirm('Are you sure you want to permanently delete this comment? This action cannot be undone.')) {
    return;
  }

  try {
    const SUPABASE_URL = window.__EH_SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.__EH_SUPABASE_ANON_KEY;

    // Get auth token
    let accessToken = null;
    const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
      (key.includes('supabase') && key.includes('auth-token')) ||
      (key.startsWith('sb-') && key.includes('auth-token'))
    );
    if (supabaseAuthKeys.length > 0) {
      const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
      accessToken = authData?.access_token;
    }

    if (!accessToken) {
      alert('Authentication required');
      return;
    }

    // Direct DELETE to comments table (admin-init.js already verified admin status)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Delete failed: ${response.status} - ${errorText}`);
    }

    alert('Comment deleted successfully.');

    // Reload the table
    await loadFlaggedComments();

  } catch (error) {
    console.error('Error deleting flagged comment:', error);
    alert(`Error deleting comment: ${error.message}`);
  }
}


// ===== EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', async function () {
  console.log('=== eventhive-admin.js DOMContentLoaded START ===');

  // Load organizations from database first
  await loadOrganizationsFromDatabase();
  console.log('Organizations loaded, setting up event listeners...');

  // Then populate tables
  populatePublishedEventsTable();
  populatePendingEventsTable();

  // Load flagged comments
  loadFlaggedComments();

  // View Title Modal
  document.getElementById('closeViewTitleModal')?.addEventListener('click', () => closeModal('viewTitleModal'));
  document.getElementById('closeViewTitleBtn')?.addEventListener('click', () => closeModal('viewTitleModal'));

  // View Description Modal
  document.getElementById('closeViewDescModal')?.addEventListener('click', () => closeModal('viewDescModal'));
  document.getElementById('closeViewDescBtn')?.addEventListener('click', () => closeModal('viewDescModal'));

  // View Location Modal
  document.getElementById('closeViewLocationModal')?.addEventListener('click', () => closeModal('viewLocationModal'));
  document.getElementById('closeViewLocationBtn')?.addEventListener('click', () => closeModal('viewLocationModal'));

  // View Date Modal
  document.getElementById('closeViewDateModal')?.addEventListener('click', () => closeModal('viewDateModal'));
  document.getElementById('closeViewDateBtn')?.addEventListener('click', () => closeModal('viewDateModal'));

  // View Colleges Modal
  document.getElementById('closeViewCollegesModal')?.addEventListener('click', () => closeModal('viewCollegesModal'));
  document.getElementById('closeViewCollegesBtn')?.addEventListener('click', () => closeModal('viewCollegesModal'));

  // View Organizations Modal
  document.getElementById('closeViewOrgsModal')?.addEventListener('click', () => closeModal('viewOrgsModal'));
  document.getElementById('closeViewOrgsBtn')?.addEventListener('click', () => closeModal('viewOrgsModal'));

  // Title Modal
  document.getElementById('closeTitleModal')?.addEventListener('click', () => closeModal('editTitleModal'));
  document.getElementById('cancelTitleEdit')?.addEventListener('click', () => closeModal('editTitleModal'));
  document.getElementById('saveTitleEdit')?.addEventListener('click', () => saveTitleEdit());

  // Description Modal
  document.getElementById('closeDescModal')?.addEventListener('click', () => closeModal('editDescModal'));
  document.getElementById('cancelDescEdit')?.addEventListener('click', () => closeModal('editDescModal'));
  document.getElementById('saveDescEdit')?.addEventListener('click', saveDescEdit);

  // Location Modal
  document.getElementById('closeLocationModal')?.addEventListener('click', () => closeModal('editLocationModal'));
  document.getElementById('cancelLocationEdit')?.addEventListener('click', () => closeModal('editLocationModal'));
  document.getElementById('saveLocationEdit')?.addEventListener('click', saveLocationEdit);

  // Date Modal
  document.getElementById('closeDateModal')?.addEventListener('click', () => closeModal('editDateModal'));
  document.getElementById('cancelDateEdit')?.addEventListener('click', () => closeModal('editDateModal'));
  document.getElementById('saveDateEdit')?.addEventListener('click', saveDateEdit);

  // Images Modal
  document.getElementById('closeImagesModal')?.addEventListener('click', () => closeModal('imagesModal'));
  document.getElementById('cancelImagesEdit')?.addEventListener('click', () => closeModal('imagesModal'));
  document.getElementById('saveImagesEdit')?.addEventListener('click', saveImagesEdit);
  const imageUploadInput = document.getElementById('imageUploadInput');
  if (imageUploadInput) {
    imageUploadInput.addEventListener('change', handleImageUpload);
  }
  const imageUploadLabel = document.querySelector('.image-upload-label');
  if (imageUploadLabel && imageUploadInput) {
    imageUploadLabel.addEventListener('click', (e) => {
      e.preventDefault();
      imageUploadInput.click();
    });
  }

  // College Modal
  document.getElementById('closeCollegeModal')?.addEventListener('click', () => closeModal('editCollegeModal'));
  document.getElementById('cancelCollegeEdit')?.addEventListener('click', () => closeModal('editCollegeModal'));
  document.getElementById('saveCollegeEdit')?.addEventListener('click', saveCollegeEdit);

  // Organization Modal
  document.getElementById('closeOrgModal')?.addEventListener('click', () => closeModal('editOrgModal'));
  document.getElementById('cancelOrgEdit')?.addEventListener('click', () => closeModal('editOrgModal'));
  document.getElementById('saveOrgEdit')?.addEventListener('click', saveOrgEdit);
  document.getElementById('addNewOrgBtn')?.addEventListener('click', addNewOrganization);

  // Close modals on overlay click
  document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) {
        const modalId = this.id;
        closeModal(modalId);
      }
    });
  });

  // Enter key to add new organization
  document.getElementById('newOrgInput')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      addNewOrganization();
    }
  });

  console.log('=== eventhive-admin.js DOMContentLoaded COMPLETE ===');
});

// ============================================
// Comment Preview Modal Functions
// ============================================

let currentPreviewCommentId = null;

/**
 * Show the comment preview modal with full comment text
 * @param {string} commentId - The comment ID
 * @param {string} fullContent - The full comment content 
 * @param {HTMLElement} element - The clicked element (to get data if needed)
 */
function showCommentPreview(commentId, fullContent, element) {
  const modal = document.getElementById('commentPreviewModal');
  const contentDiv = document.getElementById('commentPreviewContent');
  const deleteBtn = document.getElementById('commentPreviewDeleteBtn');

  if (!modal || !contentDiv) return;

  // Get full content from data attribute if available (more reliable)
  const actualContent = element?.dataset?.fullContent || fullContent || '[No content]';

  // Decode HTML entities
  const decodedContent = decodeHtmlEntities(actualContent);

  currentPreviewCommentId = commentId;
  contentDiv.textContent = decodedContent;

  // Set up delete button (no confirm needed - deleteFlaggedComment handles it)
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      await deleteFlaggedComment(commentId);
      closeCommentPreviewModal();
    };
  }

  modal.classList.add('active');
}

/**
 * Close the comment preview modal
 */
function closeCommentPreviewModal() {
  const modal = document.getElementById('commentPreviewModal');
  if (modal) {
    modal.classList.remove('active');
    currentPreviewCommentId = null;
  }
}

/**
 * Decode HTML entities back to their original characters
 */
function decodeHtmlEntities(text) {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}
