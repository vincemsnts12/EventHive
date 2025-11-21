// ===== SAMPLE EVENT DATA =====
const eventsData = {
  'event-1': {
    title: 'EduTech Summit: Shaping the Future of Learning',
    description: 'Event in the College of Science to promote knowledge and participation through interactive workshops, keynote speakers, and networking opportunities for students and faculty.',
    location: 'College of Industrial Education – TUPTeachers on Grounds',
    image: 'path/to/event1-image.jpg',
    universityLogo: 'path/to/university-logo.png'
  },
  'event-2': {
    title: 'Tech Innovation Conference 2024',
    description: 'Join us for a groundbreaking conference featuring the latest innovations in technology, AI, and digital transformation. Network with industry leaders and explore cutting-edge solutions.',
    location: 'College of Engineering – Main Auditorium',
    image: 'path/to/event2-image.jpg',
    universityLogo: 'path/to/university-logo.png'
  },
  'event-3': {
    title: 'Annual Sports Festival',
    description: 'Participate in our exciting annual sports festival with various athletic competitions, team games, and recreational activities for all students and faculty members.',
    location: 'University Sports Complex – Athletic Field',
    image: 'path/to/event3-image.jpg',
    universityLogo: 'path/to/university-logo.png'
  },
  'event-4': {
    title: 'Cultural Arts Exhibition',
    description: 'Explore diverse artistic expressions from students and local artists. Features paintings, sculptures, installations, and live performances celebrating creativity and culture.',
    location: 'College of Liberal Arts – Gallery Hall',
    image: 'path/to/event4-image.jpg',
    universityLogo: 'path/to/university-logo.png'
  },
  'event-5': {
    title: 'Business Leadership Summit',
    description: 'Connect with successful entrepreneurs and business leaders. Learn strategies for business growth, leadership skills, and entrepreneurial mindset development.',
    location: 'College of Business Administration – Conference Center',
    image: 'path/to/event5-image.jpg',
    universityLogo: 'path/to/university-logo.png'
  }
};

// ===== STORE EVENT DATA IN LOCALSTORAGE =====
function storeEventInSession(eventId) {
  localStorage.setItem('selectedEventId', eventId);
}

// ===== GET EVENT DATA FROM LOCALSTORAGE =====
function getSelectedEventId() {
  return localStorage.getItem('selectedEventId');
}

// ===== SETUP SEE DETAILS BUTTONS ON HOMEPAGE AND PROFILE PAGE =====
function setupEventCardButtons() {
  // Get all See Details buttons from event cards
  const detailButtons = document.querySelectorAll('.details-btn');
  
  detailButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Get the event ID from the button's data attribute
      const eventId = this.getAttribute('data-event-id');
      
      if (eventId && eventsData[eventId]) {
        // Store the event ID in localStorage
        storeEventInSession(eventId);
        
        // Redirect to events page
        window.location.href = 'eventhive-homepage.html'; // Changed to your actual page name
      } else {
        console.error('Event not found:', eventId);
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
  
  // Update title
  const titleElement = document.getElementById('event-title');
  if (titleElement) {
    titleElement.textContent = event.title;
  }
  
  // Update description
  const descriptionElement = document.getElementById('event-description');
  if (descriptionElement) {
    descriptionElement.textContent = event.description;
  }
  
  // Update location
  const locationElement = document.getElementById('event-location');
  if (locationElement) {
    locationElement.textContent = event.location;
  }
  
  // Update event image
  const imageElement = document.getElementById('event-image');
  if (imageElement) {
    imageElement.src = event.image;
    imageElement.alt = event.title;
    // Show image if it has a valid path
    if (event.image && !event.image.includes('path/to/')) {
      imageElement.style.display = 'block';
    }
  }
  
  // Update university logo
  const logoElement = document.getElementById('university-logo');
  if (logoElement) {
    logoElement.src = event.universityLogo;
    logoElement.alt = 'University Logo';
    // Show logo if it has a valid path
    if (event.universityLogo && !event.universityLogo.includes('path/to/')) {
      logoElement.style.display = 'block';
    }
  }
}

// ===== EVENT SLIDER NAVIGATION =====
function setupEventSliderNavigation() {
  const prevBtn = document.getElementById('prevEventBtn');
  const nextBtn = document.getElementById('nextEventBtn');
  const dotsContainer = document.getElementById('eventDotsContainer');
  
  // Get all event IDs as array
  const eventIds = Object.keys(eventsData);
  let currentEventId = getSelectedEventId() || eventIds[0];
  let currentIndex = eventIds.indexOf(currentEventId);
  
  // DYNAMICALLY CREATE DOTS BASED ON NUMBER OF EVENTS
  if (dotsContainer) {
    dotsContainer.innerHTML = ''; // Clear existing dots
    
    eventIds.forEach((eventId, index) => {
      const dot = document.createElement('div');
      dot.classList.add('event-slider__dot');
      if (index === currentIndex) {
        dot.classList.add('event-slider__dot--active');
      }
      dot.dataset.index = index;
      dotsContainer.appendChild(dot);
    });
  }
  
  // Get the newly created dots
  const dots = document.querySelectorAll('.event-slider__dot');
  
  // Update dot indicators
  function updateDots() {
    dots.forEach((dot, index) => {
      if (index === currentIndex) {
        dot.classList.add('event-slider__dot--active');
      } else {
        dot.classList.remove('event-slider__dot--active');
      }
    });
  }
  
  // Previous button click
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentIndex--;
      if (currentIndex < 0) {
        currentIndex = eventIds.length - 1; // Loop to last event
      }
      
      currentEventId = eventIds[currentIndex];
      storeEventInSession(currentEventId);
      updateEventDetails(currentEventId);
      updateDots();
    });
  }
  
  // Next button click
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentIndex++;
      if (currentIndex >= eventIds.length) {
        currentIndex = 0; // Loop to first event
      }
      
      currentEventId = eventIds[currentIndex];
      storeEventInSession(currentEventId);
      updateEventDetails(currentEventId);
      updateDots();
    });
  }
  
  // Dot navigation
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      currentIndex = index;
      currentEventId = eventIds[currentIndex];
      storeEventInSession(currentEventId);
      updateEventDetails(currentEventId);
      updateDots();
    });
  });
}

// ===== INITIALIZE ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', function() {
  
  // Check if we're on the homepage/profile page with event cards
  const isHomePage = document.querySelector('.event-card') !== null;
  
  // Check if we're on the events details page with slider
  const isEventPage = document.querySelector('.event-slider') !== null;
  
  if (isHomePage) {
    // Setup "See Details" buttons on homepage/profile
    setupEventCardButtons();
  }
  
  if (isEventPage) {
    // Get the selected event ID from localStorage
    const selectedEventId = getSelectedEventId();
    
    // If there's a selected event, display it otherwise show first event
    const eventIds = Object.keys(eventsData);
    const eventToShow = selectedEventId || eventIds[0];
    
    // Update the event details
    updateEventDetails(eventToShow);
    
    // Setup slider navigation prev/next buttons and dots
    setupEventSliderNavigation();
  }
  
});

// ===== OPTIONAL: CLEAR SELECTED EVENT (for testing) =====
function clearSelectedEvent() {
  localStorage.removeItem('selectedEventId');
  console.log('Selected event cleared from localStorage');
}