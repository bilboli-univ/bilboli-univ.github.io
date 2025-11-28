const burgerBtn = document.getElementById("burgerBtn");
const navMenu = document.getElementById("navMenu");
const overlay = document.getElementById("navOverlay");

// Fonction pour synchroniser la hauteur du header
function syncHeaderHeight() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const h = header.offsetHeight; // hauteur réelle en px
  document.documentElement.style.setProperty('--header-height', `${h}px`);
}

// Exécuter au chargement et au resize
window.addEventListener('load', syncHeaderHeight);
window.addEventListener('resize', syncHeaderHeight);

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

// Dropdown desktop
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


