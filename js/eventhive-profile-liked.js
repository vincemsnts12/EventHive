// Render liked events from Supabase into the profile liked section.
// Assumes eventsData is loaded (from eventhive-events.js) and likedEventsList exists in the DOM.

(async function() {
  const listEl = document.getElementById('likedEventsList');
  if (!listEl || typeof eventsData === 'undefined') return;

  // Show loading state
  listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Loading liked events...</div>';

  async function renderLiked() {
    listEl.innerHTML = '';
    
    // Get user's liked event IDs from Supabase
    let likedEventIds = [];
    if (typeof getUserLikedEventIds === 'function') {
      const result = await getUserLikedEventIds();
      if (result.success) {
        likedEventIds = result.eventIds;
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

    // Filter eventsData to only show liked events
    const eventsArr = Object.entries(eventsData)
      .map(([id, ev]) => ({ id, ...ev }))
      .filter(ev => likedEventIds.includes(ev.id));

    if (eventsArr.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">No liked events yet. Like some events to see them here!</div>';
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
      img.onerror = function() {
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

      const likeBtn = document.createElement('button');
      likeBtn.title = 'heart-btn';
      likeBtn.className = 'heart-btn active'; // Always active since these are liked events
      likeBtn.innerHTML = '<svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 0C7.7625 0 10 2.30414 10 5.14658C10 2.30414 12.2375 0 15 0C17.7625 0 20 2.30414 20 5.14658C20 9.43058 15.9575 10.9417 10.49 17.7609C10.4298 17.8358 10.3548 17.896 10.2701 17.9373C10.1855 17.9786 10.0933 18 10 18C9.90668 18 9.81449 17.9786 9.72986 17.9373C9.64523 17.896 9.5702 17.8358 9.51 17.7609C4.0425 10.9417 0 9.43058 0 5.14658C0 2.30414 2.2375 0 5 0Z"/></svg>';
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

      const collegeTag = document.createElement('span');
      collegeTag.className = 'college-tag';
      collegeTag.textContent = ev.college || '';
      if (ev.collegeColor) {
        collegeTag.classList.add(ev.collegeColor);
      }

      actions.appendChild(likeBtn);
      actions.appendChild(collegeTag);

      footer.appendChild(title);
      footer.appendChild(actions);

      // Footer is now inside imgWrap, overlaying the image
      imgWrap.appendChild(footer);
      card.appendChild(imgWrap);

      listEl.appendChild(card);
    });
  }

  // Wait for DOM and Supabase to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderLiked);
  } else {
    // Small delay to ensure Supabase services are loaded
    setTimeout(renderLiked, 100);
  }
})();

