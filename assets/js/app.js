/* ============================
   FORCER LE TÉLÉCHARGEMENT
============================ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".download-btn");
  if (!btn) return;

  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();

  const url = btn.getAttribute("href");
  const filename = url.split("/").pop();

  fetch(url)
    .then(resp => resp.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    });
});

/* ============================
   UTIL : showPage / getSection
============================ */
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");
}

function getSectionFromCard(card) {
  return card.dataset.section || card.dataset.page || card.id || null;
}

function setQuerySection(section) {
  const url = new URL(window.location.href);
  url.searchParams.set('section', section);
  history.replaceState({}, '', url);
}

document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // Navigation / cartes (GARDER)
  // ============================
  document.querySelectorAll(".section-card").forEach(card => {
    card.addEventListener("click", () => {
      const section = getSectionFromCard(card);
      if (!section) return;
      const onGaleriePage = window.location.pathname.endsWith('galerie.html') ||
                             window.location.pathname.endsWith('/galerie') ||
                             window.location.pathname.endsWith('/');

      if (onGaleriePage) {
        showPage(section);
        setQuerySection(section);
      } else {
        window.location.href = `galerie.html?section=${encodeURIComponent(section)}`;
      }
    });
  });

  const params = new URLSearchParams(window.location.search);
  const sectionParam = params.get('section');
  if (sectionParam) {
    showPage(sectionParam);
  } else {
    showPage('gallery');
  }

  // ============================
  // Galerie + Lightbox (AJOUTER)
  // ============================
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox.querySelector(".lightbox-img");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const downloadBtn = lightbox.querySelector(".lightbox-download-btn");

  // Fermer la lightbox avec la croix
  closeBtn.addEventListener("click", () => {
    lightbox.style.display = "none";
  });

  // Fermer la lightbox en cliquant en dehors de l'image
  lightbox.addEventListener("click", e => {
    if (e.target === lightbox) lightbox.style.display = "none";
  });

  function initGallery(containerSelector, jsonPath, imgFolder) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const lazyObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          lazyObserver.unobserve(img);
        }
      });
    }, { rootMargin: "200px" });

    container.addEventListener("click", e => {
      const img = e.target.closest("img");
      if (!img) return;

      lightbox.style.display = "flex";
      lightboxImg.src = img.dataset.full;
      downloadBtn.href = img.dataset.full;
      downloadBtn.download = img.alt || "photo";
    });

    fetch(jsonPath)
      .then(resp => {
        if (!resp.ok) throw new Error("Impossible de charger le JSON");
        return resp.json();
      })
      .then(files => files.forEach(file => addPhoto(file)))
      .catch(err => console.error("Erreur JSON :", err));

    function addPhoto(file) {
      const thumbUrl = `${imgFolder}/${file.thumb}`;
      const fullUrl = `${imgFolder}/${file.full}`;

      const item = document.createElement("div");
      item.classList.add("photo-item");

      item.innerHTML = `
        <img data-src="${thumbUrl}" data-full="${fullUrl}" alt="${file.full}" loading="lazy">
        <a class="download-btn" href="${fullUrl}" download="${file.full}">Télécharger</a>
      `;

      const img = item.querySelector("img");
      lazyObserver.observe(img);
      container.appendChild(item);
    }
  }

  // Initialiser tes galeries
  initGallery("#truc .photo-grid", "assets/img/pour poster/pour poster.json", "assets/img/pour poster");
  initGallery("#wei .photo-grid", "assets/img/wei/wei.json", "assets/img/wei");
});

