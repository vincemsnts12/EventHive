const slides = document.querySelector('.slides');
const dots = document.querySelectorAll('.dot');
const title = document.getElementById('hero-title');
const desc = document.getElementById('hero-desc');
const heroBtn = document.getElementById('hero-btn');
let index = 0;

const heroData = [
  {
    img: "images/carousel_1.jpg",
    title: "Mister and Miss TUP System 2025",
    desc: "A prestigious TUP-System wide pageant showcasing talent, beauty, and excellence from all TUP branches.",
    btnText: "Know More",
    eventId: "event-3"
  },
  {
    img: "images/carousel_4.jpg",
    title: "Battle of The Bands 2025",
    desc: "Who will take the crown? Watch the best bands from different colleges clash in an epic musical showdown!",
    btnText: "Know More",
    eventId: "event-4"
  },
  {
    img: "images/carousel_5.jpg",
    title: "GDGoC In4Session",
    desc: "Join us for the official GDGoC website launch and an exciting AI seminar for tech enthusiasts.",
    btnText: "Know More",
    eventId: "event-5"
  }
];

function showSlide(n) {
  // Loop index (so 0→1→2→0)
  index = (n + heroData.length) % heroData.length;

  // Fade out first
  slides.classList.add('fade-out');
  title.classList.add('fade-out');
  desc.classList.add('fade-out');
  heroBtn.classList.add('fade-out');

  setTimeout(() => {
    // Update background and text
    slides.style.backgroundImage = `url(${heroData[index].img})`;
    title.textContent = heroData[index].title;
    desc.textContent = heroData[index].desc;
    heroBtn.textContent = heroData[index].btnText;
    
    // Set up link to events page with event ID
    heroBtn.href = "eventhive-events.html";
    heroBtn.onclick = function() {
      localStorage.setItem('selectedEventId', heroData[index].eventId);
    };

    // Update dots
    dots.forEach(dot => dot.classList.remove('active'));
    dots[index].classList.add('active');

    // Fade in again
    slides.classList.remove('fade-out');
    title.classList.remove('fade-out');
    desc.classList.remove('fade-out');
    heroBtn.classList.remove('fade-out');
  }, 400);
}

// Navigation buttons
document.querySelector('.prev').addEventListener('click', () => showSlide(index - 1));
document.querySelector('.next').addEventListener('click', () => showSlide(index + 1));

// Dots click
dots.forEach((dot, i) => dot.addEventListener('click', () => showSlide(i)));

// Auto slide
setInterval(() => showSlide(index + 1), 8000);

// Initial load
showSlide(0);
