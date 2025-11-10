const slides = document.querySelector('.slides');
const dots = document.querySelectorAll('.dot');
const title = document.getElementById('hero-title');
const desc = document.getElementById('hero-desc');
const heroBtn = document.getElementById('hero-btn');
let index = 0;

const heroData = [
  {
    img: "images/.jpg",
    title: "EduTech Summit: Shaping the Future of Learning",
    desc: "sd",
    btnText: "Know More",
    btnLink: "#find-events"
  },
  {
    img: "images/event2.jpg",
    title: "Intellect Unlocked: A Symposium on Modern Education",
    desc: "sd",
    btnText: "Know More",
    btnLink: "#find-events"
  },
  {
    img: "images/event3.jpg",
    title: "ThesisCon: Presenting Ideas that Matter.",
    desc: "sd",
    btnText: "Know More",
    btnLink: "#find-events"
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
    heroBtn.href = heroData[index].btnLink;

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
