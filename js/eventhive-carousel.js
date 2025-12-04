const slidesTrack = document.querySelector('.slides-track');
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
let index = 0;
let autoSlideTimer;

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

// Initialize all slides with their content
function initSlides() {
  slides.forEach((slide, i) => {
    const bg = slide.querySelector('.slide-bg');
    const title = slide.querySelector('.hero-title');
    const desc = slide.querySelector('.hero-desc');
    const btn = slide.querySelector('.hero-btn');
    
    if (heroData[i]) {
      bg.style.backgroundImage = `url(${heroData[i].img})`;
      title.textContent = heroData[i].title;
      desc.textContent = heroData[i].desc;
      btn.textContent = heroData[i].btnText;
      btn.href = "eventhive-events.html";
      btn.onclick = function() {
        localStorage.setItem('selectedEventId', heroData[i].eventId);
      };
    }
  });
}

// Move to specific slide
function goToSlide(n) {
  index = (n + heroData.length) % heroData.length;
  
  // Move the track
  const translateX = -index * 33.333;
  slidesTrack.style.transform = `translateX(${translateX}%)`;
  
  // Update dots
  dots.forEach(dot => dot.classList.remove('active'));
  dots[index].classList.add('active');
}

// Function to reset auto-slide timer
function resetAutoSlideTimer() {
  clearInterval(autoSlideTimer);
  autoSlideTimer = setInterval(() => goToSlide(index + 1), 8000);
}

// Navigation buttons (reset timer on manual navigation)
document.querySelector('.prev').addEventListener('click', () => {
  goToSlide(index - 1);
  resetAutoSlideTimer();
});

document.querySelector('.next').addEventListener('click', () => {
  goToSlide(index + 1);
  resetAutoSlideTimer();
});

// Dots click (reset timer on manual navigation)
dots.forEach((dot, i) => dot.addEventListener('click', () => {
  goToSlide(i);
  resetAutoSlideTimer();
}));

// Initialize
initSlides();
goToSlide(0);

// Start auto slide
autoSlideTimer = setInterval(() => goToSlide(index + 1), 8000);
