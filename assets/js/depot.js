const uploadBtn = document.getElementById("uploadBtn");
const uploadInput = document.getElementById("uploadFile");
const uploadStatus = document.getElementById("uploadStatus");

uploadBtn.addEventListener("click", () => uploadInput.click());

uploadInput.addEventListener("change", uploadFile);

function uploadFile() {
    const file = uploadInput.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) {
        alert("Vous devez être connecté.");
        return;
    }

    const storageRef = firebase.storage().ref(`uploads/${user.uid}/${file.name}`);

    storageRef.put(file)
        .then(() => {
            uploadStatus.textContent = "✅ Fichier envoyé avec succès !";
        })
        .catch(err => {
            uploadStatus.textContent = "❌ Erreur : " + err.message;
        });
}

auth.onAuthStateChanged(async user => {
    if (!user) return;

    const token = await user.getIdTokenResult();

    if (token.claims.admin) {
        document.getElementById("admin-area").style.display = "block";
        loadAdminFiles();
    }
});

function loadAdminFiles() {
    const storageRef = firebase.storage().ref("uploads");

    storageRef.listAll().then(async res => {
        const container = document.getElementById("adminFiles");
        container.innerHTML = "";

        for (const folder of res.prefixes) {
            const files = await folder.listAll();

            files.items.forEach(async fileRef => {
                const url = await fileRef.getDownloadURL();

                const div = document.createElement("div");
                div.className = "admin-file";

                div.innerHTML = `
                    <p>${fileRef.name}</p>
                    <a href="${url}" target="_blank">Voir</a>
                    <button onclick="deleteFile('${fileRef.fullPath}')">Supprimer</button>
                `;

                container.appendChild(div);
            });
        }
    });
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
