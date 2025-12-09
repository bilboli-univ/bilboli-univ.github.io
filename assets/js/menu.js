const burgerBtn = document.getElementById("burgerBtn");
const navMenu = document.getElementById("navMenu");
const overlay = document.getElementById("navOverlay");

// Fonction pour synchroniser la hauteur du header
function syncHeaderHeight() {
  const headerEl = document.querySelector('.site-header');
  if (!headerEl) return;
  const h = headerEl.offsetHeight; // hauteur réelle en px
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

// Gestion du scroll avec seuil de 200px
(() => {
  const headerEl = document.querySelector(".site-header");
  if (!headerEl) {
    console.warn("⚠️ Aucun élément .site-header trouvé !");
    return;
  }

  let lastScrollTop = 0;

  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;

    if (scrollTop > lastScrollTop && scrollTop > 200) {
      // On descend ET on a dépassé 200px
      headerEl.classList.add("hide");
    } else if (scrollTop < lastScrollTop && scrollTop > 200) {
      // On remonte ET on est encore au-delà de 200px
      headerEl.classList.remove("hide");
    } else if (scrollTop <= 300) {
      // En haut de la page → toujours visible
      headerEl.classList.remove("hide");
    }

    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  });
})();
