// Get elements
const joinUsLink = document.querySelector('a[href="#join-us"]');
const joinUsModal = document.getElementById('joinUsModal');
const closeModalBtn = document.getElementById('closeModalBtn');

// Open modal
joinUsLink.addEventListener('click', function(e) {
  e.preventDefault();
  joinUsModal.classList.add('active');
});

// Close modal (X button)
closeModalBtn.addEventListener('click', function() {
  joinUsModal.classList.remove('active');
});

// Close modal when clicking outside the modal container (overlay)
joinUsModal.addEventListener('click', function(e) {
  if (e.target === joinUsModal) {
    joinUsModal.classList.remove('active');
  }
});

// Close modal with ESC key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && joinUsModal.classList.contains('active')) {
    joinUsModal.classList.remove('active');
  }
});
