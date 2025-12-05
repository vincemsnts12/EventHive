// ===== EVENTS DATA =====
// Events are loaded from Supabase database
// This object will be populated by Supabase queries (see eventhive-admin-init.js, eventhive-carousel.js, etc.)
const eventsData = {};

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