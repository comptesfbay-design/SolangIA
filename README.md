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

**Sauvegarder** : Réglages → **Exporter une sauvegarde (.zip)** → **Enregistrer / partager le fichier** → **Enregistrer dans Fichiers** → choisis iCloud Drive (ou Google Drive, OneDrive…).
Le `.zip` contient **tout** : tâches, notes, photos et pièces jointes. Avec beaucoup de photos, il peut peser plusieurs centaines de Mo.

**Restaurer** : Réglages → **Importer une sauvegarde** → choisis le fichier `.zip` dans l'app Fichiers. Les anciennes sauvegardes `.json` de la V0 sont aussi acceptées, mais elles ne contiennent pas de photos.

Avant de remplacer quoi que ce soit, l'app prend ses précautions :
- elle fait une **copie de sécurité** des tâches et des pièces (Réglages → Copies de sécurité) ;
- elle envoie les photos et pièces jointes actuelles à la **corbeille** (Réglages → Corbeille), d'où tu peux les restaurer.

Une photo supprimée n'est jamais effacée tout de suite : elle va dans la **corbeille**. Elle n'est effacée définitivement que si tu touches « Vider la corbeille ».

Un bandeau orange te le rappelle si ta dernière sauvegarde a plus de 7 jours.

## 5. Publier une nouvelle version (avec GitHub Desktop)

1. Change le numéro de version **à deux endroits, avec le même numéro** :
   - `js/version.js` → `VERSION = '0.2.1'`
   - `sw.js` → `const VERSION = '0.2.1'`
2. Dans le terminal : `npm.cmd test`. Tout doit être ✔ (le test signale un oubli de version ou de fichier).
3. Ouvre **GitHub Desktop**. La liste des fichiers modifiés s'affiche à gauche.
4. En bas à gauche, écris un résumé (ex. « V1 : photos »), clique **Commit to main**, puis **Push origin** en haut.
5. Attends 1 à 2 minutes. Sur l'iPhone, ouvre l'app : un bandeau **« Nouvelle version disponible — Mettre à jour »** apparaît. Tu peux aussi passer par Réglages → **Rechercher une mise à jour**.

Une mise à jour **ne touche pas à tes données**. Si la structure de la base change (comme en 0.2.0), une copie de sécurité est faite automatiquement avant.

## 6. Tests automatiques

Dans le terminal : `npm.cmd test`. Ces tests vérifient :
- le calcul d'avancement et les sous-tâches ;
- la copie de structure entre pièces et les notes ;
- la sauvegarde `.zip` (aller-retour complet) ;
- la cohérence des versions.

## 7. Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page de l'app |
| `styles.css` | L'apparence (couleurs, tailles, mode sombre) |
| `js/app.js` | Les écrans et les actions |
| `js/model.js` | Les calculs et le modèle de lots par défaut (testés) |
| `js/db.js` | La base de données du téléphone (IndexedDB) et les copies de sécurité |
| `js/backup.js` | L'export et l'import des sauvegardes |
| `js/zip.js` | Le contenu du fichier de sauvegarde .zip (testé) |
| `js/photos.js` | Compression des photos, galerie, visionneuse, pièces jointes |
| `js/ui.js` | Les fenêtres, boutons et l'appui long |
| `vendor/jszip.min.js` | JSZip 3.10.1 (licence MIT), copie locale pour fabriquer les .zip hors connexion |
| `sw.js` | Le fonctionnement hors connexion et les mises à jour |
| `manifest.webmanifest` | Ce qui rend l'app installable (nom, icône, plein écran) |
| `icons/` | Les icônes (régénérables avec `npm run icons`) |
| `scripts/` | Le serveur de test local et le générateur d'icônes |
| `tests/` | Les tests automatiques |

---

## Version 0.3.0 — avancement en %, courses et stock

**Avancement en %**
- Sur chaque tâche ou sous-tâche, choisis **0, 25, 50, 75 ou 100 %**. Deux façons de faire :
  - un **appui long** sur la tâche ;
  - dans sa fiche, la ligne « Avancement ».
- Le statut suit tout seul : 0 % = à faire, de 25 à 75 % = en cours, 100 % = fait.
- Les barres de la pièce, du niveau et de l'accueil en tiennent compte : une tâche à 50 % compte pour moitié.
- Une tâche qui a des sous-tâches calcule son avancement à partir d'elles, par exemple « 0/2 · 25 % ».

**Courses par lot**
- Dans chaque lot d'une pièce, ouvre **🛒 Courses du lot**. Tu peux y ajouter des articles de deux façons :
  - **📚 Choisir dans la bibliothèque** : coche les articles et ajuste les quantités ;
  - saisir un article à la main : nom, quantité et unité.
- Quand tu tapes un article déjà connu, l'app reprend son orthographe et son unité. Ça permet d'additionner correctement les quantités entre pièces.

**Onglet 🛒 Courses**
- **À acheter** : la synthèse de toutes les pièces, classée par lot, avec le stock déjà déduit. Exemple : « Plaque BA13 : Chambre 1 14 · Séjour 10, stock 5 → **19 u** ».
  - Coche un article quand il est acheté.
  - Touche-le pour voir le détail.
  - **📤 Partager la liste** l'envoie vers Notes, SMS, WhatsApp…
- **Achetés** : l'historique de tes achats. Touche la case d'un article pour le remettre à acheter.
- **Stock** : ce que tu as déjà (garage, cave…), avec les boutons − / + pour ajuster vite.
- Tu peux aussi ajouter un **article hors pièce** (consommables, outillage…).

**Modifier la bibliothèque** : Réglages → Modèle de lots → touche un lot, puis complète le champ « Bibliothèque d'articles ». Écris un article par ligne, sous la forme `Nom ; unité ; quantité habituelle`. L'unité et la quantité sont facultatives. Tu peux aussi y accéder depuis le bouton « ✏️ Modifier la bibliothèque » dans la fenêtre de choix.

### Checklist de test 0.3.0 (sur iPhone)

1. [ ] Mettre à jour : Réglages → Application doit afficher **0.3.0**, et tes données sont toujours là.
2. [ ] Appui long sur une tâche → **50 %**. Le badge « En cours · 50 % » apparaît et le % de la pièce augmente.
3. [ ] Dans une pièce → lot Cloisons → **🛒 Courses du lot** → **📚 Choisir dans la bibliothèque** : cocher 2 articles, mettre les quantités, puis toucher **Ajouter**.
4. [ ] Dans une autre pièce, taper « plaque ba13 » à la main : le nom se corrige tout seul en « Plaque BA13 », avec l'unité « u ».
5. [ ] Onglet **🛒 Courses** : les deux pièces sont additionnées.
6. [ ] Onglet Courses → **Stock** : ajouter quelques plaques. La quantité « à acheter » diminue d'autant.
7. [ ] **📤 Partager la liste** → l'envoyer dans Notes ou par SMS.
8. [ ] Au magasin, cocher un article acheté : il passe dans « Achetés ».

---

## Version 0.2.0 (V1) — à tester sur l'iPhone

**Ce qui est fait :**
- **Sous-tâches** : dans la fiche d'une tâche. Quand toutes les sous-tâches sont cochées, la tâche principale se coche toute seule. Cocher la tâche principale coche aussi toutes ses sous-tâches.
- **Photos** :
  - sur une tâche, ou sur la pièce (état initial / en cours / fini) ;
  - deux boutons : 📷 appareil photo et 🖼️ photothèque (plusieurs photos à la fois) ;
  - compression automatique : 1600 px, qualité 0,7, réglable dans Réglages → Photos ;
  - miniatures, légende et date.
- **Galerie** (onglet 📷 Photos) : filtres par pièce, par lot et par date. La visionneuse plein écran se parcourt en glissant le doigt, et permet de partager, modifier la légende ou supprimer.
- **Pièces jointes** par pièce : PDF et images de plans.
- **Notes de pièce** avec titres (`# Titre`) et listes (`- élément`).
- **Sauvegarde .zip complète** (export et import), poids total des photos, **corbeille**.

**Pas encore fait (prévu) :**
- V2 : jalons, dépendances, alertes, vue par lot, recherche.
- V3 : module électricité.

**Limites connues sur iPhone :**
- La date d'une photo est celle de son ajout dans l'app, pas celle de la prise de vue.
- Un PDF de plusieurs pages peut s'afficher incomplètement dans l'app. Dans ce cas, touche 📤 pour l'ouvrir ailleurs (Fichiers, Livres).

**Nouveau en 0.2.1 :** dans une pièce, **🧱 Choisir les lots de la pièce** affiche tous les lots sous forme de cases à cocher. Décoche ceux qui ne servent pas (ex. Plomberie dans l'escalier), puis touche **Appliquer**. Une copie de sécurité est faite avant, et tu peux recocher un lot plus tard pour le remettre.

### Checklist de test V1

> Les 17 tests de la V0 ont été déroulés automatiquement sur PC (18/18 réussis, avec le choix des lots). Sur iPhone, il reste à vérifier : l'installation depuis Safari, l'appareil photo, le mode avion, la lisibilité au soleil et avec des gants, et l'état du « stockage persistant ».

1. [ ] À l'ouverture, toucher **Mettre à jour** sur le bandeau. Réglages → Application doit afficher **0.2.0**. Tes tâches cochées sont toujours là, et une copie « Avant mise à jour de la base (v1 → v2) » apparaît dans Copies de sécurité.
2. [ ] Ouvrir une tâche → **Sous-tâches** : en ajouter 2. Les cocher toutes les deux, puis fermer : la tâche principale est cochée, et les sous-tâches apparaissent en retrait dans la pièce.
3. [ ] Dans la fiche d'une tâche : **📷 Prendre une photo**. L'appareil photo s'ouvre et la photo apparaît en miniature. La tâche affiche « 📷 1 » dans la pièce.
4. [ ] **🖼️ Photothèque** : choisir 3 photos d'un coup. Les 3 sont ajoutées.
5. [ ] Toucher une miniature : la photo s'ouvre en plein écran. **Glisser** vers la gauche ou la droite pour passer d'une photo à l'autre. ✏️ ajoute une légende.
6. [ ] Dans une pièce → **Photos de la pièce** : choisir « État initial » et ajouter une photo. Faire de même pour « Fini ».
7. [ ] Onglet **📷 Photos** : filtrer par pièce, puis par date. Les photos sont regroupées par jour.
8. [ ] Dans une pièce → **Pièces jointes** : ajouter un PDF depuis Fichiers, puis l'ouvrir. Si l'affichage est incomplet, 📤 permet de l'ouvrir ailleurs.
9. [ ] **Notes** : écrire `# Prises` puis `- 2 doubles` sur la ligne suivante, puis Enregistrer. Un titre et une liste s'affichent.
10. [ ] Supprimer une photo (🗑 dans la visionneuse), puis Réglages → **Corbeille** → Restaurer : elle revient.
11. [ ] Réglages → Photos : noter le poids total affiché.
12. [ ] Réglages → **Exporter une sauvegarde (.zip)** → Enregistrer dans Fichiers → iCloud Drive. Noter la taille du fichier.
13. [ ] Supprimer une photo, puis **Importer** le .zip de l'étape 12 : la photo est revenue.
14. [ ] Mode Avion, fermer l'app et la rouvrir : les photos s'affichent toujours, et l'export .zip fonctionne.

---

## Version 0.1.0 (V0) — à tester sur l'iPhone

**Ce qui est fait :** installation sur l'écran d'accueil, hors connexion, niveaux, pièces, lots et tâches pré-remplis, cases à cocher, statuts (appui long), commentaire par tâche, ajout rapide, organisation (déplacer, renommer, supprimer), modèle de lots modifiable, catégories libres, copie de structure entre pièces, finition peinture A/B/C, notes par pièce, tâches bloquées sur l'accueil, export et import JSON, copies de sécurité automatiques, rappel de sauvegarde, état du stockage, thème clair ou sombre, numéro de version et mises à jour.

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
9. [ ] Dans une pièce : « 🧱 Choisir les lots de la pièce » → cocher « VMC » → Appliquer. Puis « Créer une catégorie libre… » → « Menuiseries extérieures ».
10. [ ] « Copier la structure vers une autre pièce » → choisir une chambre, puis vérifier que les lots ajoutés y sont.
11. [ ] Accueil → **Organiser** : déplacer une pièce (↑ ↓), renommer un niveau, ajouter une pièce dans « Combles ».
12. [ ] Supprimer une pièce, puis aller dans Réglages → Copies de sécurité → **Restaurer** : la pièce revient.
13. [ ] Réglages → **Exporter une sauvegarde** → Enregistrer dans Fichiers → iCloud Drive. Le fichier est visible dans l'app Fichiers.
14. [ ] Cocher une tâche, puis Réglages → **Importer** le fichier de l'étape 13 : la tâche est de nouveau décochée.
15. [ ] Mettre l'iPhone en **mode Avion**, fermer complètement l'app (balayer vers le haut) et la rouvrir : elle fonctionne et les données sont là.
16. [ ] Réglages → Stockage : noter si « Stockage persistant » est sur ✅ ou ❌ (pour info).
17. [ ] Réglages → Thème : essayer Clair et Sombre, en extérieur au soleil et avec des gants.
