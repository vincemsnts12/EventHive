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
function renderComment(comment, currentUserId = null, flagInfo = {}) {
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

  const profileUrl = `eventhive-profile.html?uid=${comment.userId}`;
  const isGuest = !currentUserId;
  // Only show delete button if user is authenticated AND it's their own comment
  const isOwnComment = currentUserId && comment.userId === currentUserId;
  // Check if comment is hidden
  const isHidden = comment.is_hidden || comment.isHidden;

  // If hidden, show hidden message instead of normal content
  if (isHidden) {
    commentItem.classList.add('comment-item--hidden');
    commentItem.innerHTML = `
      <div class="comment-hidden-message">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>Comment has been automatically hidden because it appears to contain language that may violate our community guidelines (profanity/inappropriate content).</span>
      </div>
    `;
    return commentItem;
  }

  // Build action button HTML - delete for own, flag for others
  let actionButtonHtml = '';
  // Get flag info (passed from loadEventComments or default)
  const flagCount = (typeof flagInfo === 'object' && flagInfo.count) || 0;
  const userFlagged = (typeof flagInfo === 'object' && flagInfo.userFlagged) || false;

  if (isOwnComment) {
    // Delete button for own comments
    actionButtonHtml = `
      <button class="comment-delete-btn" data-comment-id="${comment.id}" title="Delete comment">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;
  } else if (currentUserId) {
    // Flag button for other users' comments (authenticated users only)
    // Show yellow filled flag if user has flagged, with count
    const flaggedClass = userFlagged ? 'comment-flag-btn--flagged' : '';
    const fillColor = userFlagged ? '#f59e0b' : 'none';
    const title = userFlagged ? 'You reported this comment (click to remove report)' : 'Report this comment';
    const countDisplay = flagCount > 0 ? `<span class="flag-count">${flagCount}</span>` : '';

    actionButtonHtml = `
      <button class="comment-flag-btn ${flaggedClass}" data-comment-id="${comment.id}" data-user-flagged="${userFlagged}" title="${title}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${fillColor}" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        ${countDisplay}
      </button>
    `;
  } else {
    // Guest needs to login to flag
    const countDisplay = flagCount > 0 ? `<span class="flag-count">${flagCount}</span>` : '';
    actionButtonHtml = `
      <button class="comment-flag-btn comment-flag-guest" data-comment-id="${comment.id}" title="Login to report this comment">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        ${countDisplay}
      </button>
    `;
  }

  // For guests, use # as href to prevent navigation, add data attribute for the real URL
  const avatarHref = isGuest ? '#' : profileUrl;
  const authorHref = isGuest ? '#' : profileUrl;

  commentItem.innerHTML = `
    <a href="${avatarHref}" class="comment-avatar" data-profile-url="${profileUrl}" data-user-id="${comment.userId}">
      <img src="${comment.user.avatarUrl || 'images/prof_default.svg'}" alt="${comment.user.username}">
    </a>
    <div class="comment-content">
      <div class="comment-header">
        <div class="comment-header-left">
          <a href="${authorHref}" class="comment-author" data-profile-url="${profileUrl}" data-user-id="${comment.userId}">${comment.user.username}</a>
          <span class="comment-timestamp">${formatRelativeTime(comment.createdAt)}</span>
        </div>
        ${actionButtonHtml}
      </div>
      <p class="comment-text">${escapeHtml(comment.content)}</p>
    </div>
  `;

  // Add click handlers for profile links (handle guest authentication)
  const avatarLink = commentItem.querySelector('.comment-avatar');
  const authorLink = commentItem.querySelector('.comment-author');

  function handleProfileClick(e) {
    const targetUrl = e.currentTarget.getAttribute('data-profile-url');

    // Check if user is currently authenticated
    let isAuthenticated = false;
    try {
      const authCache = JSON.parse(localStorage.getItem('eventhive_auth_cache') || '{}');
      isAuthenticated = authCache.state?.isLoggedIn === true;

      if (!isAuthenticated) {
        const userId = localStorage.getItem('eventhive_last_authenticated_user_id');
        isAuthenticated = userId && userId.length > 0;
      }

      if (!isAuthenticated) {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith('sb-') && key.includes('auth-token')) {
            const tokenData = JSON.parse(localStorage.getItem(key) || '{}');
            if (tokenData.access_token) {
              isAuthenticated = true;
              break;
            }
          }
        }
      }
    } catch (err) {
      isAuthenticated = false;
    }

    if (isAuthenticated) {
      // Authenticated user - navigate to profile
      window.location.href = targetUrl;
    } else {
      // Guest - prevent navigation, show login popup on current page
      e.preventDefault();
      e.stopPropagation();

      // Store the intended profile URL for redirect after login
      sessionStorage.setItem('eventhive_pending_profile_url', window.location.origin + '/' + targetUrl);

      // Show login popup
      const loginModal = document.getElementById('loginModal');
      if (loginModal) {
        loginModal.style.display = 'flex';
        console.log('Showing login popup for guest profile access. Redirect after login:', targetUrl);
      } else {
        alert('Please log in to view profiles.');
      }
    }
  }

  if (avatarLink) {
    avatarLink.addEventListener('click', handleProfileClick);
  }
  if (authorLink) {
    authorLink.addEventListener('click', handleProfileClick);
  }

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

  // Add flag button handler for other users' comments
  const flagBtn = commentItem.querySelector('.comment-flag-btn');
  if (flagBtn) {
    flagBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      // Check if guest - show simple alert (same behavior as liking/commenting)
      if (flagBtn.classList.contains('comment-flag-guest')) {
        alert('Please log in or sign up to report this comment.');
        return;
      }

      // Check if user has already flagged this comment
      const isAlreadyFlagged = flagBtn.dataset.userFlagged === 'true';

      if (isAlreadyFlagged) {
        // Unflag action - show confirmation
        if (confirm('Remove your report from this comment?')) {
          if (typeof unflagComment !== 'function') {
            console.error('unflagComment function not found');
            alert('Error: Unflag function not available. Please refresh the page.');
            return;
          }

          try {
            const result = await unflagComment(comment.id);
            console.log('Unflag result:', result);
            if (result.success) {
              alert('Your report has been removed.');
              // Reload comments to update UI
              const eventId = getSelectedEventId();
              if (eventId) {
                await loadEventComments(eventId);
              }
            } else {
              alert(result.error || 'Error removing report. Please try again.');
            }
          } catch (err) {
            console.error('Error unflagging comment:', err);
            alert('Error removing report: ' + err.message);
          }
        }
      } else {
        // Flag action - show confirmation
        if (confirm('Are you sure you want to report this comment for inappropriate content?')) {
          if (typeof flagComment !== 'function') {
            console.error('flagComment function not found');
            alert('Error: Flag function not available. Please refresh the page.');
            return;
          }

          try {
            const result = await flagComment(comment.id, 'User reported');
            console.log('Flag result:', result);
            if (result.success) {
              alert('Thank you for your report. We will review this comment.');
              // Reload comments to update UI
              const eventId = getSelectedEventId();
              if (eventId) {
                await loadEventComments(eventId);
              }
            } else {
              alert(result.error || 'Error reporting comment. Please try again.');
            }
          } catch (err) {
            console.error('Error flagging comment:', err);
            alert('Error reporting comment: ' + err.message);
          }
        }
      }
    });
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

  // Get flag info for all comments (batch query) - wrapped in try-catch to be defensive
  let flagInfo = {};
  if (result.comments.length > 0 && typeof getCommentsWithFlagInfo === 'function') {
    try {
      const commentIds = result.comments.map(c => c.id);
      const flagResult = await getCommentsWithFlagInfo(commentIds);
      if (flagResult && flagResult.success) {
        flagInfo = flagResult.flagInfo || {};
      }
    } catch (flagError) {
      // Log error but don't break comment loading
      console.warn('Could not load flag info (non-critical):', flagError);
      // Continue with empty flagInfo - comments will still render
    }
  }

  // Render comments (works for both authenticated users and guests)
  if (result.comments.length === 0) {
    commentsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No comments yet. Be the first to comment!</div>';
  } else {
    result.comments.forEach(comment => {
      // Get flag info for this comment
      const commentFlagInfo = flagInfo[comment.id] || { count: 0, userFlagged: false };
      // Pass currentUserId and flagInfo to renderComment
      commentsList.appendChild(renderComment(comment, currentUserId, commentFlagInfo));
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

  // Check for profanity before submitting
  if (typeof checkProfanity === 'function') {
    const profanityResult = checkProfanity(content);
    if (profanityResult.hasProfanity) {
      alert('Your comment contains language that may violate our community guidelines. Please revise your comment before submitting.');
      return;
    }
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

