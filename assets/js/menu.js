const burgerBtn = document.getElementById("burgerBtn");
const navMenu = document.getElementById("navMenu");
const overlay = document.getElementById("navOverlay");

if (burgerBtn && navMenu && overlay) {
  burgerBtn.addEventListener("click", () => {
    navMenu.classList.toggle("open");
    overlay.classList.toggle("show");
  });

  overlay.addEventListener("click", () => {
    navMenu.classList.remove("open");
    overlay.classList.remove("show");
  });
}

document.querySelectorAll(".dropdown > a").forEach(toggle => {
  toggle.addEventListener("click", (e) => {
    const parent = toggle.parentElement;
    const submenu = parent.querySelector(".dropdown-menu");

    if (submenu && window.innerWidth > 700) {
      e.preventDefault();
      parent.classList.toggle("open");
    }
  });
});

