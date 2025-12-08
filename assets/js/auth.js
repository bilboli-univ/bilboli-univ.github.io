// ✅ Inscription avec email étudiant
function registerStudent() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email.endsWith("@etu.umontpellier.fr")) {
    alert("Vous devez utiliser votre adresse étudiante @etu.umontpellier.fr");
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(() => alert("Compte créé avec succès !"))
    .catch(error => alert(error.message));
}

function loginStudent() {
  const email = document.getElementById("emailLogin").value;
  const password = document.getElementById("passwordLogin").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      // ✅ Vérifie si une page était demandée
      const redirect = localStorage.getItem("redirectAfterLogin");

      if (redirect) {
        localStorage.removeItem("redirectAfterLogin");
        window.location.href = redirect; // ✅ Retour à la page voulue
      } else {
        window.location.href = "/profil.html"; // ✅ fallback
      }
    })
    .catch(error => alert(error.message));
}

// ✅ Connexion Google
function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider)
    .then(result => {
      const email = result.user.email;
      if (!email.endsWith("@etu.umontpellier.fr")) {
        alert("Seules les adresses étudiantes @etu.umontpellier.fr sont autorisées.");
        auth.signOut();
      }
    })
    .catch(error => alert(error.message));
}

// ✅ Connexion Microsoft
function loginWithMicrosoft() {
  const provider = new firebase.auth.OAuthProvider('microsoft.com');

  auth.signInWithPopup(provider)
    .then(result => {
      const email = result.user.email;
      if (!email.endsWith("@etu.umontpellier.fr")) {
        alert("Seules les adresses étudiantes @etu.umontpellier.fr sont autorisées.");
        auth.signOut();
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

