// Render liked events from Supabase into the profile liked section.
// Assumes eventsData is loaded (from eventhive-events.js) and likedEventsList exists in the DOM.

(async function () {
  const listEl = document.getElementById('likedEventsList');
  if (!listEl) return;

  // Show loading state
  listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Loading liked events...</div>';

  // Wait for eventsData to be populated
  async function waitForEvents(maxWait = 5000) {
    const startTime = Date.now();
    while (typeof eventsData === 'undefined' || Object.keys(eventsData).length === 0) {
      if (Date.now() - startTime > maxWait) {
        console.warn('Timeout waiting for events to load');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return true;
  }

  let isRendering = false; // Guard to prevent duplicate rendering

  async function renderLiked() {
    // Prevent duplicate rendering
    if (isRendering) {
      console.log('renderLiked already in progress, skipping...');
      return;
    }
    isRendering = true;

    try {
      // Detect if viewing another user's profile
      const isViewingOther = window.__EH_VIEWING_OTHER_PROFILE || false;
      const viewUserId = window.__EH_VIEW_USER_ID || null;

      console.log('Profile liked events: isViewingOther:', isViewingOther, 'viewUserId:', viewUserId);

      // Wait for events to be loaded
      const eventsLoaded = await waitForEvents();
      if (!eventsLoaded) {
        listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #B81E20;">Error loading events. Please refresh the page.</div>';
        return;
      }

      listEl.innerHTML = '';

      // Get liked event IDs - either for current user or the profile being viewed
      let likedEventIds = [];
      let visitorLikedEventIds = []; // Visitor's own likes (for showing common likes)

      if (isViewingOther && viewUserId) {
        // Viewing another user's profile - get their liked events
        if (typeof getLikedEventIdsByUserId === 'function') {
          const result = await getLikedEventIdsByUserId(viewUserId);
          if (result.success) {
            likedEventIds = result.eventIds;
            console.log('Other user liked event IDs:', likedEventIds);
          } else {
            console.error('Error loading other user liked events:', result.error);
            listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #B81E20;">Error loading liked events. Please try again.</div>';
            return;
          }
        } else {
          console.warn('getLikedEventIdsByUserId function not available');
          listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Unable to load liked events.</div>';
          return;
        }

        // Also get the visitor's (current user's) liked events for comparison
        if (typeof getUserLikedEventIds === 'function') {
          const visitorResult = await getUserLikedEventIds();
          if (visitorResult.success) {
            visitorLikedEventIds = visitorResult.eventIds;
            console.log('Visitor (current user) liked event IDs:', visitorLikedEventIds);
          }
        }
      } else {
        // Viewing own profile - get current user's liked events
        if (typeof getUserLikedEventIds === 'function') {
          const result = await getUserLikedEventIds();
          if (result.success) {
            likedEventIds = result.eventIds;
            console.log('User liked event IDs:', likedEventIds);
          } else {
            console.error('Error loading liked events:', result.error);
            listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #B81E20;">Error loading liked events. Please try again.</div>';
            return;
          }
        } else {
          // Fallback: show message if Supabase not available
          listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Supabase integration not available.</div>';
          return;
        }
      }

      // Filter eventsData to only show liked events that EXIST in eventsData
      // (This filters out deleted/unapproved events automatically)
      const eventsArr = Object.entries(eventsData)
        .map(([id, ev]) => ({ id, ...ev }))
        .filter(ev => likedEventIds.includes(ev.id));

      console.log('Filtered liked events (existing only):', eventsArr.length, 'out of', likedEventIds.length, 'total likes');

      if (eventsArr.length === 0) {
        // Different message for viewing others vs own profile
        const noLikesMessage = isViewingOther
          ? 'This user has not liked any events yet.'
          : 'No liked events yet. Like some events to see them here!';
        listEl.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">${noLikesMessage}</div>`;
        return;
      }

      // Render each liked event
      eventsArr.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.setAttribute('data-event-id', ev.id);
        card.addEventListener('click', () => {
          localStorage.setItem('selectedEventId', ev.id);
          window.location.href = 'eventhive-events.html';
        });

        const imgWrap = document.createElement('div');
        imgWrap.className = 'event-image';
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
        img.onerror = function () {
          this.src = 'images/tup.png';
        };
        imgWrap.appendChild(img);

        // Footer overlays on image (no separate red footer)
        const footer = document.createElement('div');
        footer.className = 'event-footer';

        const title = document.createElement('span');
        title.className = 'event-title';
        title.textContent = ev.title || '';

        const actions = document.createElement('div');
        actions.className = 'event-actions';

        // Determine if heart button should be shown
        // - Own profile: always show (clickable to unlike)
        // - Visitor view: only show if visitor also liked this event (read-only)
        const isCommonLike = isViewingOther && visitorLikedEventIds.includes(ev.id);
        const showHeartButton = !isViewingOther || isCommonLike;

        if (showHeartButton) {
          const likeBtn = document.createElement('button');
          likeBtn.title = 'heart-btn';
          likeBtn.className = 'heart-btn active'; // Always active since these are liked events
          likeBtn.innerHTML = '<svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 0C7.7625 0 10 2.30414 10 5.14658C10 2.30414 12.2375 0 15 0C17.7625 0 20 2.30414 20 5.14658C20 9.43058 15.9575 10.9417 10.49 17.7609C10.4298 17.8358 10.3548 17.896 10.2701 17.9373C10.1855 17.9786 10.0933 18 10 18C9.90668 18 9.81449 17.9786 9.72986 17.9373C9.64523 17.896 9.5702 17.8358 9.51 17.7609C4.0425 10.9417 0 9.43058 0 5.14658C0 2.30414 2.2375 0 5 0Z"/></svg>';

          // Only allow unlike on own profile
          if (!isViewingOther) {
            likeBtn.addEventListener('click', async (e) => {
              e.stopPropagation();

              // Toggle like in Supabase
              if (typeof toggleEventLike === 'function') {
                const result = await toggleEventLike(ev.id);
                if (result.success) {
                  // If unliked, remove card from view
                  if (!result.liked) {
                    card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                      card.remove();
                      // If no more liked events, show message
                      if (listEl.children.length === 0) {
                        listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">No liked events yet. Like some events to see them here!</div>';
                      }
                    }, 300);
                  }
                } else {
                  alert(`Error: ${result.error}`);
                }
              }
            });
          } else {
            // Viewing other's profile - like button is read-only display (common like)
            likeBtn.style.cursor = 'default';
            likeBtn.style.pointerEvents = 'none';
          }

          actions.appendChild(likeBtn);
        }
        // If not showing heart (visitor didn't like this event), heart is simply not added

        const collegeTag = document.createElement('span');
        collegeTag.className = 'college-tag';
        collegeTag.textContent = ev.college || '';
        if (ev.collegeColor) {
          collegeTag.classList.add(ev.collegeColor);
        }

        actions.appendChild(collegeTag);

        footer.appendChild(title);
        footer.appendChild(actions);

        // Footer is now inside imgWrap, overlaying the image
        imgWrap.appendChild(footer);
        card.appendChild(imgWrap);

        listEl.appendChild(card);
      });

      // Update layout class based on number of events
      const scrollWrapper = listEl.closest('.liked-scroll-wrapper');
      if (eventsArr.length <= 6) {
        listEl.classList.add('liked-horizontal');
        listEl.classList.remove('liked-vertical');
        if (scrollWrapper) {
          scrollWrapper.classList.add('horizontal-scroll');
          scrollWrapper.classList.remove('vertical-scroll');
        }
      } else {
        listEl.classList.add('liked-vertical');
        listEl.classList.remove('liked-horizontal');
        if (scrollWrapper) {
          scrollWrapper.classList.add('vertical-scroll');
          scrollWrapper.classList.remove('horizontal-scroll');
        }
      }
    } finally {
      isRendering = false;
    }
  }

  // Wait for DOM and Supabase to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait a bit for events to load, then render
      setTimeout(renderLiked, 500);
    });
  } else {
    // Small delay to ensure Supabase services and events are loaded
    setTimeout(renderLiked, 500);
  }

  // Also listen for eventsLoaded event
  window.addEventListener('eventsLoaded', renderLiked);
})();

