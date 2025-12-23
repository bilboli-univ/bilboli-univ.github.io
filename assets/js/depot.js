const uploadBtn = document.getElementById("uploadBtn");
const uploadInput = document.getElementById("uploadFile");
const uploadStatus = document.getElementById("uploadStatus");

uploadBtn.addEventListener("click", () => uploadInput.click());
uploadInput.addEventListener("change", uploadFile);

async function uploadFile() {
  const files = uploadInput.files;
  if (!files || files.length === 0) return;

  // s'assurer que firebase et auth existent
  if (typeof firebase === "undefined" || typeof auth === "undefined") {
    alert("Erreur : Firebase ou l'authentification n'est pas initialisée.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Vous devez être connecté.");
    return;
  }

  // s'assurer que storage est disponible (défini dans firebase-config.js)
  const storage = (typeof window.storage !== "undefined")
    ? window.storage
    : (firebase.storage ? firebase.storage() : null);
  if (!storage) {
    alert("Erreur : le service Storage n'est pas initialisé.");
    return;
  }

  // récupérer cleanEmail depuis Firestore
  const db = firebase.firestore();
  const userDoc = await db.collection("users").doc(user.uid).get();
  if (!userDoc.exists) {
    alert("Erreur : votre profil Firestore est manquant.");
    return;
  }
  const folderName = userDoc.data().cleanEmail;

  // UI
  uploadStatus.textContent = "";
  document.getElementById("progressContainer").style.display = "block";

  let uploadedCount = 0;
  let totalSize = 0;
  let uploadedBytes = 0;
  const fileProgress = new Array(files.length).fill(0);
  for (let f of files) totalSize += f.size;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // construire la référence une seule fois et l'utiliser
    const storageRef = storage.ref(`uploads/${folderName}/${file.name}`);
    const metadata = { contentType: file.type };

    // logs de diagnostic
    console.log("auth.currentUser.uid:", user.uid);
    console.log("folderName (from Firestore):", folderName);
    console.log("file.name:", file.name);
    try {
      console.log("storageRef fullPath:", storageRef.fullPath);
    } catch (e) {
      console.warn("Impossible de lire storageRef.fullPath:", e);
    }

    // upload avec promesse pour pouvoir await et gérer erreurs proprement
    try {
      await new Promise((resolve, reject) => {
        const uploadTask = storageRef.put(file, metadata);

        uploadTask.on(
          "state_changed",
          snapshot => {
            const current = snapshot.bytesTransferred;
            const diff = current - fileProgress[i];
            fileProgress[i] = current;

            uploadedBytes += diff;
            const progress = (uploadedBytes / totalSize) * 100;
            const bar = document.getElementById("progressBar");
            if (bar) bar.style.width = progress + "%";
          },
          error => {
            console.error("Upload error:", error);
            uploadStatus.textContent = "❌ Erreur : " + (error.message || error);
            reject(error);
          },
          () => {
            uploadedCount++;
            resolve();
          }
        );
      });

      // si on arrive ici, le fichier est uploadé
      if (uploadedCount === files.length) {
        uploadStatus.textContent = `✅ ${uploadedCount} fichier(s) envoyé(s) avec succès !`;
        setTimeout(() => {
          const container = document.getElementById("progressContainer");
          const bar = document.getElementById("progressBar");
          if (container) container.style.display = "none";
          if (bar) bar.style.width = "0%";
        }, 1500);
      }
    } catch (err) {
      // erreur déjà loggée dans le handler, on continue avec les autres fichiers
      console.error("Échec de l'upload du fichier:", file.name, err);
    }
  }
}

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

// ✅ AFFICHAGE ÉTUDIANT : VOIR SES PROPRES FICHIERS
async function loadStudentFiles() {
    const user = auth.currentUser;
    if (!user) return;

    // ✅ Récupérer cleanEmail depuis Firestore (comme pour l’upload)
    const db = firebase.firestore();
    const userDoc = await db.collection("users").doc(user.uid).get();

    if (!userDoc.exists) {
        console.error("Profil Firestore manquant");
        return;
    }

    const folderName = userDoc.data().cleanEmail;
    const userFolder = firebase.storage().ref(`uploads/${folderName}/`);

    try {
        const res = await userFolder.listAll();
        const container = document.getElementById("studentFiles");
        container.innerHTML = "";

        for (const fileRef of res.items) {
            const url = await fileRef.getDownloadURL();
            const fileName = fileRef.name.toLowerCase();

            const div = document.createElement("div");
            div.className = "student-file";

            let preview = "";

            if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png")) {
                preview = `
                    <a href="${url}" target="_blank">
                        <img src="${url}" class="preview-img" alt="preview">
                    </a>
                `;
            } else if (fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm")) {
                preview = `
                    <a href="${url}" target="_blank">
                        <video class="preview-video" controls>
                            <source src="${url}" type="video/mp4">
                        </video>
                    </a>
                `;
            } else {
                preview = `<p>(Aperçu non disponible)</p>`;
            }

            div.innerHTML = `
                ${preview}
                <p>${fileRef.name}</p>
                <a href="${url}" target="_blank">Voir</a>
            `;

            container.appendChild(div);
        }

    } catch (error) {
        // ✅ Dossier inexistant = normal pour un nouvel utilisateur
        if (error.code === "storage/unauthorized" || error.code === "storage/object-not-found") {
            console.warn("Dossier inexistant, aucun fichier pour cet utilisateur.");
            return;
        }

        console.error("Erreur inattendue :", error);
    }
}

auth.onAuthStateChanged(async user => {
    if (!user) return;
    
    const token = await user.getIdTokenResult();

    if (token.claims.admin) {
        document.getElementById("admin-area").style.display = "block";
        loadAdminFiles();
        setupDownloadAllButton();
    } else {
        document.getElementById("student-area").style.display = "block";
        loadStudentFiles();
    }
});

