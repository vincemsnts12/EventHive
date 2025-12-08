// ===== COMMENTS AND LIKES INTEGRATION WITH SUPABASE =====
// This file handles all comment and like functionality on the event details page

// Format timestamp to relative time (e.g., "2 hours ago", "1 day ago")
function formatRelativeTime(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now - time) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
}

// Render a single comment
function renderComment(comment, currentUserId = null) {
  const commentItem = document.createElement('div');
  commentItem.className = 'comment-item';
  commentItem.setAttribute('data-comment-id', comment.id);
  commentItem.setAttribute('data-user-id', comment.userId);

  // Get current user ID if not provided (guests will have null)
  if (!currentUserId) {
    try {
      currentUserId = localStorage.getItem('eventhive_last_authenticated_user_id');
      if (!currentUserId) {
        // Fallback: Try to get from auth token
        const supabaseAuthKeys = Object.keys(localStorage).filter(key => 
          (key.includes('supabase') && key.includes('auth-token')) || 
          (key.startsWith('sb-') && key.includes('auth-token'))
        );
        if (supabaseAuthKeys.length > 0) {
          const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
          if (authData?.access_token) {
            const payload = JSON.parse(atob(authData.access_token.split('.')[1]));
            currentUserId = payload.sub;
          }
        }
      }
    } catch (e) {
      // Ignore errors - guests will have currentUserId = null
    }
  }

  const profileUrl = `eventhive-profile.html?user=${comment.user.id}`;
  // Only show delete button if user is authenticated AND it's their own comment
  const isOwnComment = currentUserId && comment.userId === currentUserId;
  
  // Build delete button HTML if it's the user's own comment
  const deleteButtonHtml = isOwnComment ? `
    <button class="comment-delete-btn" data-comment-id="${comment.id}" title="Delete comment">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  ` : '';
  
  commentItem.innerHTML = `
    <a href="${profileUrl}" class="comment-avatar">
      <img src="${comment.user.avatarUrl || 'images/prof_default.svg'}" alt="${comment.user.fullName || comment.user.username}">
    </a>
    <div class="comment-content">
      <div class="comment-header">
        <div class="comment-header-left">
          <a href="${profileUrl}" class="comment-author">${comment.user.fullName || comment.user.username}</a>
          <span class="comment-timestamp">${formatRelativeTime(comment.createdAt)}</span>
        </div>
        ${deleteButtonHtml}
      </div>
      <p class="comment-text">${escapeHtml(comment.content)}</p>
    </div>
  `;

  // Add delete handler if it's the user's own comment
  if (isOwnComment) {
    const deleteBtn = commentItem.querySelector('.comment-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this comment?')) {
          const eventId = getSelectedEventId();
          if (eventId) {
            const result = await deleteComment(comment.id);
            if (result.success) {
              await loadEventComments(eventId);
            } else {
              alert(`Error deleting comment: ${result.error}`);
            }
          }
        }
      });
    }
  }

  return commentItem;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load and display comments for an event
async function loadEventComments(eventId) {
  const commentsList = document.getElementById('commentsList');
  const commentsCount = document.getElementById('commentsCount');
  
  if (!commentsList) return;

  // Show loading state
  commentsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">Loading comments...</div>';

  const result = await getEventComments(eventId);

  if (!result.success) {
    commentsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #B81E20;">Error loading comments: ${result.error}</div>`;
    return;
  }

  // Clear loading state
  commentsList.innerHTML = '';

  // Get current user ID for rendering (guests will have null, which is fine)
  let currentUserId = null;
  try {
    // Try to get user ID from localStorage (works for authenticated users)
    currentUserId = localStorage.getItem('eventhive_last_authenticated_user_id');
    if (!currentUserId) {
      // Fallback: Try to get from auth token
      const supabaseAuthKeys = Object.keys(localStorage).filter(key => 
        (key.includes('supabase') && key.includes('auth-token')) || 
        (key.startsWith('sb-') && key.includes('auth-token'))
      );
      if (supabaseAuthKeys.length > 0) {
        const authData = JSON.parse(localStorage.getItem(supabaseAuthKeys[0]));
        if (authData?.access_token) {
          const payload = JSON.parse(atob(authData.access_token.split('.')[1]));
          currentUserId = payload.sub;
        }
      }
    }
  } catch (e) {
    // Ignore errors - guests will have currentUserId = null, which is expected
    console.log('No authenticated user found (guest mode)');
  }

  // Render comments (works for both authenticated users and guests)
  if (result.comments.length === 0) {
    commentsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No comments yet. Be the first to comment!</div>';
  } else {
    result.comments.forEach(comment => {
      // Pass currentUserId (null for guests, user ID for authenticated users)
      commentsList.appendChild(renderComment(comment, currentUserId));
    });
  }

  // Update comment count
  if (commentsCount) {
    const count = result.comments.length;
    commentsCount.textContent = `${count} ${count === 1 ? 'comment' : 'comments'}`;
  } else {
    // Try alternative selector if ID doesn't exist
    const altCommentsCount = document.querySelector('.comments-count');
    if (altCommentsCount) {
      const count = result.comments.length;
      altCommentsCount.textContent = `${count} ${count === 1 ? 'comment' : 'comments'}`;
    }
  }
}

// Load and display like count for an event
async function loadEventLikeCount(eventId) {
  const likesCount = document.getElementById('likesCount');
  if (!likesCount) {
    // Try alternative selector if ID doesn't exist
    const altLikesCount = document.querySelector('.likes-count');
    if (!altLikesCount) return;
    altLikesCount.textContent = '0';
    return;
  }

  const result = await getEventLikeCount(eventId);

  if (result.success) {
    likesCount.textContent = result.count || 0;
  } else {
    console.error('Error loading like count:', result.error);
    likesCount.textContent = '0';
  }
}

// Update like button state (check if user has liked)
async function updateLikeButtonState(eventId, likeButton) {
  if (!likeButton) return;

  const result = await hasUserLikedEvent(eventId);

  if (result.success) {
    if (result.liked) {
      likeButton.classList.add('active');
    } else {
      likeButton.classList.remove('active');
    }
  }
}

// Handle comment submission
async function handleCommentSubmit(eventId) {
  const textarea = document.getElementById('commentTextarea');
  const sendBtn = document.getElementById('commentSendBtn');
  
  if (!textarea || !sendBtn) return;

  const content = textarea.value.trim();

  if (!content) {
    alert('Please enter a comment before posting.');
    return;
  }

  // Disable button and show loading state
  sendBtn.disabled = true;
  sendBtn.style.opacity = '0.6';
  sendBtn.style.cursor = 'not-allowed';

  const result = await createComment(eventId, content);

  if (result.success) {
    // Clear textarea
    textarea.value = '';
    
    // Reset character counter
    const counter = document.getElementById('charCounter');
    if (counter) {
      counter.textContent = '0/200';
      counter.classList.remove('warning', 'limit');
    }

    // Reload comments to show new one (this will also update comment count)
    await loadEventComments(eventId);
  } else {
    alert(`Error posting comment: ${result.error}`);
  }

  // Re-enable button
  sendBtn.disabled = false;
  sendBtn.style.opacity = '1';
  sendBtn.style.cursor = 'pointer';
}

// Handle like button click
async function handleLikeClick(eventId, likeButton) {
  console.log('handleLikeClick called - eventId:', eventId, 'likeButton:', likeButton);
  if (!likeButton) {
    console.error('handleLikeClick: No like button provided');
    return;
  }

  // Check if user is authenticated (using localStorage for consistency)
  let userId = null;
  try {
    userId = localStorage.getItem('eventhive_last_authenticated_user_id');
    console.log('handleLikeClick: User ID from localStorage:', userId);
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
          console.log('handleLikeClick: User ID from JWT:', userId);
        }
      }
    }
  } catch (e) {
    console.error('handleLikeClick: Error getting user ID:', e);
  }

  if (!userId) {
    console.log('handleLikeClick: User not authenticated');
    alert('Please log in to like events.');
    return;
  }

  console.log('handleLikeClick: User authenticated, proceeding with like toggle...');

  // Disable button temporarily
  likeButton.disabled = true;
  likeButton.style.pointerEvents = 'none';

  const result = await toggleEventLike(eventId);
  console.log('handleLikeClick: toggleEventLike result:', result);

  if (result.success) {
    // Update button state
    if (result.liked) {
      likeButton.classList.add('active');
      console.log('handleLikeClick: Event liked, button set to active');
    } else {
      likeButton.classList.remove('active');
      console.log('handleLikeClick: Event unliked, button set to inactive');
    }

    // Update like count
    await loadEventLikeCount(eventId);
  } else {
    console.error('handleLikeClick: Error toggling like:', result.error);
    alert(`Error: ${result.error}`);
  }

  // Re-enable button
  likeButton.disabled = false;
  likeButton.style.pointerEvents = 'auto';
}

// Track if comments/likes are already initialized to prevent duplicates
let commentsLikesInitialized = false;
let currentInitializedEventId = null;

// Initialize comments and likes for an event
async function initializeCommentsAndLikes(eventId) {
  if (!eventId) return;

  // Prevent duplicate initialization for the same event
  if (commentsLikesInitialized && currentInitializedEventId === eventId) {
    console.log('Comments and likes already initialized for event:', eventId);
    return;
  }

  // Reset if different event
  if (currentInitializedEventId !== eventId) {
    commentsLikesInitialized = false;
    currentInitializedEventId = eventId;
  }

  // Load comments
  await loadEventComments(eventId);

  // Load like count
  await loadEventLikeCount(eventId);

  // Update current user avatar
  const { success, user } = await getCurrentUser();
  if (success && user) {
    const profileResult = await getUserProfile(user.id);
    if (profileResult.success && profileResult.profile) {
      const avatarImg = document.getElementById('currentUserAvatar');
      if (avatarImg && profileResult.profile.avatar_url) {
        avatarImg.src = profileResult.profile.avatar_url;
      }
    }
  }

  // Setup comment submit button (only if not already set up)
  const sendBtn = document.getElementById('commentSendBtn');
  if (sendBtn && !sendBtn.hasAttribute('data-comment-listener-attached')) {
    sendBtn.addEventListener('click', () => handleCommentSubmit(eventId));
    sendBtn.setAttribute('data-comment-listener-attached', 'true');
  }

  // Setup Enter key to submit comment (Shift+Enter for new line)
  const textarea = document.getElementById('commentTextarea');
  if (textarea && !textarea.hasAttribute('data-comment-listener-attached')) {
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCommentSubmit(eventId);
      }
    });
    textarea.setAttribute('data-comment-listener-attached', 'true');
  }

  // Setup like button (if exists on this page)
  const likeButton = document.querySelector('.heart-btn, .like-btn, #eventLikeBtn');
  console.log('initializeCommentsAndLikes: Looking for like button, found:', likeButton);
  if (likeButton && !likeButton.hasAttribute('data-like-listener-attached')) {
    console.log('initializeCommentsAndLikes: Setting up like button for event:', eventId);
    // Update initial state
    await updateLikeButtonState(eventId, likeButton);
    
    // Setup click handler
    likeButton.addEventListener('click', (e) => {
      console.log('Like button clicked!');
      e.stopPropagation();
      e.preventDefault();
      handleLikeClick(eventId, likeButton);
    });
    likeButton.setAttribute('data-like-listener-attached', 'true');
    console.log('initializeCommentsAndLikes: Like button listener attached');
  } else if (!likeButton) {
    console.warn('initializeCommentsAndLikes: No like button found on page');
  } else {
    console.log('initializeCommentsAndLikes: Like button already has listener attached');
  }

  // Mark as initialized
  commentsLikesInitialized = true;
  currentInitializedEventId = eventId;
}

