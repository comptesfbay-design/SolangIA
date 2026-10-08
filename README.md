# Suivi chantier Solange — guide pas à pas

Application pour iPhone (une « web app » installée sur l'écran d'accueil) qui suit l'avancement du chantier pièce par pièce et lot par lot, **même sans connexion**.

> **À retenir :** tes données sont rangées **dans le téléphone uniquement**, pas sur internet.
> Pense à faire une **sauvegarde** régulièrement (Réglages → Exporter) et à la ranger dans iCloud Drive / Google Drive / OneDrive.

---

## 1. Essayer l'app sur le PC (facultatif)

1. Dans VS Code : menu **Terminal → Nouveau terminal**.
2. Tape `npm start`, puis Entrée.
3. Ouvre **http://localhost:8080** dans Edge ou Chrome.
4. Pour arrêter : clique dans le terminal, puis **Ctrl + C**.

Les données du PC sont **séparées** de celles de l'iPhone. Pour passer de l'un à l'autre : exporter une sauvegarde d'un côté, l'importer de l'autre.

## 2. Mettre l'app en ligne (GitHub Pages, gratuit)

L'iPhone a besoin d'une adresse internet en `https://` pour installer l'app. GitHub l'héberge gratuitement.

1. Va sur **github.com** et connecte-toi.
2. En haut à droite : **+** → **New repository**.
   - *Repository name* : `suivi-chantier`
   - Coche **Public** (obligatoire pour GitHub Pages gratuit — seul le *code* est public, **tes données restent dans ton téléphone**).
   - Clique **Create repository**.
3. Sur la page qui s'affiche, clique le lien **uploading an existing file**.
4. Ouvre le dossier `D:\IA\SolangIA` dans l'Explorateur Windows, sélectionne **tout son contenu** (Ctrl + A) et **glisse-le** dans la page GitHub. Les sous-dossiers (`js`, `icons`…) sont conservés.
5. En bas, clique **Commit changes** et attends la fin de l'envoi.
6. Va dans **Settings** (onglet du dépôt) → **Pages** (menu de gauche).
   - *Source* : **Deploy from a branch**
   - *Branch* : **main** et **/ (root)** → **Save**.
7. Attends 1 à 2 minutes et recharge la page : l'adresse s'affiche en haut, du type
   `https://TON-PSEUDO.github.io/suivi-chantier/`

## 3. Installer l'app sur l'iPhone

1. Ouvre l'adresse ci-dessus dans **Safari** (pas Chrome : seul Safari permet l'installation complète).
2. Touche le bouton **Partager** (carré avec une flèche vers le haut).
3. Fais défiler et choisis **Sur l'écran d'accueil**, puis **Ajouter**.
4. **Utilise toujours l'icône « Chantier »** de l'écran d'accueil. Sur iPhone, les données de l'icône et celles de Safari sont **séparées** : n'utilise pas l'app dans Safari.
5. Ouvre l'app une fois avec internet : elle se met en mémoire. Ensuite, elle fonctionne hors connexion.

## 4. Sauvegarder et restaurer

**Sauvegarder** : Réglages → **Exporter une sauvegarde** → **Enregistrer / partager le fichier** → **Enregistrer dans Fichiers** → choisis iCloud Drive (ou Google Drive, OneDrive…).

**Restaurer** : Réglages → **Importer une sauvegarde** → choisis le fichier `.json` dans l'app Fichiers.
Avant de remplacer quoi que ce soit, l'app fait automatiquement une **copie de sécurité**, visible dans Réglages → Copies de sécurité.

Un bandeau orange te le rappelle si ta dernière sauvegarde a plus de 7 jours.

## 5. Publier une nouvelle version

1. Change le numéro de version **à deux endroits, avec le même numéro** :
   - `js/version.js` → `VERSION = '0.1.1'`
   - `sw.js` → `const VERSION = '0.1.1'`
2. Dans le terminal : `npm test`. Tout doit être ✔ (le test signale un oubli de version ou de fichier).
3. Sur GitHub, dans ton dépôt : **Add file → Upload files** et glisse les fichiers modifiés, puis **Commit changes**.
4. Attends 1 à 2 minutes. Sur l'iPhone, ouvre l'app : un bandeau **« Nouvelle version disponible — Mettre à jour »** apparaît. Tu peux aussi passer par Réglages → **Rechercher une mise à jour**.

Une mise à jour **ne touche pas à tes données**. Si la structure de la base doit changer un jour, une copie de sécurité est faite automatiquement avant.

## 6. Tests automatiques

Dans le terminal : `npm test`. Ces tests vérifient le calcul d'avancement, la copie de structure entre pièces, la validation des sauvegardes, et la cohérence des versions.

## 7. Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page de l'app |
| `styles.css` | L'apparence (couleurs, tailles, mode sombre) |
| `js/app.js` | Les écrans et les actions |
| `js/model.js` | Les calculs et le modèle de lots par défaut (testés) |
| `js/db.js` | La base de données du téléphone (IndexedDB) et les copies de sécurité |
| `js/backup.js` | L'export et l'import des sauvegardes |
| `js/ui.js` | Les fenêtres, boutons et l'appui long |
| `sw.js` | Le fonctionnement hors connexion et les mises à jour |
| `manifest.webmanifest` | Ce qui rend l'app installable (nom, icône, plein écran) |
| `icons/` | Les icônes (régénérables avec `npm run icons`) |
| `scripts/` | Le serveur de test local et le générateur d'icônes |
| `tests/` | Les tests automatiques |

---

## Version 0.1.0 (V0) — à tester sur l'iPhone

**Ce qui est fait :** installation sur l'écran d'accueil, hors connexion, niveaux, pièces, lots et tâches pré-remplis, cases à cocher, statuts (appui long), commentaire par tâche, ajout rapide, organisation (déplacer, renommer, supprimer), modèle de lots modifiable, catégories libres, copie de structure entre pièces, finition peinture A/B/C, notes par pièce, tâches bloquées sur l'accueil, export et import JSON, copies de sécurité automatiques, rappel de sauvegarde, état du stockage, thème clair ou sombre, numéro de version et mises à jour.

**Pas encore fait (prévu) :**
- V1 : sous-tâches, photos, galerie, sauvegarde .zip avec les photos.
- V2 : jalons, dépendances, alertes, vue par lot, recherche.
- V3 : module électricité.

Le changement d'ordre des **tâches** n'est pas encore possible (seuls les niveaux, les pièces et les lots se déplacent).

### Checklist de test (dans l'ordre)

1. [ ] Installer l'app depuis Safari (§3) et l'ouvrir **depuis l'icône** : l'app s'ouvre en plein écran, sans barre Safari.
2. [ ] L'accueil affiche Sous-sol, RDC, R+1 et Combles avec leurs pièces.
3. [ ] Ouvrir « Séjour » : 8 lots s'affichent, le premier est déplié.
4. [ ] Cocher une tâche : la coche verte apparaît, et le compteur du lot et le % de la pièce augmentent.
5. [ ] Appui long (une demi-seconde) sur une tâche : le menu des statuts s'ouvre. Choisir « Bloqué », puis revenir à l'accueil : la tâche apparaît dans « Tâches bloquées ».
6. [ ] Toucher le texte d'une tâche : la fiche s'ouvre. Écrire un commentaire, Enregistrer : l'icône 💬 apparaît.
7. [ ] Ajouter une tâche avec le champ « Nouvelle tâche… » en haut d'un lot.
8. [ ] Choisir « Finition peinture : B », revenir à l'accueil : le badge « Finition B » apparaît à côté de la pièce.
9. [ ] Dans une pièce : « + Ajouter un lot » → « VMC ». Puis « Catégorie libre… » → « Menuiseries extérieures ».
10. [ ] « Copier la structure vers une autre pièce » → choisir une chambre, puis vérifier que les lots ajoutés y sont.
11. [ ] Accueil → **Organiser** : déplacer une pièce (↑ ↓), renommer un niveau, ajouter une pièce dans « Combles ».
12. [ ] Supprimer une pièce, puis aller dans Réglages → Copies de sécurité → **Restaurer** : la pièce revient.
13. [ ] Réglages → **Exporter une sauvegarde** → Enregistrer dans Fichiers → iCloud Drive. Le fichier est visible dans l'app Fichiers.
14. [ ] Cocher une tâche, puis Réglages → **Importer** le fichier de l'étape 13 : la tâche est de nouveau décochée.
15. [ ] Mettre l'iPhone en **mode Avion**, fermer complètement l'app (balayer vers le haut) et la rouvrir : elle fonctionne et les données sont là.
16. [ ] Réglages → Stockage : noter si « Stockage persistant » est sur ✅ ou ❌ (pour info).
17. [ ] Réglages → Thème : essayer Clair et Sombre, en extérieur au soleil et avec des gants.
