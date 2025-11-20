// =====================================================
//  Galerie soiree_int — Virtualisation + Thumbnails
// =====================================================
(function initDanseGallery() {

    const container = document.querySelector("#soiree_int .photo-grid");
    if (!container) return;

    let photos = [];
    let photosPerBatch = 12;
    let batchIndex = 0;
    let loading = false;

    // Lightbox globale
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = lightbox.querySelector(".lightbox-img");
    const closeBtn = lightbox.querySelector(".lightbox-close");
    const downloadBtn = lightbox.querySelector(".lightbox-download-btn");

    closeBtn.addEventListener("click", () => (lightbox.style.display = "none"));
    lightbox.addEventListener("click", e => {
        if (e.target === lightbox) lightbox.style.display = "none";
    });

    // Charger JSON
    fetch("../../assets/img/soiree_int/photos.json")
        .then(r => r.json())
        .then(data => {
            photos = data;
            loadNextBatch();
        })
        .catch(err => console.error("Erreur JSON danse :", err));

    // Charger un batch de 12 photos
    function loadNextBatch() {
        if (loading) return;
        loading = true;

        const start = batchIndex * photosPerBatch;
        const end = Math.min(start + photosPerBatch, photos.length);
        const slice = photos.slice(start, end);

        slice.forEach(file => {
            const thumb = `../../assets/img/soiree_int/thumb/${file}`;
            const full  = `../../assets/img/soiree_int/full/${file}`;

            const item = document.createElement("div");
            item.className = "photo-item";

            item.innerHTML = `
                <img src="${thumb}" data-full="${full}" alt="${file}" loading="lazy">
                <a class="download-btn" href="${full}" download="${file}">Télécharger</a>
            `;

            const img = item.querySelector("img");

            // Lightbox
            img.addEventListener("click", () => {
                lightbox.style.display = "flex";
                lightboxImg.src = full;
                downloadBtn.href = full;
                downloadBtn.download = file;
            });

            container.appendChild(item);
        });

        batchIndex++;
        loading = false;
    }

    window.addEventListener("scroll", () => {
        const rect = container.getBoundingClientRect();
    
        // Lorsque le bas de la galerie approche du bas de l'écran
        if (rect.bottom < window.innerHeight + 300) {
            loadNextBatch();
        }
    });
    
})();
