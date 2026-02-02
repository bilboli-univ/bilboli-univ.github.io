// depot.js (version complète demandée)
// Compat v8 (CDN). Ne modifie pas loadAdminFiles visuellement — j'ai gardé ta version intacte.
// Prérequis : firebase-app.js, firebase-auth.js, firebase-storage.js, firebase-firestore.js, firebase-functions.js
// Assure-toi d'avoir inclus ton CSS existant (celui que tu préfères) ; ce script utilise les mêmes classes que ta version admin.

// ---------- éléments DOM ----------
const uploadBtn = document.getElementById("uploadBtn");
const uploadInput = document.getElementById("uploadFile");
const uploadStatus = document.getElementById("uploadStatus");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const adminArea = document.getElementById("admin-area");
const studentArea = document.getElementById("student-area");
const downloadAllBtn = document.getElementById("downloadAllBtn");

// Sécurité : attacher les écouteurs si les éléments existent
if (uploadBtn && uploadInput) uploadBtn.addEventListener("click", () => uploadInput.click());
if (uploadInput) uploadInput.addEventListener("change", uploadFile);

// ---------- utilitaires pour claims / callable ----------
async function waitForClaim(claimName, timeoutMs = 20000, intervalMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    await user.getIdToken(true);
    const claims = (await user.getIdTokenResult()).claims || {};
    if (claims[claimName] !== undefined) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

async function callSetUserClaim() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Utilisateur non connecté');

  // 1) tenter via SDK compat si disponible
  try {
    if (typeof firebase.functions === 'function') {
      const setUserClaim = firebase.functions().httpsCallable('setUserCleanEmailClaim');
      const res = await setUserClaim({});
      console.log('callable via SDK ok', res && res.data);
      return res && res.data;
    }
  } catch (err) {
    console.warn('SDK callable failed, fallback to fetch', err);
  }

  // 2) fallback : appel direct avec idToken
  const idToken = await user.getIdToken();
  const res = await fetch("https://europe-west1-findmeonphoto.cloudfunctions.net/setUserCleanEmailClaim", {
    method: "POST",
    headers: { "Authorization": "Bearer " + idToken, "Content-Type": "application/json" },
    body: JSON.stringify({ data: {} })
  });
  const text = await res.text();
  try { return JSON.parse(text).result || JSON.parse(text); } catch (e) { return text; }
}

async function ensureClaimThenLoad() {
  const user = firebase.auth().currentUser;
  if (!user) return false;

  // Forcer refresh et vérifier si claim déjà présente
  await user.getIdToken(true);
  let idr = await user.getIdTokenResult();
  if (idr.claims && idr.claims.cleanEmail) {
    console.log('Claim already present:', idr.claims.cleanEmail);
  } else {
    // appeler la callable pour poser la claim
    try {
      await callSetUserClaim();
    } catch (err) {
      console.warn('Erreur lors de l’appel callable:', err);
    }
    // attendre propagation
    const ok = await waitForClaim('cleanEmail', 20000, 1000);
    if (!ok) console.warn('Claim non reçue après attente');
    await user.getIdToken(true);
    idr = await user.getIdTokenResult();
    console.log('Claims after callable/refresh:', idr.claims);
  }

  // Charger l'UI selon rôle
  const claims = idr.claims || {};
  const isAdmin = !!claims.admin;

  // afficher / masquer zones
  if (isAdmin) {
    if (adminArea) adminArea.style.display = "block";
    if (studentArea) studentArea.style.display = "none";
    // activer bouton download all si présent
    if (downloadAllBtn) downloadAllBtn.style.display = "inline-block";
    // charger admin view
    await loadAdminFiles();
    setupDownloadAllButton();
  } else {
    if (studentArea) studentArea.style.display = "block";
    if (adminArea) adminArea.style.display = "none";
    if (downloadAllBtn) downloadAllBtn.style.display = "none";
    await loadStudentFiles();
  }
  return true;
}

// ---------- UPLOAD (attend la fin de tous les uploads) ----------
async function uploadFile() {
  const files = uploadInput && uploadInput.files;
  if (!files || files.length === 0) return;

  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Vous devez être connecté.");
    return;
  }

  // Récupérer cleanEmail depuis Firestore (source de vérité)
  const db = firebase.firestore();
  const userDoc = await db.collection("users").doc(user.uid).get();
  if (!userDoc.exists) {
    alert("Erreur : votre profil Firestore est manquant.");
    return;
  }
  const folderName = userDoc.data().cleanEmail;
  if (!folderName) {
    alert("Erreur : cleanEmail manquant dans Firestore.");
    return;
  }

  // S'assurer que le token contient la claim correspondante
  await user.getIdToken(true);
  const claims = (await user.getIdTokenResult()).claims || {};
  if (claims.cleanEmail !== folderName) {
    await callSetUserClaim().catch(e => console.warn(e));
    await waitForClaim('cleanEmail', 15000, 1000);
    await user.getIdToken(true);
  }

  // UI
  if (uploadStatus) uploadStatus.textContent = "";
  if (progressContainer) progressContainer.style.display = "block";

  let uploadedCount = 0;
  let totalSize = 0;
  let uploadedBytes = 0;
  const fileProgress = new Array(files.length).fill(0);
  for (let f of files) totalSize += f.size;

  const uploadPromises = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const storageRef = firebase.storage().ref(`uploads/${folderName}/${file.name}`);
    const metadata = { contentType: file.type };

    const p = new Promise((resolve, reject) => {
      const uploadTask = storageRef.put(file, metadata);

        uploadTask.on("state_changed",
            snapshot => {
                const current = snapshot.bytesTransferred;
                const diff = current - fileProgress[i];
                fileProgress[i] = current;

                uploadedBytes += diff;

                const progress = (uploadedBytes / totalSize) * 100;
                document.getElementById("progressBar").style.width = progress + "%";
            },
            error => {
                uploadStatus.textContent = "❌ Erreur : " + error.message;
            },
            () => {
                uploadedCount++;

                if (uploadedCount === files.length) {
                    uploadStatus.textContent = `✅ ${uploadedCount} fichier(s) envoyé(s) avec succès !`;

                    setTimeout(() => {
                        document.getElementById("progressContainer").style.display = "none";
                        document.getElementById("progressBar").style.width = "0%";
                    }, 1500);
                }
            }
        );
    })
}}


// ✅ AFFICHAGE ADMIN : PREVIEW + LECTURE VIDÉO + SUPPRESSION
async function loadAdminFiles() {
    const storageRef = firebase.storage().ref("uploads");
    const container = document.getElementById("adminFiles");
    container.innerHTML = "";

    const root = await storageRef.listAll();

    // 1) Récupérer toutes les promesses de fichiers
    const allFilePromises = root.prefixes.map(async folder => {
        const files = await folder.listAll();

        return Promise.all(
            files.items.map(async fileRef => {
                const url = await fileRef.getDownloadURL();
                const fileName = fileRef.name.toLowerCase();

                let preview = "";

                if (/\.(jpg|jpeg|png)$/i.test(fileName)) {
                    preview = `
                        <a href="${url}" target="_blank">
                            <img src="${url}" loading="lazy" class="preview-img">
                        </a>
                    `;
                } else if (/\.(mp4|mov|webm)$/i.test(fileName)) {
                    preview = `
                        <a href="${url}" target="_blank">
                            <video class="preview-video" controls preload="metadata">
                                <source src="${url}">
                            </video>
                        </a>
                    `;
                } else {
                    preview = `<p>(Aperçu non disponible)</p>`;
                }

                return `
                    <div class="admin-file">
                        ${preview}
                        <p>${fileRef.name}</p>
                        <a href="${url}" target="_blank">Voir</a>
                        <button onclick="deleteFile('${fileRef.fullPath}')">Supprimer</button>
                    </div>
                `;
            })
        );
    });

    // 2) Attendre toutes les promesses en parallèle
    const allResults = await Promise.all(allFilePromises);

    // 3) Aplatir et injecter dans le DOM en une seule fois
    container.innerHTML = allResults.flat().join("");
}


// ---------- SUPPRESSION (vérifie admin côté client avant suppression) ----------
async function deleteFile(path) {
    const user = firebase.auth().currentUser;
    if (!user) {
      alert("Vous devez être connecté pour supprimer un fichier.");
      return;
    }

    // Forcer refresh pour s'assurer des claims
    await user.getIdToken(true);
    const claims = (await user.getIdTokenResult()).claims || {};
    if (!claims.admin) {
      alert("Accès refusé : vous n'êtes pas administrateur.");
      return;
    }

    if (!confirm("Supprimer ce fichier ?")) return;

    const fileRef = firebase.storage().ref(path);

    try {
      await fileRef.delete();
      alert("✅ Fichier supprimé");
      // recharger la liste admin
      if (typeof loadAdminFiles === 'function') loadAdminFiles();
    } catch (err) {
      alert("❌ Erreur : " + (err.message || err));
    }
}

// ---------- TÉLÉCHARGER TOUT LE DOSSIER UPLOADS EN ZIP ----------
function setupDownloadAllButton() {
    const btn = document.getElementById("downloadAllBtn");
    if (!btn) return;
    btn.removeEventListener("click", downloadAllUploads);
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

// ---------- STUDENT (affiche dans le même style que admin, sans bouton supprimer) ----------
async function loadStudentFiles() {
  const user = firebase.auth().currentUser;
  if (!user) {
    console.log("Aucun utilisateur connecté");
    return;
  }

  // Forcer refresh token et récupérer claim
  try {
    await user.getIdToken(true);
  } catch (e) {
    console.warn('getIdToken(true) failed', e);
  }
  const idr = await user.getIdTokenResult();
  let folderName = idr.claims && idr.claims.cleanEmail;

  if (!folderName) {
    // fallback : Firestore si présent
    try {
      const db = firebase.firestore();
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (userDoc.exists) folderName = userDoc.data().cleanEmail;
    } catch (e) {
      console.warn('Erreur lecture Firestore pour folderName', e);
    }
  }

  if (!folderName) {
    console.warn('folderName introuvable pour l\'utilisateur');
    const container = document.getElementById("studentFiles");
    if (container) container.innerHTML = "<p>Impossible de déterminer votre dossier. Contactez un administrateur.</p>";
    return;
  }

  const folderPath = `uploads/${folderName}`;
  const userFolderRef = firebase.storage().ref(folderPath);

  try {
    const res = await userFolderRef.listAll();
    const container = document.getElementById("studentFiles");
    if (!container) return;
    container.innerHTML = "";

    // On affiche les fichiers avec la même structure/classes que pour l'admin,
    // mais sans bouton Supprimer.
    for (const fileRef of res.items) {
      try {
        const url = await fileRef.getDownloadURL();
        const fileName = fileRef.name.toLowerCase();

        const div = document.createElement("div");
        // utiliser la même classe que l'admin pour conserver le style
        div.className = "admin-file";

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

        // Pas de bouton supprimer pour l'étudiant, juste le nom et le lien "Voir"
        div.innerHTML = `
          ${preview}
          <p>${fileRef.name}</p>
          <a href="${url}" target="_blank">Voir</a>
        `;

        container.appendChild(div);
      } catch (e) {
        console.error("Erreur getDownloadURL pour", fileRef.fullPath, e);
      }
    }

    if (res.items.length === 0) {
      container.innerHTML = "<p>Aucun fichier trouvé dans votre dossier.</p>";
    }
  } catch (err) {
    console.error("Erreur listAll pour", folderPath, err);
    if (err.code === 'storage/unauthorized' || err.code === 'storage/forbidden') {
      console.warn("Accès refusé. Vérifie les règles Storage et la présence de la claim cleanEmail.");
    }
  }
}

// ---------- AUTH STATE (UNIQUE handler) ----------
firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    // masquer zones si déconnecté
    if (adminArea) adminArea.style.display = "none";
    if (studentArea) studentArea.style.display = "none";
    if (downloadAllBtn) downloadAllBtn.style.display = "none";
    return;
  }
  try {
    await ensureClaimThenLoad();
  } catch (e) {
    console.error('Erreur init après auth:', e);
  }
});
