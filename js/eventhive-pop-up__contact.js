const contactLink = document.querySelector('a[href="#contact"]');
const contactModal = document.getElementById('contactModal');
const closeModalBtn = document.getElementById('closeModalBtn');

contactLink.addEventListener('click', function(e) {
  e.preventDefault();
  contactModal.classList.add('active');
});

closeModalBtn.addEventListener('click', function() {
  contactModal.classList.remove('active');
});

contactModal.addEventListener('click', function(e) {
  if (e.target === contactModal) {
    contactModal.classList.remove('active');
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && contactModal.classList.contains('active')) {
    contactModal.classList.remove('active');
  }
});