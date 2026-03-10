# Runtime Python embarque (Windows)

Ce projet est configure pour lancer le serveur local uniquement avec un Python embarque situe ici :

- `runtime\python\python.exe`

## Installation du runtime (a faire une seule fois dans le depot)

1. Telecharger le package officiel **Windows embeddable package (64-bit)** depuis python.org  
   Exemple compatible teste pour ce projet : Python `3.12.x` (`python-3.12.x-embed-amd64.zip`).
2. Extraire le contenu du zip dans `runtime\python\` (pas de sous-dossier supplementaire).
3. Verifier la presence de:
   - `runtime\python\python.exe`
   - `runtime\python\python312.zip` (ou equivalent selon version)
   - `runtime\python\python312._pth` (ou equivalent selon version)
4. Lancer `runtime\configure_embedded_python.bat` pour valider/ajuster le fichier `._pth`.

## Lancement

- Double-clic sur `lauch.bat`

Le script n'utilise ni `python` global, ni `py`, ni autre installation externe.
