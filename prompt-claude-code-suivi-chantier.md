# Prompt Claude Code — App iPhone « Suivi chantier Solange »

> À coller dans Claude Code (VS Code). Commence en **mode plan** (Shift+Tab ×2 ou `/plan`) : Claude Code doit proposer son plan et l'arborescence avant d'écrire du code.

---

## Contexte

Je rénove seul (une partie en DIY, notamment l'électricité) une maison de 1969 sur 3 niveaux + sous-sol. Je me perds entre les lots et les pièces. Je veux une application **utilisable sur iPhone, sur le chantier, hors connexion**, pour suivre l'avancement pièce par pièce et lot par lot.

Je développe sur **Windows (Surface Pro), sans Mac**. Pas de Xcode possible. Je ne veux pas payer de compte Apple Developer pour l'instant.

**Choix technique imposé : une PWA (Progressive Web App)** installée sur l'écran d'accueil de l'iPhone via Safari → « Partager » → « Sur l'écran d'accueil ».

- Pas de framework, **pas d'étape de build** : HTML + CSS + JavaScript vanilla (modules ES). Une lib externe est acceptable seulement si elle se charge depuis un CDN et qu'elle est mise en cache par le service worker (ex. pdf.js, JSZip). Justifie chaque dépendance.
- Fichiers attendus : `index.html`, `app.js` (ou quelques modules), `styles.css`, `sw.js`, `manifest.webmanifest`, `icons/`.
- Hébergement : GitHub Pages (HTTPS obligatoire pour le service worker). Ajoute un `README.md` qui m'explique pas à pas : création du repo, activation de Pages, installation sur l'iPhone, mise à jour de version.

## Contraintes iOS à traiter explicitement (ne pas les ignorer)

1. **Stockage** : toutes les données dans **IndexedDB** (pas localStorage, sauf préférences d'affichage). Au démarrage, appeler `navigator.storage.persist()` et afficher dans les réglages l'état `persisted()` + `navigator.storage.estimate()` (utilisé / quota).
2. `manifest.webmanifest` avec `"display": "standalone"` (le mode standalone conditionne le comportement de stockage des web apps d'écran d'accueil sur iOS).
3. **Photos** : compressées côté client avant stockage (canvas → JPEG, côté long max 1600 px, qualité ~0,7, paramétrable) + une miniature 300 px. Stockage en Blob dans IndexedDB. Afficher le poids total des photos.
4. **Sauvegarde obligatoire** car le stockage navigateur n'est pas une garantie : export complet en **.zip** (JSON des données + dossier photos + pièces jointes) via JSZip, et import/restauration du même .zip. Bandeau d'alerte si la dernière sauvegarde a plus de 7 jours. L'export doit passer par la feuille de partage iOS (`navigator.share` avec fichier si disponible, sinon téléchargement).
5. Prise de photo : `<input type="file" accept="image/*" capture="environment">` + possibilité de choisir dans la photothèque.
6. Interface pensée **pouce / gants / poussière** : cibles tactiles ≥ 44 px, contraste fort, mode sombre, pas de survol.
7. Pas de notifications push, pas de synchro cloud dans cette version.

## Modèle de données

```
Projet
 └─ Niveau (Sous-sol, RDC, R+1, Combles…)          — ordonnables, ajout/suppression
     └─ Pièce (Séjour, Cuisine, Suite parentale…)  — ordonnables, ajout/suppression
         └─ Lot / Catégorie (Électricité, Cloisons…) — modèle par défaut + catégories libres
             └─ Tâche (case à cocher)
                 └─ Sous-tâche (case à cocher) — profondeur 2 suffit
```

Chaque **tâche / sous-tâche** :
- `statut` : à faire / en cours / fait / bloqué (la case à cocher = fait ; appui long = autres statuts)
- `commentaire` (texte libre, multi-lignes)
- `photos[]` avec légende et date
- `date_fait` (horodatage automatique au cochage)
- `bloquant_avant` : jalon optionnel (ex. « avant fermeture placo », « avant ragréage », « avant peinture »)
- `dépend_de[]` : liens vers d'autres tâches (même dans une autre pièce)

Chaque **pièce** : notes particulières (texte riche simple : titres, listes), photos « état initial / en cours / fini », pièces jointes (PDF, images de plans).

## Modèle de lots par défaut (appliqué à chaque nouvelle pièce, modifiable)

Ordre = ordre logique de chantier :
1. Électricité — passage des gaines/boîtes
2. Plomberie
3. Cloisons / doublages
4. Plafonds
5. Bandes
6. Enduit
7. Peinture
8. Finition électricité (appareillage, raccordements, tests)

Pour chaque lot, propose 3 à 6 tâches génériques **éditables** (ex. Électricité : « boîtes posées », « gaines tirées », « photo des réseaux avant fermeture »). Je dois pouvoir :
- modifier le modèle global (s'applique aux nouvelles pièces) ;
- appliquer / retirer un lot sur une pièce ;
- dupliquer la structure d'une pièce vers une autre ;
- créer des catégories libres (ex. « VMC », « Menuiseries », « Sol / ragréage »).

## Écrans

1. **Accueil** : avancement global (%), par niveau, liste des **tâches bloquées** et des **jalons non tenus** (ex. une pièce où « Plafonds » est coché alors qu'une tâche marquée « avant fermeture placo » n'est pas faite → alerte).
2. **Vue pièce** : sections repliables par lot, barre de progression par lot, cases à cocher, ajout rapide de tâche (champ en haut de section).
3. **Vue lot transversale** : ex. « Bandes » dans toutes les pièces → ce qui reste à faire, pour planifier une journée.
4. **Fiche tâche** : statut, commentaire, photos, dépendances, jalon.
5. **Galerie photos** : filtrable par pièce / lot / date, plein écran avec glisser.
6. **Électricité / Tableaux** (voir ci-dessous).
7. **Réglages** : modèle de lots, sauvegarde/restauration, stockage, thème.
8. **Recherche** globale (tâches, commentaires, notes).

## Module Électricité — schéma et tableaux

Objectif : récupérer mon schéma de circuits et produire le **synoptique de chaque tableau** + les **étiquettes de repérage**.

Mon installation a **3 tableaux** : TGBT (sous-sol), TD-RDC, TD-R+1, reliés par des liaisons inter-tableaux.

### Import
- **CSV** (séparateur `;`, UTF-8, en-tête) — colonnes minimales : `tableau ; repere ; designation ; pieces_desservies ; section_mm2 ; calibre_A ; courbe ; differentiel ; type_diff ; nb_points ; remarque`.
  Fournis un fichier `exemple-circuits.csv` et un bouton « Télécharger le modèle CSV ».
- **JSON** (même structure).
- J'ai déjà un tableau HTML de circuits (colonnes `# | Circuit | Section | Disj. | Pièces desservies`) produit par un outil précédent : ajoute un import par **collage d'un tableau HTML ou texte tabulé** avec écran de correspondance des colonnes. **Ne devine pas le format : demande-moi un échantillon avant de coder ce parseur.**
- **Pièces jointes** : PDF / images du plan électrique (j'ai aussi un DXF → je l'exporterai en PDF ; pas de lecture DXF dans l'app).

### Édition
- Liste des circuits par tableau, édition en ligne.
- Regroupement des circuits sous leur interrupteur différentiel.
- Lien circuit ↔ pièces : depuis une pièce, voir les circuits qui la desservent ; depuis un circuit, voir les pièces.

### Contrôles (paramétrables, jamais codés en dur)
Les seuils sont des **paramètres modifiables dans les réglages**, avec un champ « source » où je saisis la référence normative. Valeurs initiales proposées, à me faire confirmer :
- nombre max de circuits par interrupteur différentiel ;
- nombre max de points par circuit selon type (prises 16 A, prises 20 A, éclairage) ;
- cohérence section ↔ calibre (table éditable).
L'app **signale** un écart, elle ne certifie rien. Affiche clairement « contrôle indicatif, ne remplace pas la NF C 15-100 ni un contrôle Consuel ».

### Sorties
- **Synoptique du tableau** : rangées de N modules (N paramétrable par coffret), chaque appareil occupant sa largeur en modules (paramétrable par type d'appareil), groupé sous son différentiel.
- **Étiquettes** imprimables : repère + désignation courte + pièces, format paramétrable (largeur module en mm), page A4 en impression navigateur.
- Export CSV / PDF (impression navigateur) du schéma.

## Données de démarrage (pré-remplir, tout reste éditable)

- Niveaux : Sous-sol, RDC, R+1, Combles.
- RDC : Séjour, Salon, Cuisine / salle à manger, Suite parentale, Salle d'eau suite parentale, Entrée / circulation, Escalier.
- R+1 : Chambre 1, Chambre 2, Chambre 3, Circulation, (salle d'eau à confirmer).
- Sous-sol : Local technique (TGBT), Escalier sous-sol.
- Tableaux : TGBT, TD-RDC, TD-R+1.
- Un champ « Finition peinture » par pièce avec les valeurs A / B / C (liste éditable).

## Méthode de travail attendue

1. Mode plan : propose l'architecture, le schéma IndexedDB (stores, index, versioning/migrations), la liste des écrans. Attends ma validation.
2. Livre par **incréments testables**, dans cet ordre :
   - V0 : squelette PWA installable + IndexedDB + niveaux/pièces/lots/tâches/cases + export/import JSON.
   - V1 : sous-tâches, commentaires, photos compressées, galerie, export .zip.
   - V2 : jalons, dépendances, alertes, vue lot transversale, recherche.
   - V3 : module Électricité (import CSV, édition, contrôles, synoptique, étiquettes).
3. À la fin de chaque incrément : liste de ce qui est fait, de ce qui ne l'est pas, et **checklist de test sur iPhone** (manipulations précises).
4. Tests : écris des tests unitaires simples (fonctions pures : calcul d'avancement, contrôles électriques, parseur CSV) exécutables avec `node --test`.
5. Versionne le cache du service worker et affiche le numéro de version dans les réglages ; une nouvelle version doit pouvoir être forcée sans perte de données.
6. **Ne jamais supprimer ou migrer des données sans sauvegarde préalable automatique.**
7. Si une exigence est ambiguë ou techniquement impossible sur iOS Safari, dis-le et propose une alternative au lieu de l'implémenter à moitié.
