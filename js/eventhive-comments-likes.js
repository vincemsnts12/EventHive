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
function renderComment(comment) {
  const commentItem = document.createElement('div');
  commentItem.className = 'comment-item';
  commentItem.setAttribute('data-comment-id', comment.id);
  commentItem.setAttribute('data-user-id', comment.userId);

  const profileUrl = `eventhive-profile.html?user=${comment.user.id}`;
  
  commentItem.innerHTML = `
    <a href="${profileUrl}" class="comment-avatar">
      <img src="${comment.user.avatarUrl || 'images/prof_default.svg'}" alt="${comment.user.fullName || comment.user.username}">
    </a>
    <div class="comment-content">
      <div class="comment-header">
        <a href="${profileUrl}" class="comment-author">${comment.user.fullName || comment.user.username}</a>
        <span class="comment-timestamp">${formatRelativeTime(comment.createdAt)}</span>
      </div>
      <p class="comment-text">${escapeHtml(comment.content)}</p>
    </div>
  `;

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

  // Render comments
  if (result.comments.length === 0) {
    commentsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No comments yet. Be the first to comment!</div>';
  } else {
    result.comments.forEach(comment => {
      commentsList.appendChild(renderComment(comment));
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
  if (!likeButton) return;

  // Check if user is authenticated
  const { success, user } = await getCurrentUser();
  if (!success || !user) {
    alert('Please log in to like events.');
    return;
  }

  // Disable button temporarily
  likeButton.disabled = true;
  likeButton.style.pointerEvents = 'none';

  const result = await toggleEventLike(eventId);

  if (result.success) {
    // Update button state
    if (result.liked) {
      likeButton.classList.add('active');
    } else {
      likeButton.classList.remove('active');
    }

    // Update like count
    await loadEventLikeCount(eventId);
  } else {
    alert(`Error: ${result.error}`);
  }

  // Re-enable button
  likeButton.disabled = false;
  likeButton.style.pointerEvents = 'auto';
}

// Initialize comments and likes for an event
async function initializeCommentsAndLikes(eventId) {
  if (!eventId) return;

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

  // Setup comment submit button
  const sendBtn = document.getElementById('commentSendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => handleCommentSubmit(eventId));
  }

  // Setup Enter key to submit comment (Shift+Enter for new line)
  const textarea = document.getElementById('commentTextarea');
  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCommentSubmit(eventId);
      }
    });
  }

  // Setup like button (if exists on this page)
  const likeButton = document.querySelector('.heart-btn, .like-btn');
  if (likeButton) {
    // Update initial state
    await updateLikeButtonState(eventId, likeButton);
    
    // Setup click handler
    likeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      handleLikeClick(eventId, likeButton);
    });
  }
}

