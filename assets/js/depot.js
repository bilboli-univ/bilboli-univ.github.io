const uploadBtn = document.getElementById("uploadBtn");
const uploadInput = document.getElementById("uploadFile");
const uploadStatus = document.getElementById("uploadStatus");

uploadBtn.addEventListener("click", () => uploadInput.click());
uploadInput.addEventListener("change", uploadFile);

// ✅ UPLOAD AVEC contentType POUR OUVRIR LES VIDÉOS
function uploadFile() {
    const file = uploadInput.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) {
        alert("Vous devez être connecté.");
        return;
    }

    const storageRef = firebase.storage().ref(`uploads/${user.uid}/${file.name}`);

    const metadata = { contentType: file.type };

    storageRef.put(file, metadata)
        .then(() => {
            uploadStatus.textContent = "✅ Fichier envoyé avec succès !";
        })
        .catch(err => {
            uploadStatus.textContent = "❌ Erreur : " + err.message;
        });
}

// ✅ SI ADMIN → CHARGER LES FICHIERS
auth.onAuthStateChanged(async user => {
    if (!user) return;

    const token = await user.getIdTokenResult();

    if (token.claims.admin) {
        document.getElementById("admin-area").style.display = "block";
        loadAdminFiles();
        setupDownloadAllButton();
    }
});

// ✅ AFFICHAGE ADMIN : PREVIEW + LECTURE VIDÉO + SUPPRESSION
function loadAdminFiles() {
    const storageRef = firebase.storage().ref("uploads");

    storageRef.listAll().then(async res => {
        const container = document.getElementById("adminFiles");
        container.innerHTML = "";

        for (const folder of res.prefixes) {
            const files = await folder.listAll();

            files.items.forEach(async fileRef => {
                const url = await fileRef.getDownloadURL();
                const fileName = fileRef.name.toLowerCase();

                const div = document.createElement("div");
                div.className = "admin-file";

                let preview = "";

                if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png")) {
                    preview = `
                        <a href="${url}" target="_blank">
                            <img src="${url}" class="preview-img" alt="preview">
                        </a>
                    `;
                } 
                else if (fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm")) {
                    preview = `
                        <a href="${url}" target="_blank">
                            <video class="preview-video" controls>
                                <source src="${url}" type="video/mp4">
                            </video>
                        </a>
                    `;
                } 
                else {
                    preview = `<p>(Aperçu non disponible)</p>`;
                }

                div.innerHTML = `
                    ${preview}
                    <p>${fileRef.name}</p>
                    <a href="${url}" target="_blank">Voir</a>
                    <button onclick="deleteFile('${fileRef.fullPath}')">Supprimer</button>
                `;

                container.appendChild(div);
            });
        }
    });
}

// ✅ SUPPRESSION
function deleteFile(path) {
    if (!confirm("Supprimer ce fichier ?")) return;

    const fileRef = firebase.storage().ref(path);

    fileRef.delete()
        .then(() => {
            alert("✅ Fichier supprimé");
            loadAdminFiles();
        })
        .catch(err => alert("❌ Erreur : " + err.message));
}

// ✅ ✅ ✅ TÉLÉCHARGER TOUT LE DOSSIER UPLOADS EN ZIP
function setupDownloadAllButton() {
    const btn = document.getElementById("downloadAllBtn");
    btn.addEventListener("click", downloadAllUploads);
}

async function downloadAllUploads() {
    const zip = new JSZip();
    const rootRef = firebase.storage().ref("uploads");

    const rootFolders = await rootRef.listAll();

    for (const folder of rootFolders.prefixes) {
        const folderZip = zip.folder(folder.name);
        const files = await folder.listAll();

        for (const fileRef of files.items) {
            const url = await fileRef.getDownloadURL();
            const blob = await fetch(url).then(r => r.blob());

            folderZip.file(fileRef.name, blob);
        }
    }

    zip.generateAsync({ type: "blob" }).then(content => {
        saveAs(content, "uploads.zip");
    });
}
