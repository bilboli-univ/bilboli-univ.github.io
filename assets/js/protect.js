// ✅ Empêche le retour arrière de charger une page en cache
window.onpageshow = function(event) {
  if (event.persisted) {
    window.location.reload();
  }
};

// ✅ Masquer la page pendant la vérification
document.body.style.visibility = "hidden";

auth.onAuthStateChanged(user => {
  const loader = document.getElementById("loader");

  if (!user) {
    // ✅ Sauvegarde la page demandée
    localStorage.setItem("redirectAfterLogin", window.location.pathname);

    // ✅ Redirection vers login
    window.location.replace("/login.html");
  } else {
    // ✅ Affiche la page
    document.body.style.visibility = "visible";

    // ✅ Cache le loader
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 300);
  }
});
