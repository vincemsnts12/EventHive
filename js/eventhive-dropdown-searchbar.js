// --- DOM ELEMENTS ---
const dropdownBtn = document.getElementById("dropdownCategoryBtn");
const dropdownContent = document.getElementById("dropdownContent");
const dropdownItems = dropdownContent ? dropdownContent.querySelectorAll("div") : [];
const headerTitle = document.getElementById("dynamicHeader"); 

// Containers
const activeContainer = document.getElementById("activeEventsContainer");
const pastContainer = document.getElementById("pastEventsContainer");
const pastSection = document.getElementById("pastSection"); 

// State
let selectedColleges = [];
let allEventCards = []; // Store all dynamically created cards

// --- HELPER FUNCTION: BUILD EVENT CARD ---
function buildEventCard(event) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.setAttribute('data-event-id', event.id);
  
  // Map college codes to full college names for filtering
  const collegeNameMap = {
    'COS': 'College of Science',
    'COE': 'College of Engineering',
    'CLA': 'College of Liberal Arts',
    'CIE': 'College of Industrial Education',
    'CIT': 'College of Industrial Technology',
    'CAFA': 'College of Architecture and Fine Arts',
    'TUP': 'TUP'
  };
  
  // Use main college for event card (for filtering and display)
  const mainCollege = event.mainCollege || event.college || 'TUP';
  const collegeName = collegeNameMap[mainCollege] || mainCollege;
  card.setAttribute('data-category', collegeName);
  
  // Add click handler to navigate to event details
  card.addEventListener('click', () => {
    localStorage.setItem('selectedEventId', event.id);
    window.location.href = 'eventhive-events.html';
  });
  
  // Image wrapper - use thumbnail index if available
  const imageWrap = document.createElement('div');
  imageWrap.className = 'event-image';
  const img = document.createElement('img');
  let thumbnailUrl = 'images/tup.png';
  if (event.images && event.images.length > 0) {
    const thumbnailIndex = (event.thumbnailIndex !== undefined && event.thumbnailIndex < event.images.length) 
      ? event.thumbnailIndex 
      : 0;
    thumbnailUrl = event.images[thumbnailIndex];
  } else if (event.universityLogo) {
    thumbnailUrl = event.universityLogo;
  }
  img.src = thumbnailUrl;
  img.alt = event.title || 'Event image';
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
  
  // Title with capsule style (will be wrapped by title-scroll.js)
  const title = document.createElement('span');
  title.className = 'event-title';
  title.textContent = event.title || '';
  
  // Actions container
  const actions = document.createElement('div');
  actions.className = 'event-actions';
  
  // Heart button (only show for non-concluded events)
  if (event.status !== 'Concluded') {
    const likeBtn = document.createElement('button');
    likeBtn.title = 'heart-btn';
    likeBtn.className = 'heart-btn';
    likeBtn.setAttribute('data-event-id', event.id);
    likeBtn.innerHTML = `<svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 0C7.7625 0 10 2.30414 10 5.14658C10 2.30414 12.2375 0 15 0C17.7625 0 20 2.30414 20 5.14658C20 9.43058 15.9575 10.9417 10.49 17.7609C10.4298 17.8358 10.3548 17.896 10.2701 17.9373C10.1855 17.9786 10.0933 18 10 18C9.90668 18 9.81449 17.9786 9.72986 17.9373C9.64523 17.896 9.5702 17.8358 9.51 17.7609C4.0425 10.9417 0 9.43058 0 5.14658C0 2.30414 2.2375 0 5 0Z"/></svg>`;
    
    // Initialize button state (check if user has liked this event)
    if (typeof hasUserLikedEvent === 'function') {
      hasUserLikedEvent(event.id).then(result => {
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
          await handleLikeClick(event.id, likeBtn);
        } else if (typeof toggleEventLike === 'function') {
          // Fallback: Use toggleEventLike directly with timeout wrapper
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Like operation timed out after 20 seconds')), 20000);
          });
          
          const result = await Promise.race([
            toggleEventLike(event.id),
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
              const countResult = await getEventLikeCount(event.id);
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
    
    actions.appendChild(likeBtn);
  }
  
  // College tag (use main college for event card - show abbreviation like homepage)
  const collegeTag = document.createElement('span');
  collegeTag.className = 'college-tag';
  const mainCollegeForTag = event.mainCollege || event.college || 'TUP';
  // Use abbreviation directly (not full name) to match homepage format
  collegeTag.textContent = mainCollegeForTag;
  // Add title attribute with full name for hover tooltip
  collegeTag.title = collegeNameMap[mainCollegeForTag] || mainCollegeForTag;
  // Use event.collegeColor if available, otherwise derive from main college
  const collegeColor = event.collegeColor || (mainCollegeForTag === 'TUP' ? 'tup' : mainCollegeForTag.toLowerCase());
  if (collegeColor) {
    collegeTag.classList.add(collegeColor);
  }
  actions.appendChild(collegeTag);
  
  footer.appendChild(title);
  footer.appendChild(actions);
  
  // Footer is now inside imageWrap, overlaying the image
  imageWrap.appendChild(footer);
  card.appendChild(imageWrap);
  
  return card;
}

// --- POPULATE EVENTS FROM eventsData ---
function populateEvents() {
  if (!eventsData || typeof eventsData !== 'object') {
    console.error('eventsData is not available');
    return;
  }
  
  // Clear containers
  if (activeContainer) activeContainer.innerHTML = '';
  if (pastContainer) pastContainer.innerHTML = '';
  allEventCards = [];
  
  // Convert eventsData to array and exclude pending drafts
  const eventsArray = Object.entries(eventsData)
    .map(([id, data]) => ({ id, ...data }))
    .filter(ev => !(ev.status && ev.status === 'Pending'));
  
  // Separate active and concluded events
  const activeEvents = eventsArray.filter(ev => ev.status !== 'Concluded');
  const concludedEvents = eventsArray.filter(ev => ev.status === 'Concluded');
  
  // Populate active events
  activeEvents.forEach(event => {
    const card = buildEventCard(event);
    if (activeContainer) {
      activeContainer.appendChild(card);
    }
    allEventCards.push(card);
  });
  
  // Populate concluded events with overlay
  concludedEvents.forEach(event => {
    const card = buildEventCard(event);
    
    // Add "EVENT ENDED" overlay
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    overlay.innerText = 'EVENT ENDED';
    // Make overlay allow clicks to pass through to card
    overlay.style.pointerEvents = 'none';
    card.style.position = 'relative';
    card.prepend(overlay);
    
    // Style for concluded events (keep opacity but allow clicks)
    card.style.opacity = '0.7';
    
    if (pastContainer) {
      pastContainer.appendChild(card);
    }
    allEventCards.push(card);
  });
  
  // Show/hide past section based on concluded events
  if (pastSection) {
    pastSection.style.display = concludedEvents.length > 0 ? 'block' : 'none';
  }
  
  // Initialize title scrolling for new cards
  if (typeof setupTitleScrolling === 'function') {
    setupTitleScrolling();
  }
}

// --- SEPARATE ACTIVE VS PAST EVENTS (legacy function, now handled by populateEvents) ---
function separateEvents() {
  // This function is now replaced by populateEvents, but kept for compatibility
  populateEvents();
}

// --- UPDATE HEADER TEXT ---
function updateHeader() {
  if (!headerTitle) return;
  
  if (selectedColleges.length === 0) {
    headerTitle.textContent = "Up-and-Coming Events";
  } else if (selectedColleges.length === 1) {
    headerTitle.textContent = selectedColleges[0];
  } else {
    headerTitle.textContent = "Filtered Events"; 
  }
}

// --- FILTER CARDS BY COLLEGE ---
function filterCards() {
  allEventCards.forEach(card => {
    const cardCategory = card.getAttribute("data-category");
    
    // Show if no selection or matches category
    if (selectedColleges.length === 0 || selectedColleges.includes(cardCategory)) {
      card.style.display = "block"; 
    } else {
      card.style.display = "none";  
    }
  });
  
  // Re-check visibility of past section after filtering
  checkPastSectionVisibility();
}

// --- TOGGLE PAST SECTION VISIBILITY ---
function checkPastSectionVisibility() {
  if (!pastSection || !pastContainer) return;
  
  const visiblePastCards = Array.from(pastContainer.children).filter(card => {
    return card.style.display !== "none";
  });
  
  pastSection.style.display = visiblePastCards.length > 0 ? "block" : "none";
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  // Only initialize if we're on the search page (check for required elements)
  if (!activeContainer && !pastContainer) {
    // Not on search page, skip initialization
    return;
  }

  // Wait for eventsData to be available
  if (typeof eventsData !== 'undefined') {
    populateEvents();
  } else {
    // If eventsData is loaded asynchronously, wait a bit
    setTimeout(() => {
      if (typeof eventsData !== 'undefined') {
        populateEvents();
      } else {
        console.error('eventsData not available after timeout');
      }
    }, 100);
  }
});

// --- DROPDOWN TOGGLE ---
if (dropdownBtn) {
  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdownContent) {
      dropdownContent.classList.toggle("show");
    }
    const arrow = dropdownBtn.querySelector(".arrow");
    if (arrow) {
      arrow.classList.toggle("rotate");
    }
  });
}

// --- HANDLE DROPDOWN SELECTION ---
if (dropdownItems && dropdownItems.length > 0) {
  dropdownItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();

      const college = item.textContent.trim();

      // 1. Toggle Selection State
      if (selectedColleges.includes(college)) {
        selectedColleges = selectedColleges.filter((c) => c !== college);
        item.classList.remove("selected");
        item.style.backgroundColor = ""; 
        item.style.color = ""; 
      } else {
        selectedColleges.push(college);
        item.classList.add("selected");
        item.style.backgroundColor = "#d12b2e"; 
        item.style.color = "white";
      }

      // 2. Update Button Label
      if (dropdownBtn) {
        if (selectedColleges.length === 0) {
          dropdownBtn.innerHTML = `Select Colleges <span class="arrow">&#9662;</span>`;
        } else {
          dropdownBtn.innerHTML = `Custom <span class="arrow">&#9662;</span>`;
        }
      }

      // 3. Update UI
      updateHeader();
      filterCards();
    });
  });
}

// --- CLOSE DROPDOWN ON OUTSIDE CLICK ---
window.addEventListener("click", (e) => {
  if (dropdownBtn && dropdownContent) {
    if (!dropdownBtn.contains(e.target) && !dropdownContent.contains(e.target)) {
      dropdownContent.classList.remove("show");
      const arrow = dropdownBtn.querySelector(".arrow");
      if (arrow) {
        arrow.classList.remove("rotate");
      }
    }
  }
});
