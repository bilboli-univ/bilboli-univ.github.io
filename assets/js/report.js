// Ouvrir la modale
function openReportModal() {
  if (!window.currentPhotoReported) {
    alert("Erreur : aucune photo sélectionnée.");
    return;
  }

  document.getElementById("reportModal").classList.remove("hidden");
}

// Fermer la modale
function closeReportModal() {
  document.getElementById("reportModal").classList.add("hidden");
  document.getElementById("reportReason").value = "";
}

// Envoyer le signalement
function submitReport() {
  const reason = document.getElementById("reportReason").value.trim();
  const user = auth.currentUser;

  if (!reason) {
    alert("Merci d'expliquer la raison du signalement.");
    return;
  }

  if (reason.length < 5) {
    alert("Merci de donner une raison plus détaillée.");
    return;
    }

  if (!user) {
    alert("Vous devez être connecté pour signaler une photo.");
    return;
  }

  db.collection("reports").add({
    photo: {
    file: window.currentPhotoReported.file,
    fullPath: window.currentPhotoReported.fullPath,
    thumbPath: window.currentPhotoReported.thumbPath,
    absoluteUrl: window.currentPhotoReported.absoluteUrl
    },
    reason: reason,
    userEmail: user.email,
    date: new Date()
  })
  .then(() => {
    alert("Merci ! Votre signalement a été envoyé.");
    closeReportModal();
  })
  .catch(error => {
    alert("Erreur : " + error.message);
  });
}
