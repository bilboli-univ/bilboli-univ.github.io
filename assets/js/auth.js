// ✅ Inscription avec email étudiant
function registerStudent() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email.endsWith("@etu.umontpellier.fr")) {
    alert("Seules les adresses étudiantes @etu.umontpellier.fr sont autorisées.");
    auth.signOut();
    return;
  }

  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(async userCredential => {
      const user = userCredential.user;

      // ✅ Nettoyer l'email pour créer le nom du dossier
      const cleanEmail = email.replace(/[^a-zA-Z0-9._-]/g, "_");

      // ✅ Enregistrer dans Firestore
      const db = firebase.firestore();
      await db.collection("users").doc(user.uid).set({
        email: email,
        cleanEmail: cleanEmail
      });

      // ✅ Envoyer email de vérification
      user.sendEmailVerification()
        .then(() => alert("Email envoyé !"))
        .catch(err => alert("Erreur envoi email : " + err.message));

      alert("Un email de vérification vous a été envoyé.");
    })
    .catch(error => {
      alert(error.message);
    });
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

function deleteAccount() {
  const user = auth.currentUser;

  if (confirm("Voulez-vous vraiment supprimer votre compte ? Cette action est irréversible.")) {
    user.delete()
      .then(() => {
        alert("Votre compte a été supprimé.");
        window.location.href = "/login.html";
      })
      .catch(error => {
        if (error.code === "auth/requires-recent-login") {
          alert("Veuillez vous reconnecter pour confirmer la suppression de votre compte.");
          window.location.href = "/login.html";
        } else {
          alert("Erreur : " + error.message);
        }
      });
  }
}

