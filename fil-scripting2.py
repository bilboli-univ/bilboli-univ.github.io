import os
import json
from PIL import Image, ExifTags

dos = "test"

# Dossier source contenant les images originales
SRC = f"/home/basile/Pictures/{dos}"          # dossier d'entrée (original)
OUT_FULL = f"Project_bde/assets/img/{dos}/full"       # dossier sortie full
OUT_THUMB = f"Project_bde/assets/img/{dos}/thumb"     # dossier sortie thumb
JSON_PATH = f"Project_bde/assets/img/{dos}/photos.json"

# Création des dossiers si manquants
os.makedirs(OUT_FULL, exist_ok=True)
os.makedirs(OUT_THUMB, exist_ok=True)

# Extensions acceptées
EXT = (".jpg", ".jpeg", ".png", ".webp",)

# Liste finale
files_list = []

print("📸 Génération des miniatures...")


def auto_orient(img):
    try:
        for orientation in ExifTags.TAGS.keys():
            if ExifTags.TAGS[orientation]=='Orientation':
                break
        exif=dict(img._getexif().items())
        if exif[orientation] == 3:
            img=img.rotate(180, expand=True)
        elif exif[orientation] == 6:
            img=img.rotate(270, expand=True)
        elif exif[orientation] == 8:
            img=img.rotate(90, expand=True)
    except:
        pass
    return img


for filename in os.listdir(SRC):
    if not filename.lower().endswith(EXT):
        continue

    src_path = os.path.join(SRC, filename)

    # Enregistrer dans la liste JSON
    files_list.append(filename)

    # ---- FULL ----
    full_path = os.path.join(OUT_FULL, filename)
    if not os.path.exists(full_path):
        img = Image.open(src_path)
        img = auto_orient(img)
        img.save(full_path, quality=90)
        print(f"✨ FULL : {filename}")

    # ---- THUMB ----
    thumb_path = os.path.join(OUT_THUMB, filename)
    if not os.path.exists(thumb_path):
        img = Image.open(src_path)
        img = auto_orient(img)
        img.thumbnail((900, 900))       # max 900px de côté
        img.save(thumb_path, quality=70)
        print(f"🪄 THUMB : {filename}")

# ---- ÉCRITURE JSON ----
with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(files_list, f, indent=4)

print("\n🎉 Terminé !")
print(f"Full : {OUT_FULL}")
print(f"Thumb : {OUT_THUMB}")
print(f"JSON créé : {JSON_PATH}")
