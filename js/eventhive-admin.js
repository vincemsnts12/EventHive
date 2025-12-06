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

// Available organizations (will be expanded from database)
let availableOrganizations = [
  'AWS Learning Club - TUP Manila',
  'Google Developer Groups on Campus TUP Manila',
  'TUP USG Manila',
  'TUP CAFA Student Council',
  'TUP Arts Society',
  'TUP Entrepreneurship Club'
];

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
  
  const sortedEvents = sortEvents(eventsData);
  
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
    
    // College Tags
    const collegeCell = document.createElement('td');
    collegeCell.className = 'tags-cell';
    collegeCell.setAttribute('data-label', 'College');
    const collegeContainer = document.createElement('div');
    collegeContainer.className = 'tags-container';
    const collegeTag = document.createElement('span');
    collegeTag.className = `tag-item tag-item--college ${event.collegeColor === 'tup' ? 'tag-item--tup' : ''}`;
    collegeTag.textContent = event.college;
    collegeTag.setAttribute('data-event-id', eventId);
    collegeTag.addEventListener('click', () => {
      if (rowsInEditMode.has(eventId)) {
        currentEditingTable = 'published';
        openEditCollegeModal(eventId, event.college);
      }
    });
    collegeContainer.appendChild(collegeTag);
    row.appendChild(collegeCell);
    collegeCell.appendChild(collegeContainer);
    
    // Organization Tags
    const orgCell = document.createElement('td');
    orgCell.className = 'tags-cell';
    orgCell.setAttribute('data-label', 'Organization');
    const orgContainer = document.createElement('div');
    orgContainer.className = 'tags-container';
    const orgTag = document.createElement('span');
    orgTag.className = 'tag-item tag-item--org';
    orgTag.textContent = event.organization;
    orgTag.setAttribute('data-event-id', eventId);
    orgTag.addEventListener('click', () => {
      if (rowsInEditMode.has(eventId)) {
        currentEditingTable = 'published';
        openEditOrgModal(eventId, event.organization);
      }
    });
    orgContainer.appendChild(orgTag);
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
// Counts events that still have default values (not yet edited)
function countUneditedEvents() {
  let count = 0;
  for (const eventId in pendingEventsData) {
    const event = pendingEventsData[eventId];
    // Check if event has default values (unedited)
    if (event.title === 'Add Title' || event.description === 'Add Description') {
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

  // Create new event with default values (matching old implementation structure)
  const newEvent = {
    title: 'Add Title',
    description: 'Add Description',
    location: 'Add Location',
    date: todayDate,
    status: 'Pending',
    isFeatured: false,
    likes: 0,
    college: 'TUP',
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
    // Create event directly in database
    const result = await createEvent(newEvent);
    
    // Restore cursor
    document.body.style.cursor = '';
    if (addRow) {
      addRow.style.opacity = '1';
      addRow.style.pointerEvents = 'auto';
    }

    if (result.success && result.event && result.event.id) {
      // Add event to pendingEventsData with DB ID
      pendingEventsData[result.event.id] = result.event;
      
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
      const errorMsg = result.error || 'Unknown error';
      console.error('Failed to create event:', errorMsg);
      console.error('Event data that failed:', newEvent);
      alert('An error has occurred, a new event was not created.');
    }
  } catch (error) {
    // Restore cursor on error
    document.body.style.cursor = '';
    if (addRow) {
      addRow.style.opacity = '1';
      addRow.style.pointerEvents = 'auto';
    }
    
    // Show error message with details
    console.error('Error creating event:', error);
    console.error('Event data that failed:', newEvent);
    alert('An error has occurred, a new event was not created.');
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
    
    // College Tags
    const collegeCell = document.createElement('td');
    collegeCell.className = 'tags-cell';
    collegeCell.setAttribute('data-label', 'College');
    const collegeContainer = document.createElement('div');
    collegeContainer.className = 'tags-container';
    const collegeTag = document.createElement('span');
    collegeTag.className = `tag-item tag-item--college ${event.collegeColor === 'tup' ? 'tag-item--tup' : ''}`;
    collegeTag.textContent = event.college;
    collegeTag.setAttribute('data-event-id', eventId);
    collegeTag.addEventListener('click', () => {
      currentEditingTable = 'pending';
      openEditCollegeModal(eventId, event.college);
    });
    collegeContainer.appendChild(collegeTag);
    row.appendChild(collegeCell);
    collegeCell.appendChild(collegeContainer);
    
    // Organization Tags
    const orgCell = document.createElement('td');
    orgCell.className = 'tags-cell';
    orgCell.setAttribute('data-label', 'Organization');
    const orgContainer = document.createElement('div');
    orgContainer.className = 'tags-container';
    const orgTag = document.createElement('span');
    orgTag.className = 'tag-item tag-item--org';
    orgTag.textContent = event.organization;
    orgTag.setAttribute('data-event-id', eventId);
    orgTag.addEventListener('click', () => {
      currentEditingTable = 'pending';
      openEditOrgModal(eventId, event.organization);
    });
    orgContainer.appendChild(orgTag);
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
  if (typeof createEvent === 'function' && typeof approveEvent === 'function') {
    // First, create the event in the database using existing backend function.
    // createEvent expects frontend-style event data; pendingEvent already holds that shape.
    const createResult = await createEvent(pendingEvent);
    if (!createResult.success) {
      alert(`Error creating event: ${createResult.error}`);
      return;
    }

    // createResult.event contains the inserted event (still pending)
    const createdEvent = createResult.event;
    if (!createdEvent || !createdEvent.id) {
      alert('Error: created event missing id');
      return;
    }

    // Now approve the newly created event (this will set approved_at, approved_by, and status)
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
  
  const selector = document.getElementById('collegeTagSelector');
  selector.innerHTML = '';
  
  availableColleges.forEach(college => {
    const item = document.createElement('div');
    item.className = 'tag-checkbox-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `college-${college.code}`;
    checkbox.value = college.code;
    checkbox.checked = currentCollege === college.code;
    
    const label = document.createElement('label');
    label.setAttribute('for', `college-${college.code}`);
    label.textContent = college.name;
    
    item.appendChild(checkbox);
    item.appendChild(label);
    selector.appendChild(item);
  });
  
  document.getElementById('editCollegeModal').classList.add('active');
}

function openEditOrgModal(eventId, currentOrg) {
  currentEditingEventId = eventId;
  currentEditingField = 'organization';
  if (!currentEditingTable) currentEditingTable = 'published';
  
  const selector = document.getElementById('orgTagSelector');
  selector.innerHTML = '';
  
  availableOrganizations.forEach(org => {
    const item = document.createElement('div');
    item.className = 'tag-checkbox-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `org-${org.replace(/\s+/g, '-')}`;
    checkbox.value = org;
    checkbox.checked = currentOrg === org;
    
    const label = document.createElement('label');
    label.setAttribute('for', `org-${org.replace(/\s+/g, '-')}`);
    label.textContent = org;
    
    item.appendChild(checkbox);
    item.appendChild(label);
    selector.appendChild(item);
  });
  
  document.getElementById('editOrgModal').classList.add('active');
}

function openViewDateModal(dateString) {
  document.getElementById('viewDateText').textContent = dateString;
  document.getElementById('viewDateModal').classList.add('active');
}

function openEditDateModal(eventId, event) {
  currentEditingEventId = eventId;
  currentEditingField = 'date';
  if (!currentEditingTable) currentEditingTable = 'published';
  
  // Parse the current date to populate the form
  const parsedDate = parseDateString(event.date);
  
  if (parsedDate) {
    // Format dates for input fields (YYYY-MM-DD)
    const startDateInput = document.getElementById('editStartDate');
    const startTimeInput = document.getElementById('editStartTime');
    const endDateInput = document.getElementById('editEndDate');
    const endTimeInput = document.getElementById('editEndTime');
    
    if (startDateInput && parsedDate.startDate) {
      const startDate = new Date(parsedDate.startDate);
      startDateInput.value = startDate.toISOString().split('T')[0];
    }
    
    if (startTimeInput && parsedDate.startTime) {
      startTimeInput.value = parsedDate.startTime.substring(0, 5); // HH:MM format
    }
    
    if (endDateInput && parsedDate.endDate) {
      const endDate = new Date(parsedDate.endDate);
      endDateInput.value = endDate.toISOString().split('T')[0];
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

// ===== SAVE FUNCTIONS =====

async function saveTitleEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;
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
          // Persist failed (likely RLS) - keep local change and inform the user
          console.warn('Failed to persist pending edit:', result.error);
          // Optionally show a non-blocking notice
          showNonBlockingMessage && showNonBlockingMessage(`Draft saved locally. Sync failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
      }
    }
    
    closeModal('editTitleModal');
    
    // Refresh table
    if (currentEditingTable === 'published') {
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
          showNonBlockingMessage && showNonBlockingMessage(`Draft saved locally. Sync failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
      }
    }
    
    closeModal('editDescModal');
    
    // Refresh table
    if (currentEditingTable === 'published') {
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
          showNonBlockingMessage && showNonBlockingMessage(`Draft saved locally. Sync failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
      }
    }
    
    closeModal('editLocationModal');
    
    // Refresh table
    if (currentEditingTable === 'published') {
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
  const checked = document.querySelectorAll('#collegeTagSelector input[type="checkbox"]:checked');
  
  if (checked.length === 0) {
    alert('Please select at least one college');
    return;
  }
  
  // For now, take first selected (can be expanded for multiple)
  const selectedCollege = availableColleges.find(c => c.code === checked[0].value);
  if (!selectedCollege) {
    alert('Invalid college selection');
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
    event.college = selectedCollege.code;
    event.collegeColor = selectedCollege.color;
    
    // Save to Supabase if function available
    if (typeof updateEvent === 'function' && currentEditingTable === 'published') {
      const result = await updateEvent(currentEditingEventId, event);
      if (!result.success) {
        alert(`Error saving college: ${result.error}`);
        return;
      }
      if (result.event) Object.assign(event, result.event);
      rowsInEditMode.delete(currentEditingEventId);
    } else if (currentEditingTable === 'pending') {
      if (isValidUUID(event.id) && typeof updateEvent === 'function') {
        const result = await updateEvent(event.id, event);
        if (!result.success) {
          console.warn('Failed to persist pending college edit:', result.error);
          showNonBlockingMessage && showNonBlockingMessage(`Draft saved locally. Sync failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
      }
    }
    
    closeModal('editCollegeModal');
    
    // Refresh table
    if (currentEditingTable === 'published') {
      populatePublishedEventsTable();
    } else {
      populatePendingEventsTable();
    }
  } finally {
    // Restore cursor
    document.body.style.cursor = '';
  }
}

async function saveOrgEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;
  const checked = document.querySelectorAll('#orgTagSelector input[type="checkbox"]:checked');
  
  if (checked.length === 0) {
    alert('Please select at least one organization');
    return;
  }
  
  // For now, take first selected (can be expanded for multiple)
  const selectedOrg = checked[0].value;
  
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
    event.organization = selectedOrg;
    
    // Save to Supabase if function available
    if (typeof updateEvent === 'function' && currentEditingTable === 'published') {
      const result = await updateEvent(currentEditingEventId, event);
      if (!result.success) {
        alert(`Error saving organization: ${result.error}`);
        return;
      }
      if (result.event) Object.assign(event, result.event);
      rowsInEditMode.delete(currentEditingEventId);
    } else if (currentEditingTable === 'pending') {
      if (isValidUUID(event.id) && typeof updateEvent === 'function') {
        const result = await updateEvent(event.id, event);
        if (!result.success) {
          console.warn('Failed to persist pending organization edit:', result.error);
          showNonBlockingMessage && showNonBlockingMessage(`Draft saved locally. Sync failed: ${result.error}`);
        } else if (result.event) {
          Object.assign(event, result.event);
        }
      }
    }
    
    closeModal('editOrgModal');
    
    // Refresh table
    if (currentEditingTable === 'published') {
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
  const endDateInput = document.getElementById('editEndDate');
  const endTimeInput = document.getElementById('editEndTime');
  
  if (!startDateInput || !startTimeInput || !endDateInput || !endTimeInput) {
    alert('Please fill in all date and time fields');
    return;
  }
  
  const startDate = startDateInput.value;
  const startTime = startTimeInput.value;
  const endDate = endDateInput.value;
  const endTime = endTimeInput.value;
  
  if (!startDate || !startTime || !endDate || !endTime) {
    alert('Please fill in all date and time fields');
    return;
  }
  
  // Combine date and time into Date objects
  const startDateTime = new Date(`${startDate}T${startTime}`);
  const endDateTime = new Date(`${endDate}T${endTime}`);
  
  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    alert('Invalid date or time format');
    return;
  }
  
  if (endDateTime < startDateTime) {
    alert('End date/time must be after start date/time');
    return;
  }
  
  // Show loading cursor
  document.body.style.cursor = 'wait';
  
  try {
    // Format the date string for display (using formatDateRangeForDisplay)
    const formattedDate = typeof formatDateRangeForDisplay !== 'undefined' 
      ? formatDateRangeForDisplay(startDateTime, endDateTime)
      : `${startDate} ${startTime} - ${endDate} ${endTime}`;
    
    // Update the event data
    const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
    const event = source[currentEditingEventId];
    
    if (event) {
      // Update the date string
      event.date = formattedDate;
      
      // Update parsed date fields
      event.startDate = startDateTime;
      event.endDate = endDateTime;
      event.startTime = `${startTime}:00`;
      event.endTime = `${endTime}:00`;
      
      // Recalculate status from dates
      if (typeof calculateEventStatus !== 'undefined') {
        event.status = calculateEventStatus(startDateTime, endDateTime, event.status === 'Pending' ? 'Pending' : null);
      }
      
      // Event data is already in the correct format from Supabase
      // No need to enrich - event is already updated
      
      if (currentEditingTable === 'published') {
        rowsInEditMode.delete(currentEditingEventId);
      } else if (currentEditingTable === 'pending') {
        // Persist pending date edits if possible
        if (isValidUUID(event.id) && typeof updateEvent === 'function') {
          const result = await updateEvent(event.id, event);
          if (!result.success) {
            console.warn('Failed to persist pending date edit:', result.error);
            showNonBlockingMessage && showNonBlockingMessage(`Draft saved locally. Sync failed: ${result.error}`);
          } else if (result.event) {
            Object.assign(event, result.event);
          }
        }
      }
    }
    
    closeModal('editDateModal');
    
    // Refresh the table
    if (currentEditingTable === 'published') {
      populatePublishedEventsTable();
    } else {
      populatePendingEventsTable();
    }
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
  
  // Initialize images array (use event.images or default to universityLogo)
  currentEditingImages = event.images && event.images.length > 0 
    ? [...event.images] 
    : [event.universityLogo || 'images/tup.png'];
  
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
  
  if (currentEditingImages.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'images-empty-message';
    emptyMsg.textContent = isEditMode 
      ? 'No images uploaded. Upload images to get started.' 
      : 'No images available.';
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
    img.onerror = function() {
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
      deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
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
  if (currentEditingImages.length <= 1) {
    alert('You must have at least one image. Upload a replacement before deleting.');
    return;
  }
  
  if (confirm('Are you sure you want to delete this image?')) {
    currentEditingImages.splice(index, 1);
    
    // Adjust thumbnail index if needed
    if (currentThumbnailIndex >= currentEditingImages.length) {
      currentThumbnailIndex = Math.max(0, currentEditingImages.length - 1);
    } else if (currentThumbnailIndex > index) {
      currentThumbnailIndex--;
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
        // Add uploaded URLs to current editing images
        currentEditingImages.push(...uploadResult.urls);
        
        // If this is the first image, set it as thumbnail
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
    
    // If no images, use universityLogo as fallback
    if (currentEditingImages.length === 0) {
      const source = currentEditingTable === 'published' ? eventsData : pendingEventsData;
      const event = source[currentEditingEventId];
      if (event) {
        currentEditingImages = [event.universityLogo || 'images/tup.png'];
        currentThumbnailIndex = 0;
      }
    }
    
    // Update event in Supabase if functions are available
    if (typeof updateEvent === 'function') {
    if (currentEditingTable === 'published') {
      const source = eventsData;
      const event = source[currentEditingEventId];

      if (event) {
        // Update event with new images and thumbnail index
        const updatedEvent = {
          ...event,
          images: [...currentEditingImages],
          thumbnailIndex: currentThumbnailIndex
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
  
  closeModal('imagesModal');
  
  // Refresh the table
  if (currentEditingTable === 'published') {
    populatePublishedEventsTable();
  } else {
    populatePendingEventsTable();
  }
  } finally {
    // Restore cursor
    document.body.style.cursor = '';
  }
}

function addNewOrganization() {
  const input = document.getElementById('newOrgInput');
  const newOrg = input.value.trim();
  if (newOrg && !availableOrganizations.includes(newOrg)) {
    availableOrganizations.push(newOrg);
    input.value = '';
    // Reopen modal to show new org
    const eventId = currentEditingEventId;
    const currentOrg = eventsData[eventId]?.organization || '';
    openEditOrgModal(eventId, currentOrg);
    // TODO: Save new org to database
  }
}

// ===== EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', function() {
  populatePublishedEventsTable();
  populatePendingEventsTable();
  
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
  
  // Title Modal
  document.getElementById('closeTitleModal')?.addEventListener('click', () => closeModal('editTitleModal'));
  document.getElementById('cancelTitleEdit')?.addEventListener('click', () => closeModal('editTitleModal'));
  document.getElementById('saveTitleEdit')?.addEventListener('click', saveTitleEdit);
  
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
    overlay.addEventListener('click', function(e) {
      if (e.target === this) {
        const modalId = this.id;
        closeModal(modalId);
      }
    });
  });
  
  // Enter key to add new organization
  document.getElementById('newOrgInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addNewOrganization();
    }
  });
});

