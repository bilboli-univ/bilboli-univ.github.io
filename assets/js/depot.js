// depot.js (version corrigée - compat v8 CDN)
// Prérequis : inclure firebase-app.js, firebase-auth.js, firebase-storage.js, firebase-firestore.js, firebase-functions.js

// ---------- éléments DOM ----------
const uploadBtn = document.getElementById("uploadBtn");
const uploadInput = document.getElementById("uploadFile");
const uploadStatus = document.getElementById("uploadStatus");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");

// Sécurité : vérifier existence des éléments
if (uploadBtn) uploadBtn.addEventListener("click", () => uploadInput && uploadInput.click());
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
  if (idr.claims && idr.claims.admin) {
    const adminArea = document.getElementById("admin-area");
    if (adminArea) adminArea.style.display = "block";
    await loadAdminFiles();
    setupDownloadAllButton();
  } else {
    const studentArea = document.getElementById("student-area");
    if (studentArea) studentArea.style.display = "block";
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
          const progress = totalSize ? (uploadedBytes / totalSize) * 100 : 0;
          if (progressBar) progressBar.style.width = progress + "%";
        },
        error => {
          if (uploadStatus) uploadStatus.textContent = "❌ Erreur : " + (error.message || error);
          reject(error);
        },
        () => {
          uploadedCount++;
          resolve();
          if (uploadedCount === files.length) {
            if (uploadStatus) uploadStatus.textContent = `✅ ${uploadedCount} fichier(s) envoyé(s) avec succès !`;
            setTimeout(() => {
              if (progressContainer) progressContainer.style.display = "none";
              if (progressBar) progressBar.style.width = "0%";
            }, 1500);
          }
        }
      );
    });

    uploadPromises.push(p);
  }

  try {
    await Promise.all(uploadPromises);
    return { success: true, count: files.length };
  } catch (err) {
    console.error('Erreur upload:', err);
    throw err;
  }
}

// ---------- ADMIN ----------
async function loadAdminFiles() {
  const storageRef = firebase.storage().ref("uploads");
  try {
    const res = await storageRef.listAll();
    const container = document.getElementById("adminFiles");
    if (!container) return;
    container.innerHTML = "";

    for (const folder of res.prefixes) {
      const files = await folder.listAll();
      for (const fileRef of files.items) {
        try {
          const url = await fileRef.getDownloadURL();
          const fileName = fileRef.name.toLowerCase();

          const div = document.createElement("div");
          div.className = "admin-file";

          let preview = "";
          if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png")) {
            preview = `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" class="preview-img" alt="preview"></a>`;
          } else if (fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm")) {
            preview = `<a href="${url}" target="_blank" rel="noopener"><video class="preview-video" controls><source src="${url}" type="video/mp4"></video></a>`;
          } else {
            preview = `<p>(Aperçu non disponible)</p>`;
          }

          div.innerHTML = `${preview}<p>${fileRef.name}</p><a href="${url}" target="_blank" rel="noopener">Voir</a><button onclick="deleteFile('${fileRef.fullPath}')">Supprimer</button>`;
          container.appendChild(div);
        } catch (e) {
          console.warn('Erreur lecture fichier admin', fileRef.fullPath, e);
        }
      }
    }
  } catch (e) {
    console.error('Erreur listAll admin:', e);
  }
}

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

function setupDownloadAllButton() {
  const btn = document.getElementById("downloadAllBtn");
  if (!btn) return;
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

// ---------- STUDENT ----------
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

    for (const fileRef of res.items) {
      try {
        const url = await fileRef.getDownloadURL();
        const fileName = fileRef.name.toLowerCase();

        const div = document.createElement("div");
        div.className = "student-file";

        let previewHtml = "";
        if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png") || fileName.endsWith(".gif")) {
          previewHtml = `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" class="preview-img" alt="preview" style="max-width:200px;margin:6px;"></a>`;
        } else if (fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm")) {
          previewHtml = `<a href="${url}" target="_blank" rel="noopener"><video class="preview-video" controls style="max-width:300px;margin:6px;"><source src="${url}" type="video/mp4"></video></a>`;
        } else {
          previewHtml = `<p>(Aperçu non disponible)</p>`;
        }

        div.innerHTML = `${previewHtml}<p>${fileRef.name}</p><a href="${url}" target="_blank" rel="noopener">Voir</a>`;
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
  if (!user) return;
  try {
    await ensureClaimThenLoad();
  } catch (e) {
    console.error('Erreur init après auth:', e);
  }
});
