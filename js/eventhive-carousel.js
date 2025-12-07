const slidesTrack = document.querySelector('.slides-track');
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
const topEventsContainer = document.getElementById('topEventsContainer');
let index = 0;
let autoSlideTimer;
let heroDataCache = [];

// ---- Helpers ----
function eventsArray() {
  if (typeof eventsData === 'undefined') return [];
  // Exclude pending events from hero carousel and top events
  return Object.entries(eventsData)
    .map(([id, data]) => ({ id, ...data }))
    .filter(ev => !(ev.status && ev.status === 'Pending'));
}

function getFeaturedEvents() {
  const list = eventsArray();
  const featured = list.filter(ev => ev.isFeatured);
  if (featured.length >= 3) return featured.sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 3);
  const topByLikes = list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const merged = [...featured];
  topByLikes.forEach(ev => {
    if (merged.length < 3 && !merged.find(f => f.id === ev.id)) merged.push(ev);
  });
  return merged.slice(0, 3);
}

function buildHeroData() {
  const source = getFeaturedEvents();
  return source.map(ev => ({
    img: (ev.images && ev.images.length ? ev.images[0] : 'images/tup.png'),
    title: ev.title || '',
    desc: ev.description || '',
    btnText: 'Know More',
    eventId: ev.id
  }));
}

// Initialize all slides with their content
function initSlides() {
  heroDataCache = buildHeroData();
  slides.forEach((slide, i) => {
    const bg = slide.querySelector('.slide-bg');
    const title = slide.querySelector('.hero-title');
    const desc = slide.querySelector('.hero-desc');
    const btn = slide.querySelector('.hero-btn');
    
    if (heroDataCache[i]) {
      bg.style.backgroundImage = `url(${heroDataCache[i].img})`;
      title.textContent = heroDataCache[i].title;
      desc.textContent = heroDataCache[i].desc;
      btn.textContent = heroDataCache[i].btnText;
      btn.href = "eventhive-events.html";
      btn.onclick = function() {
        localStorage.setItem('selectedEventId', heroDataCache[i].eventId);
      };
    }
  });
}

// Move to specific slide
function goToSlide(n) {
  const len = heroDataCache.length || slides.length || 1;
  index = (n + len) % len;
  
  // Move the track
  const translateX = -index * 33.333;
  slidesTrack.style.transform = `translateX(${translateX}%)`;
  
  // Update dots
  dots.forEach(dot => dot.classList.remove('active'));
  dots[index].classList.add('active');
}

// Function to reset auto-slide timer
function resetAutoSlideTimer() {
  clearInterval(autoSlideTimer);
  autoSlideTimer = setInterval(() => goToSlide(index + 1), 8000);
}

// Navigation buttons (reset timer on manual navigation)
document.querySelector('.prev').addEventListener('click', () => {
  goToSlide(index - 1);
  resetAutoSlideTimer();
});

document.querySelector('.next').addEventListener('click', () => {
  goToSlide(index + 1);
  resetAutoSlideTimer();
});

// Dots click (reset timer on manual navigation)
dots.forEach((dot, i) => dot.addEventListener('click', () => {
  goToSlide(i);
  resetAutoSlideTimer();
}));

// Initialize carousel when events are loaded
// This will be called by eventhive-homepage-init.js after events are loaded from Supabase
// For now, initialize if eventsData already has data (fallback for non-Supabase scenarios)
if (typeof eventsData !== 'undefined' && Object.keys(eventsData).length > 0) {
  initSlides();
  goToSlide(0);
} else {
  // Wait for events to be loaded - homepage-init.js will call initSlides() and goToSlide(0)
  // Export functions for external initialization
  window.initCarousel = function() {
    initSlides();
    goToSlide(0);
  };
}

// Render Top Events Today (top 3 by likes)
function renderTopEvents() {
  if (!topEventsContainer) return;
  topEventsContainer.innerHTML = '';
  const topThree = eventsArray()
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 3);
  
  topThree.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'event-card';
    // Use main college for event card
    const mainCollege = ev.mainCollege || ev.college || 'TUP';
    card.setAttribute('data-category', mainCollege || '');
    card.addEventListener('click', () => {
      localStorage.setItem('selectedEventId', ev.id);
      window.location.href = 'eventhive-events.html';
    });
    
    const imageWrap = document.createElement('div');
    imageWrap.className = 'event-image';
    const img = document.createElement('img');
    let thumbnailUrl = 'images/tup.png';
    if (ev.images && ev.images.length > 0) {
      const thumbnailIndex = (ev.thumbnailIndex !== undefined && ev.thumbnailIndex < ev.images.length) 
        ? ev.thumbnailIndex 
        : 0;
      thumbnailUrl = ev.images[thumbnailIndex];
    } else if (ev.universityLogo) {
      thumbnailUrl = ev.universityLogo;
    }
    img.src = thumbnailUrl;
    img.alt = ev.title || 'Event image';
    img.style.objectFit = 'cover';
    img.style.objectPosition = 'center';
    img.style.width = '100%';
    img.style.height = '100%';
    img.onerror = function() {
      this.src = 'images/tup.png';
    };
    imageWrap.appendChild(img);
    
    // Footer overlays on image (no separate red footer)
    const footer = document.createElement('div');
    footer.className = 'event-footer';
    
    const title = document.createElement('span');
    title.className = 'event-title';
    title.textContent = ev.title || '';
    
    const actions = document.createElement('div');
    actions.className = 'event-actions';
    
    const likeBtn = document.createElement('button');
    likeBtn.title = 'heart-btn';
    likeBtn.className = 'heart-btn';
    likeBtn.innerHTML = `<svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 0C7.7625 0 10 2.30414 10 5.14658C10 2.30414 12.2375 0 15 0C17.7625 0 20 2.30414 20 5.14658C20 9.43058 15.9575 10.9417 10.49 17.7609C10.4298 17.8358 10.3548 17.896 10.2701 17.9373C10.1855 17.9786 10.0933 18 10 18C9.90668 18 9.81449 17.9786 9.72986 17.9373C9.64523 17.896 9.5702 17.8358 9.51 17.7609C4.0425 10.9417 0 9.43058 0 5.14658C0 2.30414 2.2375 0 5 0Z"/></svg>`;
    likeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      likeBtn.classList.toggle('active');
    });
    
    const collegeTag = document.createElement('span');
    collegeTag.className = 'college-tag';
    collegeTag.textContent = ev.college || '';
    
    actions.appendChild(likeBtn);
    actions.appendChild(collegeTag);
    
    footer.appendChild(title);
    footer.appendChild(actions);
    
    // Footer is now inside imageWrap, overlaying the image
    imageWrap.appendChild(footer);
    card.appendChild(imageWrap);
    
    topEventsContainer.appendChild(card);
  });
}

renderTopEvents();

// Start auto slide
autoSlideTimer = setInterval(() => goToSlide(index + 1), 8000);
