// ===== ADMIN DASHBOARD FUNCTIONALITY =====

// Available colleges for selection
const availableColleges = [
  { code: 'COS', name: 'College of Science', color: 'cos' },
  { code: 'COE', name: 'College of Engineering', color: 'coe' },
  { code: 'CAFA', name: 'College of Architecture', color: 'cafa' },
  { code: 'CLA', name: 'College of Liberal Arts', color: 'cla' },
  { code: 'CIE', name: 'College of Industrial Education', color: 'cie' },
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

// Pending Events (from Google Forms submissions)
const pendingEventsData = {
  'pending-1': {
    title: 'Hackathon 2025: Code Your Future',
    description: 'A 48-hour coding competition where students will build innovative solutions to real-world problems. Prizes and mentorship opportunities await!',
    location: 'College of Engineering – Computer Lab',
    date: 'January 15, 2026 (Thursday) | 8:00 AM - 6:00 PM',
    status: 'Pending',
    statusColor: 'pending',
    college: 'COE',
    collegeColor: 'coe',
    organization: 'TUP Programming Club',
    images: ['images/tup.png'],
    universityLogo: 'images/tup.png'
  },
  'pending-2': {
    title: 'Art Exhibition: Colors of Innovation',
    description: 'Showcase of student artworks featuring digital art, traditional paintings, and mixed media installations celebrating creativity and innovation.',
    location: 'College of Architecture – Gallery Hall',
    date: 'February 10, 2026 (Tuesday) | 10:00 AM - 7:00 PM',
    status: 'Pending',
    statusColor: 'pending',
    college: 'CAFA',
    collegeColor: 'cafa',
    organization: 'TUP Visual Arts Society',
    images: ['images/tup.png'],
    universityLogo: 'images/tup.png'
  },
  'pending-3': {
    title: 'Science Fair 2026: Innovation Showcase',
    description: 'Annual science fair featuring student research projects, experiments, and innovations across various scientific disciplines.',
    location: 'College of Science – Main Hall',
    date: 'March 5, 2026 (Thursday) | 9:00 AM - 4:00 PM',
    status: 'Pending',
    statusColor: 'pending',
    college: 'COS',
    collegeColor: 'cos',
    organization: 'TUP Science Society',
    images: ['images/tup.png'],
    universityLogo: 'images/tup.png'
  }
};

// Current editing state
let currentEditingEventId = null;
let currentEditingField = null;
let currentEditingTable = null; // 'published' or 'pending'
let rowsInEditMode = new Set(); // Track which rows are in edit mode

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
  let timeFormatted = timePart
    .replace('12:00 NN', '12NN')
    .replace(' AM', 'AM')
    .replace(' PM', 'PM')
    .replace(':', '')
    .replace(' - ', '-');
  
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
    const isEnded = event.status === 'Concluded';
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
    
    // Date & Time
    const dateCell = document.createElement('td');
    dateCell.className = 'date-cell';
    dateCell.setAttribute('data-label', 'Date & Time');
    const dateDisplay = document.createElement('div');
    dateDisplay.className = 'date-display';
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
    statusBadge.className = `status-badge ${event.statusColor}`;
    statusBadge.innerHTML = `<span class="status-dot"></span> ${event.status}`;
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);
    
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
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
        // TODO: Delete from database
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

// ===== POPULATE PENDING EVENTS TABLE =====
function populatePendingEventsTable() {
  const tbody = document.getElementById('pendingEventsTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  const sortedPending = sortEvents(pendingEventsData);
  
  sortedPending.forEach(([eventId, event]) => {
    const row = document.createElement('tr');
    
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
    
    // Date & Time
    const dateCell = document.createElement('td');
    dateCell.className = 'date-cell';
    dateCell.setAttribute('data-label', 'Date & Time');
    const dateDisplay = document.createElement('div');
    dateDisplay.className = 'date-display';
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
}

// ===== APPROVE PENDING EVENT =====
function approvePendingEvent(eventId) {
  if (!pendingEventsData[eventId]) return;
  
  const pendingEvent = pendingEventsData[eventId];
  
  // Create new event ID for published events
  const newEventId = `event-${Object.keys(eventsData).length + 1}`;
  
  // Move to published events with status "Upcoming"
  eventsData[newEventId] = {
    ...pendingEvent,
    status: 'Upcoming',
    statusColor: 'upcoming'
  };
  
  // Remove from pending
  delete pendingEventsData[eventId];
  
  // Refresh both tables
  populatePublishedEventsTable();
  populatePendingEventsTable();
  
  // TODO: Save to Supabase
  console.log(`Approved event: ${eventId} → ${newEventId}`);
}

// ===== REJECT PENDING EVENT =====
function rejectPendingEvent(eventId) {
  if (!pendingEventsData[eventId]) return;
  
  const event = pendingEventsData[eventId];
  
  if (confirm(`Are you sure you want to reject "${event.title}"?`)) {
    // Remove from pending
    delete pendingEventsData[eventId];
    
    // Refresh pending table
    populatePendingEventsTable();
    
    // TODO: Save rejection to Supabase
    console.log(`Rejected event: ${eventId}`);
  }
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

function saveTitleEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;
  const newTitle = document.getElementById('editTitleInput').value.trim();
  if (newTitle) {
    if (currentEditingTable === 'published' && eventsData[currentEditingEventId]) {
      eventsData[currentEditingEventId].title = newTitle;
      rowsInEditMode.delete(currentEditingEventId);
      populatePublishedEventsTable();
    } else if (currentEditingTable === 'pending' && pendingEventsData[currentEditingEventId]) {
      pendingEventsData[currentEditingEventId].title = newTitle;
      populatePendingEventsTable();
    }
    closeModal('editTitleModal');
    // TODO: Save to Supabase
  }
}

function saveDescEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;
  const newDesc = document.getElementById('editDescInput').value.trim();
  if (newDesc) {
    if (currentEditingTable === 'published' && eventsData[currentEditingEventId]) {
      eventsData[currentEditingEventId].description = newDesc;
      rowsInEditMode.delete(currentEditingEventId);
      populatePublishedEventsTable();
    } else if (currentEditingTable === 'pending' && pendingEventsData[currentEditingEventId]) {
      pendingEventsData[currentEditingEventId].description = newDesc;
      populatePendingEventsTable();
    }
    closeModal('editDescModal');
    // TODO: Save to Supabase
  }
}

function saveLocationEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;
  const newLocation = document.getElementById('editLocationInput').value.trim();
  if (newLocation) {
    if (currentEditingTable === 'published' && eventsData[currentEditingEventId]) {
      eventsData[currentEditingEventId].location = newLocation;
      rowsInEditMode.delete(currentEditingEventId);
      populatePublishedEventsTable();
    } else if (currentEditingTable === 'pending' && pendingEventsData[currentEditingEventId]) {
      pendingEventsData[currentEditingEventId].location = newLocation;
      populatePendingEventsTable();
    }
    closeModal('editLocationModal');
    // TODO: Save to Supabase
  }
}

function saveCollegeEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;
  const checked = document.querySelectorAll('#collegeTagSelector input[type="checkbox"]:checked');
  if (checked.length > 0) {
    // For now, take first selected (can be expanded for multiple)
    const selectedCollege = availableColleges.find(c => c.code === checked[0].value);
    if (selectedCollege) {
      if (currentEditingTable === 'published' && eventsData[currentEditingEventId]) {
        eventsData[currentEditingEventId].college = selectedCollege.code;
        eventsData[currentEditingEventId].collegeColor = selectedCollege.color;
        rowsInEditMode.delete(currentEditingEventId);
        populatePublishedEventsTable();
      } else if (currentEditingTable === 'pending' && pendingEventsData[currentEditingEventId]) {
        pendingEventsData[currentEditingEventId].college = selectedCollege.code;
        pendingEventsData[currentEditingEventId].collegeColor = selectedCollege.color;
        populatePendingEventsTable();
      }
      closeModal('editCollegeModal');
      // TODO: Save to Supabase
    }
  }
}

function saveOrgEdit() {
  if (!currentEditingEventId || !currentEditingTable) return;
  const checked = document.querySelectorAll('#orgTagSelector input[type="checkbox"]:checked');
  if (checked.length > 0) {
    // For now, take first selected (can be expanded for multiple)
    const selectedOrg = checked[0].value;
    if (currentEditingTable === 'published' && eventsData[currentEditingEventId]) {
      eventsData[currentEditingEventId].organization = selectedOrg;
      rowsInEditMode.delete(currentEditingEventId);
      populatePublishedEventsTable();
    } else if (currentEditingTable === 'pending' && pendingEventsData[currentEditingEventId]) {
      pendingEventsData[currentEditingEventId].organization = selectedOrg;
      populatePendingEventsTable();
    }
    closeModal('editOrgModal');
    // TODO: Save to Supabase
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

