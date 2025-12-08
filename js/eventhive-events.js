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
  
  // Update description with college information
  const descriptionElement = document.getElementById('event-description');
  if (descriptionElement) {
    let descriptionText = event.description || '';
    
    // Add college information to description if multiple colleges
    const colleges = event.colleges || (event.college ? [event.college] : []);
    if (colleges.length > 1) {
      // Define college names mapping (same as in dropdown-searchbar.js)
      const collegeNameMap = {
        'COS': 'College of Science',
        'COE': 'College of Engineering',
        'CLA': 'College of Liberal Arts',
        'CIE': 'College of Industrial Education',
        'CIT': 'College of Industrial Technology',
        'CAFA': 'College of Architecture and Fine Arts',
        'TUP': 'TUP System-wide'
      };
      
      const collegeNames = colleges.map(code => collegeNameMap[code] || code).filter(Boolean);
      
      if (collegeNames.length > 1) {
        const collegeInfo = `\n\nThis event is a collaboration between: ${collegeNames.join(', ')}.`;
        descriptionText += collegeInfo;
      }
    }
    
    descriptionElement.textContent = descriptionText;
  }
  
  if(document.getElementById('event-location')) document.getElementById('event-location').textContent = event.location;
  
  // Split date and time
  if (event.date) {
    const dateParts = event.date.split(' | ');
    const dateElement = document.getElementById('event-date');
    const timeElement = document.getElementById('event-time');
    
    if (dateElement) {
      dateElement.innerHTML = (dateParts[0] || event.date) + '&nbsp;';
    }
    if (timeElement && dateParts.length > 1) {
      timeElement.textContent = '| ' + dateParts[1];
    } else if (timeElement) {
      timeElement.textContent = '';
    }
  }
  
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
  const statusText = document.getElementById('status-text');
  const statusPill = document.querySelector('.event-status-pill');
  const statusDot = document.getElementById('status-dot');
  const statusColor = getStatusColor(event.status);
  if (statusText) {
    statusText.textContent = (event.status || '').toUpperCase();
  }
  if (statusPill && statusColor) {
    statusPill.classList.remove('upcoming','ongoing','concluded');
    statusPill.classList.add(statusColor);
  }
  if (statusDot && statusColor) {
    const dotColor = statusColor === 'ongoing' ? '#d97706' : statusColor === 'concluded' ? '#dc2626' : '#0b7d3b';
    statusDot.style.backgroundColor = dotColor;
  }

  // 5. UPDATE COLLEGE TAGS (+N)
  const collegeTag = document.getElementById('college-tag');
  const collegeTagCount = document.getElementById('college-tag-count');
  const collegesArr = event.colleges || (event.college ? [event.college] : []);
  const mainCollege = event.mainCollege || event.college || collegesArr[0] || 'TUP';
  const extraColleges = collegesArr.filter(code => code !== mainCollege);
  if (collegeTag) {
    collegeTag.textContent = mainCollege;
    collegeTag.className = 'event-slider__tag event-slider__tag--college';
    const collegeColor = event.collegeColor || (typeof getCollegeColorClass === 'function' ? getCollegeColorClass(mainCollege) : 'tup');
    if (collegeColor) {
      collegeTag.classList.add(collegeColor);
    }
  }
  if (collegeTagCount) {
    if (extraColleges.length > 0) {
      collegeTagCount.style.display = 'inline-flex';
      collegeTagCount.textContent = `+${extraColleges.length}`;
      collegeTagCount.title = extraColleges.join(', ');
    } else {
      collegeTagCount.style.display = 'none';
    }
  }

  // 6. UPDATE ORGANIZATION TAGS (+N)
  const orgTag = document.getElementById('org-tag');
  const orgTagCount = document.getElementById('org-tag-count');
  const orgsArr = (event.organizations && event.organizations.length > 0) ? event.organizations : (event.organization ? [event.organization] : []);
  const mainOrg = orgsArr[0] || '';
  const extraOrgs = orgsArr.slice(1);
  if (orgTag) {
    orgTag.textContent = mainOrg || 'Organization';
  }
  if (orgTagCount) {
    if (extraOrgs.length > 0) {
      orgTagCount.style.display = 'inline-flex';
      orgTagCount.textContent = `+${extraOrgs.length}`;
      orgTagCount.title = extraOrgs.join(', ');
    } else {
      orgTagCount.style.display = 'none';
    }
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