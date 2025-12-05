// ===== SAMPLE EVENT DATA =====
// Note: This will be replaced with database queries in production
// For now, we enrich this data with parsed dates and calculated fields
const eventsDataRaw = { 
  'event-1': {
    title: 'EduTech Summit on Campus with Collab',
    description: 'Event in the College of Science to promote knowledge and participation through interactive workshops, keynote speakers, and networking opportunities for students and faculty.',
    location: 'College of Industrial Education – TUP Teachers on Grounds',
    date: 'November 7, 2025 (Friday) | 12:00 NN - 4:00 PM',
    status: 'Upcoming', // Will be recalculated from dates
    isFeatured: true,
    likes: 186,
    college: 'COS',
    collegeColor: 'cos',
    organization: 'AWS Learning Club - TUP Manila',
    images: ['images/event-1.jpg', 'images/event-1-2.jpg', 'images/event-1-3.jpg'],
    universityLogo: 'images/tup.png',
    // Database fields (will be populated from database in production)
    id: 'event-1',
    createdAt: null,
    updatedAt: null,
    createdBy: null
  },
  'event-2': {
    title: 'Tech Innovation Conference 2024',
    description: 'Join us for a groundbreaking conference featuring the latest innovations in technology, AI, and digital transformation. Network with industry leaders and explore cutting-edge solutions.',
    location: 'College of Engineering – Main Auditorium',
    date: 'November 15, 2025 (Saturday) | 9:00 AM - 5:00 PM',
    status: 'Ongoing',
    likes: 142,
    isFeatured: false,
    college: 'COE',
    collegeColor: 'coe',
    organization: 'Google Developer Groups on Campus TUP Manila',
    images: ['images/event-2.jpg', 'images/event-2-2.jpg', 'images/event-2-3.jpg'],
    universityLogo: 'images/tup.png'
  },
  'event-3': {
    title: 'Mister and Miss TUP System 2025',
    description: 'A prestigious TUP-System wide pageant showcasing talent, beauty, and excellence. Students from all TUP branches compete for the crown in this grand celebration of poise and personality.',
    location: 'TUP Manila – Grounds',
    date: 'December 4, 2025 (Thursday) | 6:00 PM - 9:00 PM',
    status: 'Concluded',
    likes: 118,
    isFeatured: false,
    college: 'TUP',
    collegeColor: 'tup',
    organization: 'TUP USG Manila',
    images: ['images/carousel_1.jpg'],
    universityLogo: 'images/tup.png'
  },
  'event-4': {
    title: 'Battle of The Bands 2025',
    description: 'Who will take the crown? The most electrifying musical showdown in TUP Manila as bands from different colleges battle it out on stage for ultimate glory and bragging rights!',
    location: 'TUP Manila – Grounds',
    date: 'November 27, 2025 (Thursday) | 5:30 PM - 9:30 PM',
    status: 'Concluded',
    likes: 133,
    isFeatured: false,
    college: 'TUP',
    collegeColor: 'tup',
    organization: 'TUP USG Manila',
    images: ['images/carousel_4.jpg'],
    universityLogo: 'images/tup.png'
  },
  'event-5': {
    title: 'GDGoC In4Session',
    description: 'Join Google Developer Groups on Campus TUP Manila for the official website launch and an insightful AI seminar. Learn about the latest in tech and connect with fellow developers!',
    location: 'TUP Administration – AVR',
    date: 'November 6, 2025 (Thursday) | 1:00 PM - 4:00 PM',
    status: 'Concluded',
    likes: 104,
    isFeatured: false,
    college: 'COS',
    collegeColor: 'cos',
    organization: 'Google Developer Groups on Campus TUP Manila',
    images: ['images/carousel_5.jpg'],
    universityLogo: 'images/tup.png'
  }
};

// ===== ENRICH EVENTS DATA WITH PARSED DATES =====
// This function enriches eventsData with parsed date fields and calculated status
function enrichEventsData(rawData) {
  const enriched = {};
  
  for (const [eventId, event] of Object.entries(rawData)) {
    // Parse date string into structured date/time fields
    const parsedDate = parseDateString(event.date);
    
    // Calculate status from dates (if dates are available)
    let calculatedStatus = event.status;
    
    if (parsedDate) {
      calculatedStatus = calculateEventStatus(
        parsedDate.startDate, 
        parsedDate.endDate, 
        event.status === 'Pending' ? 'Pending' : null
      );
    }
    
    // Calculate statusColor from status (derived, not stored)
    const calculatedStatusColor = getStatusColor(calculatedStatus);
    
    // Create enriched event object
    enriched[eventId] = {
      ...event,
      // Keep original date string for display
      date: event.date,
      // Add parsed date fields for database compatibility
      startDate: parsedDate ? parsedDate.startDate : null,
      endDate: parsedDate ? parsedDate.endDate : null,
      startTime: parsedDate ? parsedDate.startTime : null,
      endTime: parsedDate ? parsedDate.endTime : null,
      // Use calculated status (from dates) instead of stored status
      status: calculatedStatus,
      // statusColor is derived from status, not stored in raw data
      statusColor: calculatedStatusColor,
      // Ensure all required fields exist
      id: event.id || eventId,
      isFeatured: event.isFeatured || false,
      likes: event.likes || 0,
      createdAt: event.createdAt || null,
      updatedAt: event.updatedAt || null,
      createdBy: event.createdBy || null
    };
  }
  
  return enriched;
}

// Enriched events data with parsed dates and calculated fields
const eventsData = enrichEventsData(eventsDataRaw);

// Current image index for the carousel
let currentImageIndex = 0;

// ===== STORE EVENT DATA IN LOCALSTORAGE =====
function storeEventInSession(eventId) {
  localStorage.setItem('selectedEventId', eventId);
}

// ===== GET EVENT DATA FROM LOCALSTORAGE =====
function getSelectedEventId() {
  return localStorage.getItem('selectedEventId');
}

// ===== SETUP SEE DETAILS BUTTONS (For Home/Profile Page) =====
function setupEventCardButtons() {
  const detailButtons = document.querySelectorAll('.details-btn');
  
  detailButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      const eventId = this.getAttribute('data-event-id');
      if (eventId && eventsData[eventId]) {
        storeEventInSession(eventId);
        // HTML <a> tag handles redirection
      }
    });
  });
}

// ===== UPDATE EVENT DETAILS ON EVENTS PAGE =====
function updateEventDetails(eventId) {
  const event = eventsData[eventId];
  
  if (!event) {
    console.error('Event data not found for:', eventId);
    return;
  }
  
  // 1. Update Text Elements
  if(document.getElementById('event-title')) document.getElementById('event-title').textContent = event.title;
  if(document.getElementById('event-description')) document.getElementById('event-description').textContent = event.description;
  if(document.getElementById('event-location')) document.getElementById('event-location').textContent = event.location;
  if(document.getElementById('event-date')) document.getElementById('event-date').textContent = event.date;
  
  // 2. Update Image (use thumbnail index if available)
  currentImageIndex = 0;
  const imageElement = document.getElementById('event-image');
  if (imageElement) {
    let thumbnailUrl = 'images/tup.png';
    if (event.images && event.images.length > 0) {
      const thumbnailIndex = (event.thumbnailIndex !== undefined && event.thumbnailIndex < event.images.length) 
        ? event.thumbnailIndex 
        : 0;
      thumbnailUrl = event.images[thumbnailIndex];
      currentImageIndex = thumbnailIndex;
    } else if (event.universityLogo) {
      thumbnailUrl = event.universityLogo;
    }
    imageElement.src = thumbnailUrl;
    imageElement.alt = event.title;
    imageElement.style.objectFit = 'cover';
    imageElement.style.objectPosition = 'center';
    imageElement.onerror = function() {
        this.src = 'images/tup.png'; 
    };
  }
  
  // 3. Update University Logo
  const logoElement = document.getElementById('university-logo');
  if (logoElement) {
    logoElement.src = event.universityLogo || 'images/tup.png';
  }

  // 4. UPDATE STATUS BADGE
  const statusContainer = document.querySelector('.event-slider__status');
  const statusText = document.getElementById('status-text');
  
  if (statusContainer && event.status) {
    statusContainer.className = 'event-slider__status'; 
    // Derive statusColor from status
    const statusColor = getStatusColor(event.status);
    statusContainer.classList.add(statusColor);
  }

  if (statusText) {
    statusText.textContent = event.status;
  }

  // 5. UPDATE COLLEGE TAG
  const collegeTag = document.getElementById('college-tag');
  if (collegeTag) {
    collegeTag.textContent = event.college;
    collegeTag.className = 'event-slider__tag event-slider__tag--college';
    if (event.collegeColor) {
      collegeTag.classList.add(event.collegeColor);
    }
  }

  // 6. UPDATE ORGANIZATION TAG
  const orgTag = document.getElementById('org-tag');
  if (orgTag) {
    orgTag.textContent = event.organization;
  }

  // 7. Setup Image Carousel Dots
  setupImageCarousel(event);
  
  // 8. Reload comments and likes for this event (if Supabase is available)
  if (typeof initializeCommentsAndLikes === 'function') {
    initializeCommentsAndLikes(eventId);
  }
}

// ===== IMAGE CAROUSEL FOR SINGLE EVENT =====
function setupImageCarousel(event) {
  const prevBtn = document.getElementById('prevEventBtn');
  const nextBtn = document.getElementById('nextEventBtn');
  const dotsContainer = document.getElementById('eventDotsContainer');
  const imageElement = document.getElementById('event-image');
  
  if (!event.images || event.images.length === 0) return;
  
  const images = event.images;
  
  // Create Dots based on number of images
  if (dotsContainer) {
    dotsContainer.innerHTML = ''; 
    images.forEach((img, index) => {
      const dot = document.createElement('div');
      dot.classList.add('event-slider__dot');
      if (index === 0) {
        dot.classList.add('event-slider__dot--active');
      }
      dot.dataset.index = index;
      dotsContainer.appendChild(dot);
    });
  }
  
  function updateDotsAndImage() {
    const dots = document.querySelectorAll('.event-slider__dot');
    dots.forEach((dot, index) => {
      if (index === currentImageIndex) {
        dot.classList.add('event-slider__dot--active');
      } else {
        dot.classList.remove('event-slider__dot--active');
      }
    });
    
    // Update image
    if (imageElement) {
      imageElement.src = images[currentImageIndex];
      imageElement.onerror = function() {
        this.src = 'images/tup.png'; 
      };
    }
  }
  
  function changeImage(newIndex) {
    currentImageIndex = newIndex;
    // Loop logic
    if (currentImageIndex < 0) currentImageIndex = images.length - 1;
    if (currentImageIndex >= images.length) currentImageIndex = 0;
    
    updateDotsAndImage();
  }
  
  // Remove old event listeners by cloning buttons
  if (prevBtn) {
    const newPrevBtn = prevBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    newPrevBtn.addEventListener('click', () => changeImage(currentImageIndex - 1));
  }
  
  if (nextBtn) {
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    newNextBtn.addEventListener('click', () => changeImage(currentImageIndex + 1));
  }
  
  // Add click listeners to dots
  const dots = document.querySelectorAll('.event-slider__dot');
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => changeImage(index));
  });
}

// ===== COMMENT CHARACTER COUNTER =====
function setupCommentCharCounter() {
  const textarea = document.getElementById('commentTextarea');
  const counter = document.getElementById('charCounter');
  const maxLength = 200;
  
  if (textarea && counter) {
    textarea.addEventListener('input', function() {
      const currentLength = this.value.length;
      counter.textContent = `${currentLength}/${maxLength}`;
      
      // Update counter color based on length
      counter.classList.remove('warning', 'limit');
      if (currentLength >= maxLength) {
        counter.classList.add('limit');
      } else if (currentLength >= maxLength * 0.8) {
        counter.classList.add('warning');
      }
    });
  }
}

// ===== INITIALIZE ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', async function() {
  
  if (document.querySelector('.details-btn')) {
    setupEventCardButtons();
  }
  
  if (document.querySelector('.event-slider')) {
    const selectedEventId = getSelectedEventId();
    const eventIds = Object.keys(eventsData);
    
    const eventToShow = (selectedEventId && eventsData[selectedEventId]) 
                        ? selectedEventId 
                        : eventIds[0];
    
    // This now also sets up the image carousel
    updateEventDetails(eventToShow);
    
    // Initialize comments and likes for this event
    if (typeof initializeCommentsAndLikes === 'function') {
      await initializeCommentsAndLikes(eventToShow);
    }
  }
  
  // Setup comment character counter
  setupCommentCharCounter();
});