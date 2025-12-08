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
  // Only return events where is_featured = TRUE
  const featured = list.filter(ev => ev.isFeatured === true);
  // Sort by start_date (ascending - upcoming events first) and limit to 5 max
  return featured.sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return dateA - dateB;
  }).slice(0, 5);
}

function buildHeroData() {
  const source = getFeaturedEvents();
  return source.map(ev => {
    // Truncate description to 200 characters for homepage carousel
    let desc = ev.description || '';
    const maxLength = 197; // Leave room for "..."
    if (desc.length > maxLength) {
      desc = desc.substring(0, maxLength).trim() + '...';
    }
    
    return {
      img: (ev.images && ev.images.length ? ev.images[0] : 'images/tup.png'),
      title: ev.title || '',
      desc: desc,
      btnText: 'Know More',
      eventId: ev.id
    };
  });
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
  const translateX = -index * 20; // 20% per slide (100% / 5 slides)
  slidesTrack.style.transform = `translateX(${translateX}%)`;
  
  // Update dots
  dots.forEach(dot => dot.classList.remove('active'));
  if (dots[index]) {
    dots[index].classList.add('active');
  }
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
    likeBtn.setAttribute('data-event-id', ev.id);
    likeBtn.innerHTML = `<svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 0C7.7625 0 10 2.30414 10 5.14658C10 2.30414 12.2375 0 15 0C17.7625 0 20 2.30414 20 5.14658C20 9.43058 15.9575 10.9417 10.49 17.7609C10.4298 17.8358 10.3548 17.896 10.2701 17.9373C10.1855 17.9786 10.0933 18 10 18C9.90668 18 9.81449 17.9786 9.72986 17.9373C9.64523 17.896 9.5702 17.8358 9.51 17.7609C4.0425 10.9417 0 9.43058 0 5.14658C0 2.30414 2.2375 0 5 0Z"/></svg>`;
    
    // Initialize button state (check if user has liked this event)
    if (typeof hasUserLikedEvent === 'function') {
      hasUserLikedEvent(ev.id).then(result => {
        if (result.success && result.liked) {
          likeBtn.classList.add('active');
        }
      }).catch(err => {
        console.error('Error checking like state:', err);
      });
    }
    
    // Setup click handler to actually like/unlike the event
    likeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Prevent multiple clicks while processing
      if (likeBtn.disabled) {
        return;
      }
      
      // Check if user is authenticated BEFORE disabling button
      let userId = null;
      try {
        userId = localStorage.getItem('eventhive_last_authenticated_user_id');
        if (!userId) {
          // Fallback: Try to get from auth token
          const supabaseAuthKeys = Object.keys(localStorage).filter(key =>
            (key.includes('supabase') && key.includes('auth-token')) ||
            (key.startsWith('sb-') && key.includes('auth-token'))
          );
          if (supabaseAuthKeys.length > 0) {
            const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
            if (authData?.access_token) {
              const payload = JSON.parse(atob(authData.access_token.split('.')[1]));
              userId = payload.sub;
            }
          }
        }
      } catch (err) {
        // Ignore errors - user is not authenticated
      }
      
      if (!userId) {
        alert('Please log in to like events.');
        return;
      }
      
      // Disable button only after authentication check passes
      likeBtn.disabled = true;
      
      try {
        
        // Check if handleLikeClick function is available
        if (typeof handleLikeClick === 'function') {
          await handleLikeClick(ev.id, likeBtn);
        } else if (typeof toggleEventLike === 'function') {
          // Fallback: Use toggleEventLike directly with timeout wrapper
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Like operation timed out after 20 seconds')), 20000);
          });
          
          const result = await Promise.race([
            toggleEventLike(ev.id),
            timeoutPromise
          ]);
          
          if (result.success) {
            if (result.liked) {
              likeBtn.classList.add('active');
            } else {
              likeBtn.classList.remove('active');
            }
            // Update like count if getEventLikeCount is available
            if (typeof getEventLikeCount === 'function') {
              const countResult = await getEventLikeCount(ev.id);
              if (countResult.success) {
                // Find and update like count display if it exists
                const likeCountElement = card.querySelector('.likes-count');
                if (likeCountElement) {
                  likeCountElement.textContent = countResult.count;
                }
              }
            }
          } else {
            console.error('Error toggling like:', result.error);
            if (result.error && !result.error.includes('not authenticated')) {
              alert('Failed to update like. Please try again.');
            }
          }
        } else {
          // No like functionality available, just toggle visual state
          likeBtn.classList.toggle('active');
        }
      } catch (error) {
        console.error('Error in like handler:', error);
        if (error.message && error.message.includes('timed out')) {
          alert('Like operation timed out. Please refresh the page and try again.');
        } else {
          alert('Failed to update like. Please try again.');
        }
      } finally {
        likeBtn.disabled = false;
      }
    });
    
    const collegeTag = document.createElement('span');
    collegeTag.className = 'college-tag';
    // Use main college abbreviation (matching homepage format) - reuse mainCollege from line 138
    collegeTag.textContent = mainCollege;
    // Add title attribute with full name for hover tooltip
    const collegeNameMap = {
      'COS': 'College of Science',
      'COE': 'College of Engineering',
      'CLA': 'College of Liberal Arts',
      'CIE': 'College of Industrial Education',
      'CIT': 'College of Industrial Technology',
      'CAFA': 'College of Architecture and Fine Arts',
      'TUP': 'TUP System-wide'
    };
    collegeTag.title = collegeNameMap[mainCollege] || mainCollege;
    
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
