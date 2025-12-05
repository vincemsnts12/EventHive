// Utility function to enable horizontal scrolling on event titles when they overflow
(function() {
  function wrapTitleText(title) {
    // Check if already wrapped
    if (title.querySelector('.title-text')) {
      return title.querySelector('.title-text');
    }
    
    // Create mask box if it doesn't exist
    if (!title.querySelector('.title-mask')) {
      const maskBox = document.createElement('div');
      maskBox.className = 'title-mask';
      title.appendChild(maskBox);
    }
    
    // Wrap the text content in a span
    const text = title.textContent.trim();
    title.textContent = '';
    
    // Re-add the mask box
    const maskBox = document.createElement('div');
    maskBox.className = 'title-mask';
    
    const textSpan = document.createElement('span');
    textSpan.className = 'title-text';
    textSpan.textContent = text;
    
    title.appendChild(textSpan);
    title.appendChild(maskBox);
    
    return textSpan;
  }
  
  function setupTitleScrolling() {
    const titles = document.querySelectorAll('.event-title');
    
    titles.forEach(title => {
      // Wrap text content if not already wrapped
      const textSpan = wrapTitleText(title);
      
      // Check if text overflows the capsule container
      const containerWidth = title.clientWidth;
      const textWidth = textSpan.scrollWidth;
      const isOverflowing = textWidth > containerWidth;
      
      if (isOverflowing) {
        // Calculate scroll distance (how much to scroll to show full text)
        // Account for mask box width (20px on each side) - text should align with inner rectangle edges
        const maskWidth = 20; // Mask box width on each side
        const totalOffset = maskWidth * 2; // Total offset: 40px (20px left + 20px right)
        const scrollDistance = containerWidth - textWidth - totalOffset; // Negative value
        // Uniform speed: 50 pixels per second regardless of title length
        const pixelsPerSecond = 50;
        const scrollDuration = Math.abs(scrollDistance) / pixelsPerSecond;
        
        // Set CSS variables for animation on the title container
        title.style.setProperty('--scroll-distance', `${scrollDistance}px`);
        title.style.setProperty('--scroll-duration', `${scrollDuration}s`);
        
        // Find the parent event card
        const eventCard = title.closest('.event-card');
        
        function startScrolling() {
          title.classList.add('scrolling');
        }
        
        function stopScrolling() {
          title.classList.remove('scrolling');
          // Reset animation
          const textEl = title.querySelector('.title-text');
          if (textEl) {
            textEl.style.animation = 'none';
            // Force reflow to reset
            void textEl.offsetWidth;
            textEl.style.animation = '';
          }
        }
        
        if (eventCard) {
          // Desktop: Add scrolling class when hovering over the card
          eventCard.addEventListener('mouseenter', startScrolling);
          eventCard.addEventListener('mouseleave', stopScrolling);
          
          // Mobile: Add scrolling when user touches and holds the card
          let touchTimer = null;
          eventCard.addEventListener('touchstart', function(e) {
            // Start scrolling after a short delay (touch and hold)
            touchTimer = setTimeout(function() {
              startScrolling();
            }, 300); // 300ms delay for touch and hold
          }, { passive: true });
          
          eventCard.addEventListener('touchend', function(e) {
            // Clear the timer if user releases before hold completes
            if (touchTimer) {
              clearTimeout(touchTimer);
              touchTimer = null;
            }
            stopScrolling();
          }, { passive: true });
          
          eventCard.addEventListener('touchcancel', function(e) {
            // Clear timer on touch cancel
            if (touchTimer) {
              clearTimeout(touchTimer);
              touchTimer = null;
            }
            stopScrolling();
          }, { passive: true });
        } else {
          // Fallback: if no card parent, use title hover/touch
          title.addEventListener('mouseenter', startScrolling);
          title.addEventListener('mouseleave', stopScrolling);
          
          // Mobile touch support for title directly
          let touchTimer = null;
          title.addEventListener('touchstart', function(e) {
            touchTimer = setTimeout(function() {
              startScrolling();
            }, 300);
          }, { passive: true });
          
          title.addEventListener('touchend', function(e) {
            if (touchTimer) {
              clearTimeout(touchTimer);
              touchTimer = null;
            }
            stopScrolling();
          }, { passive: true });
          
          title.addEventListener('touchcancel', function(e) {
            if (touchTimer) {
              clearTimeout(touchTimer);
              touchTimer = null;
            }
            stopScrolling();
          }, { passive: true });
        }
      }
    });
  }
  
  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTitleScrolling);
  } else {
    setupTitleScrolling();
  }
  
  // Also run after dynamic content is added (for dynamically created cards)
  const observer = new MutationObserver(function(mutations) {
    setupTitleScrolling();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();

