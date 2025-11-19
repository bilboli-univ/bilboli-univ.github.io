/*
  gallery with persistent storage in IndexedDB
   - click "Ajouter une photo" -> choose file -> saved in DB
   - gallery shows all saved photos with Supprimer button
*/
(() => {
  const DB_NAME = 'FindMeOnPhotoDB';
  const STORE = 'photos';
  const DB_VERSION = 1;
  let editing = false;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function savePhoto(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const r = store.put(record);
      r.onsuccess = () => resolve(record);
      r.onerror = () => reject(r.error);
    });
  }

  async function deletePhoto(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const r = store.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  async function getAllPhotos() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const items = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) {
          items.push(cur.value);
          cur.continue();
        } else {
          // newest first
          items.sort((a,b) => b.ts - a.ts);
          resolve(items);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  }

  // UI helpers
  function createImgElemFromBlob(blob) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    img.onload = () => URL.revokeObjectURL(img.src);
    img.className = 'thumb';
    img.style.maxWidth = '160px';
    img.style.height = 'auto';
    img.style.borderRadius = '6px';
    return img;
  }

  function makeSlotElement(photoRecord, onDelete) {
    const wrap = document.createElement('div');
    wrap.className = 'photo-slot';
    wrap.style.display = 'inline-block';
    wrap.style.margin = '0.5rem';
    wrap.style.textAlign = 'center';
    wrap.style.verticalAlign = 'top';

    const img = createImgElemFromBlob(photoRecord.blob);
    wrap.appendChild(img);

    const name = document.createElement('div');
    name.textContent = photoRecord.name || photoRecord.id;
    name.style.fontSize = '0.9rem';
    name.style.marginTop = '0.4rem';
    wrap.appendChild(name);

    const btnBar = document.createElement('div');
    btnBar.style.marginTop = '0.4rem';
    btnBar.style.display = 'flex';
    btnBar.style.gap = '0.4rem';
    btnBar.style.justifyContent = 'center';

    // Delete button (hidden unless editing)
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn delete-photo-btn';
    del.textContent = 'Supprimer';
    del.style.display = editing ? 'inline-block' : 'none';
    del.addEventListener('click', async () => {
      if (!confirm('Supprimer cette photo ?')) return;
      await deletePhoto(photoRecord.id);
      onDelete();
    });
    btnBar.appendChild(del);

    wrap.appendChild(btnBar);
    return wrap;
  }

  async function renderGallery() {
    const gallery = document.getElementById('photoGallery');
    gallery.innerHTML = '';
    const photos = await getAllPhotos();
    if (!photos.length) {
      const hint = document.createElement('p');
      hint.textContent = 'Aucune photo. Clique sur "Ajouter une photo".';
      gallery.appendChild(hint);
      return;
    }
    photos.forEach(pr => {
      const slot = makeSlotElement(pr, renderGallery);
      gallery.appendChild(slot);
    });
  }

  function createHiddenFileInput() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    return inp;
  }

  // main wiring
  document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addPhotoBtn');
    const gallery = document.getElementById('photoGallery');
    const editBtn = document.getElementById('editProfileBtn');

    const hiddenInput = createHiddenFileInput();

    hiddenInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      hiddenInput.value = '';
      if (!f) return;
      if (!f.type.startsWith('image/')) {
        alert('Fichier non valide (image attendue).');
        return;
      }
      const id = 'photo_' + Date.now() + '_' + Math.floor(Math.random()*1e6);
      const rec = { id, name: f.name, blob: f, ts: Date.now() };
      await savePhoto(rec);
      await renderGallery();
    });

    addBtn.addEventListener('click', () => hiddenInput.click());

    editBtn.addEventListener('click', () => {
      editing = !editing;
      editBtn.textContent = editing ? 'Terminer' : 'Éditer le Profil';
      // re-render so delete buttons show/hide next to each photo
      renderGallery().catch(err => console.error(err));
    });

    // initial render
    renderGallery().catch(err => {
      console.error('Erreur gallery:', err);
      gallery.innerHTML = '<p>Impossible de charger les photos.</p>';
    });
  });
})();
