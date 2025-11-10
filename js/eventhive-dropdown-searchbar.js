const dropdownBtn = document.getElementById("dropdownCategoryBtn");
const dropdownContent = document.getElementById("dropdownContent");
const dropdownItems = dropdownContent.querySelectorAll("div");

let selectedColleges = [];

dropdownBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownContent.classList.toggle("show");
  dropdownBtn.querySelector(".arrow").classList.toggle("rotate");
});

dropdownItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();

    const college = item.textContent;

    // Toggle selection
    if (selectedColleges.includes(college)) {
      selectedColleges = selectedColleges.filter((c) => c !== college);
      item.classList.remove("selected");
    } else {
      selectedColleges.push(college);
      item.classList.add("selected");
    }

    // Update button text
    if (selectedColleges.length === 0) {
      dropdownBtn.innerHTML = `Select Colleges <span class="arrow">&#9662;</span>`;
    } else {
      dropdownBtn.innerHTML = `Custom <span class="arrow">&#9662;</span>`;
    }
  });
});

// Close dropdown when clicking outside
window.addEventListener("click", (e) => {
  if (!dropdownBtn.contains(e.target) && !dropdownContent.contains(e.target)) {
    dropdownContent.classList.remove("show");
    dropdownBtn.querySelector(".arrow").classList.remove("rotate");
  }
});
