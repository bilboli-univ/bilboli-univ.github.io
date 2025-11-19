document.addEventListener("DOMContentLoaded", () => {

    const container = document.querySelector("#soiree_int .photo-grid");
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = lightbox.querySelector(".lightbox-img");
    const closeBtn = lightbox.querySelector(".lightbox-close");
    const downloadBtn = lightbox.querySelector(".lightbox-download-btn");

    // Lazy loading
    const lazyObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src; // charge miniature
                lazyObserver.unobserve(img);
            }
        });
    }, { rootMargin: "300px" });

    // Charger JSON
    fetch("../assets/img/soiree_int/photos.json")
        .then(r => r.json())
        .then(files => files.forEach(addPhoto));

    function addPhoto(file) {
        const item = document.createElement("div");
        item.classList.add("photo-item");

        const thumb = `../assets/img/soiree_int/thumb/${file}`;
        const full  = `../assets/img/soiree_int/full/${file}`;

        item.innerHTML = `
            <img data-src="${thumb}" data-full="${full}" alt="${file}">
            <a class="download-btn" href="${full}" download="${file}">Télécharger</a>
        `;

        const img = item.querySelector("img");

        // Lazy loading
        lazyObserver.observe(img);

        // Lightbox
        img.addEventListener("click", () => {
            lightbox.style.display = "flex";
            lightboxImg.src = img.dataset.full;
            downloadBtn.href = img.dataset.full;
            downloadBtn.download = file;
        });

        container.appendChild(item);
    }

    // Fermer lightbox
    closeBtn.addEventListener("click", () => lightbox.style.display = "none");
    lightbox.addEventListener("click", e => {
        if (e.target === lightbox) lightbox.style.display = "none";
    });
});
