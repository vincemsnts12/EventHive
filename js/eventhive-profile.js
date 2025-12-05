// Profile Page Functionality

document.addEventListener('DOMContentLoaded', function() {
  
  // ===== LOAD SAVED PROFILE DATA =====
  // Profile data is now loaded from Supabase via eventhive-profile-load.js
  // This localStorage function is kept as fallback only
  // loadSavedProfileData();

  // ===== EDIT PROFILE BUTTON ACTIVE STATE =====
  const editProfileBtn = document.querySelector('.edit-profile-btn');
  
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', function() {
      // Add active class
      this.classList.add('active');
      
      // Remove after short delay (button will redirect anyway)
      setTimeout(() => {
        this.classList.remove('active');
      }, 300);
    });
  }

  // ===== LIKED POST SECTION FUNCTIONALITY =====
  
  // Get all like buttons
  const likeButtons = document.querySelectorAll('.like-btn');
  const commentButtons = document.querySelectorAll('.comment-btn');

  // Like Button Functionality
  likeButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      this.classList.toggle('liked');
      
      // Change heart icon when liked/unliked
      if (this.classList.contains('liked')) {
        this.innerHTML = '❤️';
        console.log('Event liked!');
      } else {
        this.innerHTML = '❤';
        console.log('Event unliked!');
      }
    });
  });

  // Comment Button Functionality
  commentButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      // You can open a comment modal or redirect to event page
      console.log('Comment button clicked!');
      alert('Comment feature - Navigate to event details page');
      // Optional: Redirect to event page
      // window.location.href = 'event-details.html';
    });
  });

  // Smooth Scroll Animation for Liked Post Container
  const likedPostContainer = document.querySelector('.liked-post-container');
  
  if (likedPostContainer) {
    // Add scroll event listener for smooth scrolling effects
    likedPostContainer.addEventListener('scroll', function() {
      const scrollTop = this.scrollTop;
      const scrollHeight = this.scrollHeight - this.clientHeight;
      const scrollPercentage = (scrollTop / scrollHeight) * 100;
      
      // You can add visual feedback based on scroll position
      if (scrollPercentage > 80) {
        console.log('Near bottom - could load more events');
        // Optional: Implement infinite scroll or "Load More" functionality
      }
    });
  }

  // Optional: Remove Event Card (Unlike permanently)
  const eventCards = document.querySelectorAll('.event-card');
  eventCards.forEach(card => {
    card.addEventListener('dblclick', function() {
      const confirmRemove = confirm('Remove this event from liked posts?');
      if (confirmRemove) {
        removeEventCard(this);
      }
    });
  });

  // Keyboard Navigation (Optional Enhancement)
  document.addEventListener('keydown', function(e) {
    if (likedPostContainer) {
      // Scroll with arrow keys when focused on container
      if (e.key === 'ArrowDown') {
        likedPostContainer.scrollBy({ top: 100, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        likedPostContainer.scrollBy({ top: -100, behavior: 'smooth' });
      }
    }
  });

});

// ===== LOAD SAVED PROFILE DATA FROM LOCALSTORAGE =====
function loadSavedProfileData() {
  const savedProfile = localStorage.getItem('eventHiveProfile');
  
  if (savedProfile) {
    const profileData = JSON.parse(savedProfile);
    
    // Update profile display with saved data
    const usernameElement = document.querySelector('.username');
    const emailElement = document.querySelector('.email');
    const descriptionElement = document.querySelector('.description-box p');
    const coverPhotoElement = document.querySelector('.cover-photo img');
    const profilePicElement = document.querySelector('.profile-picture img');
    
    if (usernameElement && profileData.username) {
      usernameElement.textContent = profileData.username;
    }
    
    if (emailElement && profileData.email) {
      emailElement.textContent = profileData.email + ' (email)';
    }
    
    if (descriptionElement && profileData.description) {
      descriptionElement.textContent = profileData.description;
    }
    
    if (coverPhotoElement && profileData.coverPhoto) {
      coverPhotoElement.src = profileData.coverPhoto;
    }
    
    if (profilePicElement && profileData.profilePic) {
      profilePicElement.src = profileData.profilePic;
    }
    
    console.log('Profile data loaded and displayed');
  }
}

// ===== REMOVE EVENT CARD FUNCTION =====
function removeEventCard(card) {
  card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  card.style.opacity = '0';
  card.style.transform = 'scale(0.8)';
  
  setTimeout(() => {
    card.remove();
    console.log('Event card removed');
  }, 300);
}

// ===== LOAD MORE EVENTS FUNCTION (for future implementation) =====
function loadMoreEvents() {
  const container = document.querySelector('.liked-post-container');
  
  // Example: Create new event card dynamically
  const newCard = document.createElement('article');
  newCard.className = 'event-card';
  newCard.innerHTML = `
    <div class="event-image-placeholder"></div>
    <div class="event-card-footer">
      <span class="event-title">NEW TITLE</span>
      <div class="event-actions">
        <button class="like-btn" aria-label="Like">❤</button>
        <button class="comment-btn" aria-label="Comment">💬 Comment</button>
      </div>
    </div>
  `;
  
  container.appendChild(newCard);
  
  // Re-attach event listeners to new buttons
  const newLikeBtn = newCard.querySelector('.like-btn');
  const newCommentBtn = newCard.querySelector('.comment-btn');
  
  newLikeBtn.addEventListener('click', function(e) {
    e.preventDefault();
    this.classList.toggle('liked');
    this.innerHTML = this.classList.contains('liked') ? '❤️' : '❤';
  });
  
  newCommentBtn.addEventListener('click', function(e) {
    e.preventDefault();
    alert('Comment feature - Navigate to event details page');
  });
  
  // Double-click to remove
  newCard.addEventListener('dblclick', function() {
    const confirmRemove = confirm('Remove this event from liked posts?');
    if (confirmRemove) {
      removeEventCard(this);
    }
  });
  
  console.log('New event card loaded');
}

// ===== SAVE LIKED EVENTS TO LOCALSTORAGE (Optional) =====
function saveLikedEvents() {
  const likedCards = document.querySelectorAll('.event-card');
  const likedEvents = [];
  
  likedCards.forEach(card => {
    const title = card.querySelector('.event-title').textContent;
    const isLiked = card.querySelector('.like-btn').classList.contains('liked');
    const imageUrl = card.querySelector('.event-image-placeholder').style.backgroundImage;
    
    likedEvents.push({
      title: title,
      isLiked: isLiked,
      imageUrl: imageUrl
    });
  });
  
  localStorage.setItem('eventHiveLikedEvents', JSON.stringify(likedEvents));
  console.log('Liked events saved to localStorage');
}

// ===== LOAD LIKED EVENTS FROM LOCALSTORAGE (Optional) =====
function loadLikedEvents() {
  const savedLikedEvents = localStorage.getItem('eventHiveLikedEvents');
  
  if (savedLikedEvents) {
    const likedEvents = JSON.parse(savedLikedEvents);
    console.log('Loaded liked events:', likedEvents);
    
    // You can rebuild the event cards from this data
    // This is useful for persisting liked events across sessions
  }
}

// ===== AUTO-SAVE LIKED EVENTS ON CHANGE (Optional) =====
// Automatically save when user likes/unlikes
document.addEventListener('DOMContentLoaded', function() {
  const likeButtons = document.querySelectorAll('.like-btn');
  
  likeButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Save after a short delay
      setTimeout(() => {
        saveLikedEvents();
      }, 100);
    });
  });
});