async function registerStudent() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email.endsWith("@etu.umontpellier.fr")) {
    alert("Seules les adresses étudiantes @etu.umontpellier.fr sont autorisées.");
    firebase.auth().signOut();
    return;
  }

  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Nettoyer l'email pour créer le nom du dossier
    const cleanEmail = email.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Enregistrer dans Firestore
    const db = firebase.firestore();
    await db.collection("users").doc(user.uid).set({
      email: email,
      cleanEmail: cleanEmail
    });

    // Envoyer email de vérification
    await user.sendEmailVerification();
    alert("Un email de vérification vous a été envoyé.");

    // Appeler la Cloud Function callable pour poser la claim côté serveur
    const setUserClaim = firebase.functions().httpsCallable('setUserCleanEmailClaim');
    try {
      const result = await setUserClaim({});
      console.log('Callable result', result.data);
    } catch (err) {
      console.warn('Erreur appel callable setUserCleanEmailClaim', err);
      // On continue quand même : la claim peut être posée par un trigger serveur différent
    }

    // Attendre la présence de la claim (polling) puis rafraîchir le token et mettre à jour l'UI
    const claimFound = await waitForClaim('cleanEmail', 20000, 1500); // 20s timeout
    if (claimFound) {
      await refreshAndApplyClaimsToUI(); // fonction fournie précédemment
      console.log('Claim cleanEmail détectée et UI mise à jour');
    } else {
      // fallback : forcer un refresh et continuer
      await refreshAndApplyClaimsToUI();
      console.warn('Claim non détectée après attente, UI mise à jour sans claim');
    }

  } catch (error) {
    alert(error.message);
  }
}



function loginStudent() {
  const email = document.getElementById("emailLogin").value;
  const password = document.getElementById("passwordLogin").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(async () => {
      const user = auth.currentUser;
      await user.reload(); // rafraîchit emailVerified

      if (!user.emailVerified) {
        alert("Veuillez vérifier votre email avant de vous connecter.");
        user.sendEmailVerification();
        alert("Un nouvel email de vérification vous a été renvoyé.");
        auth.signOut();
        return;
      }

      const redirect = localStorage.getItem("redirectAfterLogin");

      if (redirect) {
        localStorage.removeItem("redirectAfterLogin");
        window.location.href = redirect;
      } else {
        window.location.href = "/profil.html";
      }
    })
    .catch(error => alert(error.message));
}


function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider)
    .then(async result => {
      const user = result.user;
      const email = user.email;

      if (!email.endsWith("@etu.umontpellier.fr")) {
        alert("Seules les adresses étudiantes @etu.umontpellier.fr sont autorisées.");
        auth.signOut();
        return;
      }

      await user.reload();

      if (!user.emailVerified) {
        alert("Veuillez vérifier votre email avant de vous connecter.");
        user.sendEmailVerification();
        alert("Un email de vérification vous a été envoyé.");
        auth.signOut();
        return;
      }
    })
    .catch(error => alert(error.message));
}

// ✅ Déconnexion
function logout() {
  auth.signOut();
}

async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) return;

  if (!confirm("Voulez-vous vraiment supprimer votre compte ? Cette action est irréversible.")) {
    return;
  }

  try {
    const db = firebase.firestore();
    const cleanEmail = user.email.replace(/[^a-zA-Z0-9._-]/g, "_");

    // ✅ 1. Supprimer tous les fichiers dans Storage
    const folderRef = firebase.storage().ref(`uploads/${cleanEmail}`);
    const list = await folderRef.listAll();

    for (const fileRef of list.items) {
      await fileRef.delete();
    }

    // ✅ 2. Supprimer le document Firestore
    await db.collection("users").doc(user.uid).delete();

    // ✅ 3. Supprimer le compte Firebase Auth
    await user.delete();

    alert("Votre compte et toutes vos données ont été supprimés.");
    window.location.href = "/login.html";

  } catch (error) {
    if (error.code === "auth/requires-recent-login") {
      alert("Veuillez vous reconnecter pour confirmer la suppression de votre compte.");
      window.location.href = "/login.html";
    } else {
      alert("Erreur : " + error.message);
    }
  }
}
// Utilise le SDK compat (v8) comme dans ton code existant

// Force le refresh et retourne les claims
async function refreshTokenAndGetClaims() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error("Aucun utilisateur connecté");
  await user.getIdToken(true); // force refresh
  const idTokenResult = await user.getIdTokenResult();
  return idTokenResult.claims || {};
}

// Met à jour l'UI selon la présence de la claim cleanEmail (exemple)
async function refreshAndApplyClaimsToUI() {
  try {
    const claims = await refreshTokenAndGetClaims();
    const isAdmin = !!claims.admin;
    // Exemple d'UI : afficher/masquer zones
    document.getElementById("admin-area").style.display = isAdmin ? "block" : "none";
    document.getElementById("student-area").style.display = isAdmin ? "none" : "block";
    // Si tu veux charger les fichiers étudiants après refresh
    if (!isAdmin) await loadStudentFiles();
  } catch (err) {
    console.error("Erreur lors du refresh du token :", err);
  }
}

// Attend qu'une claim apparaisse (polling), retourne true si trouvée avant timeout
async function waitForClaim(claimName, timeoutMs = 15000, intervalMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const user = firebase.auth().currentUser;
      if (!user) return false;
      await user.getIdToken(true); // force refresh à chaque itération
      const claims = (await user.getIdTokenResult()).claims || {};
      if (claims[claimName] !== undefined) return true;
    } catch (err) {
      console.warn("Polling claim error:", err);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

