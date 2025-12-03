// ===== SAMPLE EVENT DATA =====
const eventsData = { 
  'event-1': {
    title: 'EduTech Summit on Campus with Collab',
    description: 'Event in the College of Science to promote knowledge and participation through interactive workshops, keynote speakers, and networking opportunities for students and faculty.',
    location: 'College of Industrial Education – TUPTeachers on Grounds',
    status: 'Open',
    statusColor: 'open',
    image: 'images/event-1.jpg',
    universityLogo: 'images/logo-science.png' 
  },
  'event-2': {
    title: 'Tech Innovation Conference 2024',
    description: 'Join us for a groundbreaking conference featuring the latest innovations in technology, AI, and digital transformation. Network with industry leaders and explore cutting-edge solutions.',
    location: 'College of Engineering – Main Auditorium',
    status: 'Ongoing',
    statusColor: 'ongoing',
    image: 'images/event-2.jpg',
    universityLogo: 'images/logo-engineering.png'
  },
  'event-3': {
    title: 'Annual Sports Festival',
    description: 'Participate in our exciting annual sports festival with various athletic competitions, team games, and recreational activities for all students and faculty members.',
    location: 'University Sports Complex – Athletic Field',
    status: 'Concluded',
    statusColor: 'concluded',
    image: 'images/event-3.jpg',
    universityLogo: 'images/logo-sports.png'
  },
  'event-4': {
    title: 'Cultural Arts Exhibition',
    description: 'Explore diverse artistic expressions from students and local artists. Features paintings, sculptures, installations, and live performances celebrating creativity and culture.',
    location: 'College of Liberal Arts – Gallery Hall',
    status: 'Open',
    statusColor: 'open',
    image: 'images/event-4.jpg',
    universityLogo: 'images/logo-arts.png'
  },
  'event-5': {
    title: 'Business Leadership Summit',
    description: 'Connect with successful entrepreneurs and business leaders. Learn strategies for business growth, leadership skills, and entrepreneurial mindset development.',
    location: 'College of Business Administration – Conference Center',
    status: 'Open',
    statusColor: 'open',
    image: 'images/event-5.jpg',
    universityLogo: 'images/logo-business.png'
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
  
  // 2. Update Image
  const imageElement = document.getElementById('event-image');
  if (imageElement) {
    imageElement.src = event.image;
    imageElement.alt = event.title;
    imageElement.onerror = function() {
        this.src = 'images/placeholder.jpg'; 
    };
  }
  
  // 3. Update University Logo
  const logoElement = document.getElementById('university-logo');
  if (logoElement) {
    logoElement.src = event.universityLogo || 'images/logo-default.png';
  }

  // 4. UPDATE STATUS BADGE (New Logic)
  const statusContainer = document.querySelector('.event-slider__status');
  const statusText = document.getElementById('status-text');
  
  if (statusContainer && event.statusColor) {
    // Reset to base class then add the specific status color class
    statusContainer.className = 'event-slider__status'; 
    statusContainer.classList.add(event.statusColor);
  }

  if (statusText) {
    statusText.textContent = event.status;
  }
}

// ===== EVENT SLIDER NAVIGATION =====
function setupEventSliderNavigation() {
  const prevBtn = document.getElementById('prevEventBtn');
  const nextBtn = document.getElementById('nextEventBtn');
  const dotsContainer = document.getElementById('eventDotsContainer');
  
  const eventIds = Object.keys(eventsData);
  let currentEventId = getSelectedEventId();
  
  if (!currentEventId || !eventsData[currentEventId]) {
      currentEventId = eventIds[0];
  }

  let currentIndex = eventIds.indexOf(currentEventId);
  
  // Create Dots
  if (dotsContainer) {
    dotsContainer.innerHTML = ''; 
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
  
  const dots = document.querySelectorAll('.event-slider__dot');
  
  function updateDots() {
    dots.forEach((dot, index) => {
      if (index === currentIndex) {
        dot.classList.add('event-slider__dot--active');
      } else {
        dot.classList.remove('event-slider__dot--active');
      }
    });
  }
  
  function changeEvent(newIndex) {
      currentIndex = newIndex;
      // Loop logic
      if (currentIndex < 0) currentIndex = eventIds.length - 1;
      if (currentIndex >= eventIds.length) currentIndex = 0;
      
      currentEventId = eventIds[currentIndex];
      storeEventInSession(currentEventId);
      updateEventDetails(currentEventId);
      updateDots();
  }
  
  if (prevBtn) prevBtn.addEventListener('click', () => changeEvent(currentIndex - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => changeEvent(currentIndex + 1));
  
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => changeEvent(index));
  });
}

// ===== INITIALIZE ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', function() {
  
  if (document.querySelector('.details-btn')) {
    setupEventCardButtons();
  }
  
  if (document.querySelector('.event-slider')) {
    const selectedEventId = getSelectedEventId();
    const eventIds = Object.keys(eventsData);
    
    const eventToShow = (selectedEventId && eventsData[selectedEventId]) 
                        ? selectedEventId 
                        : eventIds[0];
    
    updateEventDetails(eventToShow);
    setupEventSliderNavigation();
  }
});