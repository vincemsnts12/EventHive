// --- DOM ELEMENTS ---
const dropdownBtn = document.getElementById("dropdownCategoryBtn");
const dropdownContent = document.getElementById("dropdownContent");
const dropdownItems = dropdownContent.querySelectorAll("div");
const headerTitle = document.getElementById("dynamicHeader"); 
const eventCards = document.querySelectorAll(".event-card"); 

// Containers
const activeContainer = document.getElementById("activeEventsContainer");
const pastContainer = document.getElementById("pastEventsContainer");
const pastSection = document.getElementById("pastSection"); 

// State
let selectedColleges = [];

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    separateEvents(); // Sort events on load
});

// --- DROPDOWN TOGGLE ---
dropdownBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownContent.classList.toggle("show");
  dropdownBtn.querySelector(".arrow").classList.toggle("rotate");
});

// --- HANDLE DROPDOWN SELECTION ---
dropdownItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();

    const college = item.textContent.trim();

    // 1. Toggle Selection State
    if (selectedColleges.includes(college)) {
      selectedColleges = selectedColleges.filter((c) => c !== college);
      item.classList.remove("selected");
      item.style.backgroundColor = ""; 
      item.style.color = ""; 
    } else {
      selectedColleges.push(college);
      item.classList.add("selected");
      item.style.backgroundColor = "#d12b2e"; 
      item.style.color = "white";
    }

    // 2. Update Button Label
    if (selectedColleges.length === 0) {
      dropdownBtn.innerHTML = `Select Colleges <span class="arrow">&#9662;</span>`;
    } else {
      dropdownBtn.innerHTML = `Custom <span class="arrow">&#9662;</span>`;
    }

    // 3. Update UI
    updateHeader();
    filterCards();
  });
});

// --- SEPARATE ACTIVE VS PAST EVENTS ---
function separateEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ignore time

    eventCards.forEach(card => {
        const dateString = card.getAttribute("data-date");
        
        if (dateString) {
            const eventDate = new Date(dateString);

            if (eventDate < today) {
                // Past Event: Add overlay and move to past container
                if (!card.querySelector(".event-overlay")) {
                    const overlay = document.createElement("div");
                    overlay.className = "event-overlay";
                    overlay.innerText = "EVENT ENDED";
                    card.prepend(overlay);
                }

                pastContainer.appendChild(card);
                card.style.pointerEvents = "none";
                card.style.opacity = "0.7"; 

            } else {
                // Future Event: Keep in active container
                activeContainer.appendChild(card);
            }
        }
    });

    checkPastSectionVisibility();
}

// --- UPDATE HEADER TEXT ---
function updateHeader() {
    if (selectedColleges.length === 0) {
        headerTitle.textContent = "Up-and-Coming Events";
    } else if (selectedColleges.length === 1) {
        headerTitle.textContent = selectedColleges[0];
    } else {
        headerTitle.textContent = "Filtered Events"; 
    }
}

// --- FILTER CARDS ---
function filterCards() {
    eventCards.forEach(card => {
        const cardCategory = card.getAttribute("data-category");

        // Show if no selection or matches category
        if (selectedColleges.length === 0 || selectedColleges.includes(cardCategory)) {
            card.style.display = "block"; 
        } else {
            card.style.display = "none";  
        }
    });

    // Re-check visibility of past section after filtering
    checkPastSectionVisibility();
}

// --- TOGGLE PAST SECTION VISIBILITY ---
function checkPastSectionVisibility() {
    const visiblePastCards = Array.from(pastContainer.children).filter(card => {
        return card.style.display !== "none";
    });

    pastSection.style.display = visiblePastCards.length > 0 ? "block" : "none";
}

// --- CLOSE DROPDOWN ON OUTSIDE CLICK ---
window.addEventListener("click", (e) => {
  if (!dropdownBtn.contains(e.target) && !dropdownContent.contains(e.target)) {
    dropdownContent.classList.remove("show");
    dropdownBtn.querySelector(".arrow").classList.remove("rotate");
  }
});