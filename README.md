# Application de Gestion des Emplois du Temps

Application web 100% autonome (HTML/CSS/JS, aucune installation, aucun serveur requis)
pour créer, configurer et vérifier des emplois du temps universitaires avec détection
automatique des conflits.

## 🚀 Démarrage

1. Décompressez le fichier ZIP.
2. Ouvrez `index.html` dans un navigateur (Chrome, Edge, Firefox).
3. C'est prêt — l'application démarre avec des données de démonstration inspirées
   des emplois du temps fournis (Semestre 6, groupes 1-3, enseignants, modules...).

> 💡 Aucune connexion internet n'est nécessaire. Les données sont sauvegardées
> automatiquement dans le navigateur (localStorage). Utilisez **Import / Export**
> pour faire une sauvegarde externe (fichier `.json`) ou partager vos données.

## 🧭 Fonctionnalités

### 1. Configuration
- **Sessions** : le panneau **Configuration → Sessions** permet d’ajouter, d’ouvrir, de renommer et de supprimer une session. Une nouvelle session reprend les ressources et la configuration de la session active (jours, créneaux, salles, enseignants, modules, groupes, logo et informations d’en-tête). Les identifiants sont régénérés pour que les données puissent ensuite être modifiées indépendamment ; le planning et les affectations restent vides afin de permettre une nouvelle organisation. La suppression demande confirmation et la dernière session est protégée.
- **Logo de l'établissement** : importez une image (PNG, JPG ou SVG, 2 Mo max) depuis le panneau « Logo de l'établissement ». Il est repris automatiquement dans l'en-tête de tous les documents exportés/imprimés (PDF, vues par groupe/enseignant/salle) et dans les grilles Excel exportées (PNG/JPG/GIF uniquement pour Excel — le SVG reste utilisé pour l'écran et le PDF). Un bouton « 🗑️ Retirer le logo » permet de l'enlever.
- **Mise en forme des emplois du temps** : le panneau dédié configure, pour chaque élément d'en-tête, de grille et de pied de page, la police, la taille en points, le gras et les alignements horizontal et vertical. La largeur et la hauteur du logo et du cachet se règlent séparément en millimètres. Les valeurs sont enregistrées avec chaque session et s'appliquent aux aperçus imprimables et aux PDF.
- **Thème de couleurs personnalisé** : dans le panneau « Thème de couleurs personnalisé », choisissez les couleurs de fond de page, des titres, des créneaux, des jours, des séances, des actions éducatives, des textes et des bordures. Sélectionnez un groupe puis cliquez sur « Aperçu du thème » ; les changements de couleur se répercutent immédiatement sur l'aperçu. Le thème est enregistré par session et appliqué aux documents imprimés / PDF. Une option permet de préserver les couleurs distinctes des séances.
- **Éléments à afficher** : cochez ou décochez chaque élément (logo, cachet, titres et informations, en-têtes de créneaux/jours, module, enseignant, salle, groupes mutualisés, actions éducatives, pied de page) depuis le panneau de thème. Le choix est enregistré par session et appliqué aux plannings, aperçus et PDF.
- Choix libre des jours actifs (**du lundi au dimanche inclus**).
- Créneaux horaires entièrement configurables (heure de début/fin, libellé).
- Générateur automatique de grille de créneaux (heure de début, heure de fin,
  durée d'une séance, pause déjeuner).

### 2. Ressources
- Groupes (nom, semestre, effectif, salle par défaut).
- Salles (nom, capacité, type : salle normale ou amphithéâtre).
- Enseignants.
- Modules (avec volume horaire hebdomadaire indicatif).

#### Actions éducatives

Dans **Ressources → Groupes**, chaque groupe peut recevoir un seul jour d’Actions éducatives, ou rester sans jour défini. Le jour et le libellé sont modifiables manuellement. Le bouton d’attribution automatique complète uniquement les groupes sans choix manuel et conserve les jours déjà enregistrés. L’activité est extérieure à l’établissement : elle n’occupe aucune salle ni aucun enseignant et apparaît dans le planning du groupe et dans le PDF sous la forme d’une cellule fusionnée sur toute la journée. Le libellé par défaut est **ACTIONS ÉDUCATIVES**, mais il peut être remplacé par « Sortie pédagogique », « Stage pratique » ou toute autre expression non vide.

### 3. Planning par groupe
- Grille hebdomadaire interactive : cliquez sur une case vide pour créer une séance,
  cliquez sur une séance existante pour la modifier ou la supprimer.
- Une séance peut durer **1 ou plusieurs créneaux consécutifs**.
- Une séance peut être affectée à **plusieurs groupes en même temps**
  (ex : cours mutualisé en amphithéâtre) — cochez simplement plusieurs groupes
  dans le formulaire.
- Le même enseignant peut être affecté séparément à plusieurs groupes/modules
  à des horaires différents, sans limite.
- Dans le formulaire de séance ouvert depuis un groupe, la liste des modules est limitée au même semestre que ce groupe. La liste des groupes est ensuite limitée au même semestre et, lorsqu'elles sont définies, aux associations explicites du module.
- Dans « Nouvelle séance », choisir un module filtre les enseignants à ceux qui assurent ce module ; choisir un enseignant filtre inversement les modules à ceux qu'il assure (toujours dans le semestre du groupe ciblé). Après le choix de l'enseignant, seuls les jours comportant au moins une plage disponible assez longue pour la durée choisie sont proposés. Pour un groupe unique, la salle préaffichée est sa salle par défaut ; pour plusieurs groupes, l'amphi est proposé par défaut.

### 4. Disponibilités des enseignants
- Dans **Ressources → Enseignants**, cliquez sur **📅 Disponibilités** pour ouvrir
  une grille jour × créneau et marquer les moments où l'enseignant n'est **pas**
  disponible (rouge = indisponible, vert = disponible).
- Tous les créneaux sont **indisponibles par défaut**, y compris pour un nouvel enseignant et lors de l'ajout d'un jour ou d'un créneau ; l'utilisateur doit cliquer manuellement sur une case pour la rendre disponible.
- Ces disponibilités sont automatiquement prises en compte :
  - **avertissement immédiat** dans le formulaire de séance si vous essayez de
    placer un enseignant sur un créneau qu'il a déclaré indisponible ;
  - **conflit listé** dans l'onglet Conflits si une séance déjà planifiée tombe
    sur un créneau devenu indisponible.

### 4 bis. Disponibilités des salles
- Dans **Ressources → Salles**, cliquez sur **📅 Disponibilités** pour ouvrir la même
  grille jour × créneau, cette fois pour une salle (rouge = indisponible, vert = disponible).
- À l'inverse des enseignants, une salle est **toujours disponible par défaut** :
  une nouvelle salle, ou l'ajout d'un jour/créneau, n'ajoutent aucun blocage ; c'est
  seulement en cliquant sur une case qu'on la rend indisponible (ex : salle en travaux,
  réservée par un autre service, etc.).
- Ces disponibilités sont automatiquement prises en compte :
  - **conflit « Indisponibilité salle »** listé dans l'onglet Conflits si une séance
    déjà planifiée tombe sur un créneau devenu indisponible ;
  - la **planification automatique** (auto-scheduler) et la recherche d'une salle libre
    évitent les créneaux qu'une salle a déclarés indisponibles.
- Excel : la feuille **Salles** a une colonne **Indisponibilités** (même format que
  celle des enseignants : « Vendredi 1 », « Mardi (toute la journée) »… ; vide = toujours
  disponible), et l'export **Vue par salle** ajoute une feuille **Disponibilités**
  réimportable, comme pour la vue enseignant.

### 5. Planning par semestre — export groupé
- Nouvel onglet **📚 Planning par semestre**.
- Des boutons apparaissent automatiquement pour chaque semestre détecté parmi
  vos groupes (ex : Semestre 2, Semestre 4, Semestre 6).
- Cliquez sur un semestre : tous les groupes de ce semestre s'affichent à la
  suite, chacun dans une **grande page blanche au format A4 paysage** avec la
  **même mise en forme que les documents de référence**
  (bandeau jaune, titre "Emploi du temps provisoire session de...", année
  universitaire, filière/option, ligne "Semestre : X — Groupe : Y / Salle Z",
  mention "NB : Une journée entière sera consacré au travail éducatif", date du jour).
- Le bouton **🖨️ Exporter tous les groupes de ce semestre** imprime (ou
  enregistre en PDF) l'ensemble des grilles de ce semestre dans **un seul document**,
  une page par groupe.
- Les informations d'en-tête (type de session Automne/Printemps, statut
  provisoire/final, année, filière, option) se configurent dans
  **Configuration → Informations pour l'en-tête des documents exportés**.

### 6. Vue par enseignant / Vue par salle
- Visualisez la charge complète d'un enseignant ou l'occupation d'une salle
  sur toute la semaine.

### 7. Détection de conflits (temps réel)
Lors de la création/modification d'une séance, l'application vérifie automatiquement :
- **Conflit enseignant** : un enseignant ne peut pas donner deux séances différentes
  sur un créneau qui se chevauche (sauf si c'est *la même* séance mutualisée
  pour plusieurs groupes).
- **Conflit salle** : une salle ne peut pas accueillir deux séances distinctes
  en même temps.
- **Conflit groupe** : un groupe ne peut pas avoir deux séances simultanées.
- **Dépassement de capacité** : pour une séance mutualisée, la somme des effectifs
  des groupes ne doit pas dépasser la capacité de la salle.
- **Indisponibilité enseignant** : la séance tombe sur un créneau que l'enseignant
  a déclaré indisponible.
- **Indisponibilité salle** : la séance tombe sur un créneau que la salle
  a déclaré indisponible.

Un badge rouge dans le menu latéral indique le nombre de conflits actifs.
L'onglet **Conflits** liste tous les problèmes détectés avec leur détail.

### 8. Sessions multiples
Créez plusieurs sessions (ex : Semestre 2 / Semestre 4 / Semestre 6, Automne / Printemps)
via le sélecteur en bas de la barre latérale. Chaque session a sa propre configuration
de créneaux, ses ressources et son planning.

### 8. Enseignants (vue « 🗂️ Ressources » → onglet Enseignants)
- **📅 Disponibilités** : grille de créneaux disponible/indisponible par enseignant.
- **📚 Modules assurés** : par défaut un enseignant assure **tous les modules** (comme avant). La fenêtre classe les modules par semestre en deux rangées fixes : **1, 3, 5 en haut**, puis **2, 4, 6 en bas**. Chaque ligne présente l'intitulé et le nombre de groupes pris en charge. Ces quantités pilotent la répartition automatique des groupes ; la liste des modules détermine aussi qui apparaît dans les listes « Enseignant » des Affectations et de « Nouvelle séance ». Un enseignant retiré d'un module reste visible (avec un avertissement) sur une ligne où il était déjà affecté, pour ne pas casser silencieusement une affectation existante.

### 8 bis. Affectations modules → enseignants → groupes (vue « 🧩 Affectations »)
- Chaque module a une **nature** : 🎯 **Métier** ou 🧩 **Transversal** (à définir dans Ressources → Modules).
- **Transversal** : séance imposée à **1h30**, groupes regroupés par 2 ou 3 dans un même créneau et un même amphi (3 groupes → 3 ensemble, 4 → 2 + 2, 5 → 3 + 2) ; un enseignant assurant ce module a **obligatoirement au moins 2 groupes regroupés** (jamais un groupe isolé).
  - **Métier** : pas de contrainte de regroupement particulière.
- Pour chaque module, on indique quels **groupes concernés** (« Groupes du semestre », « Tous », « Aucun » en raccourci), puis, dans chaque ligne, on sélectionne d'abord le ou les groupes à affecter et ensuite l'enseignant. Les groupes déjà affectés à un enseignant sont grisés et non sélectionnables dans les autres lignes. Ils redeviennent disponibles uniquement après la suppression de leur affectation.
- **🎲 Répartir les groupes automatiquement** (par module) / **🎲 Tout répartir & planifier automatiquement** (en haut de la vue) : calcule qui prend quels groupes précis, puis place automatiquement les séances (jour/créneau/salle) sans conflit si possible. Un message de confirmation est demandé avant d'exécuter « 🎲 Tout répartir & planifier automatiquement », car cette action recalcule les séances déjà planifiées automatiquement (les séances manuelles ne sont jamais touchées). Le tableau des cas affiche désormais **toutes** les combinaisons distinctes trouvées par l'algorithme (auparavant limité à 8), avec une zone défilante si la liste est longue.
- **🗓️ Planifier automatiquement** (par module) : répartit et planifie ce module uniquement.
- Depuis **Nouvelle séance**, cocher un seul groupe crée une séance séparée ; cocher plusieurs groupes crée une séance mutualisée. Dans les deux cas, l'utilisateur choisit la salle, le jour, le créneau de départ et la durée. Une séance mutualisée propose l'amphi par défaut ; après la planification d'un groupe séparé, le bouton **Planifier** repropose les groupes encore non planifiés.
- **⚖️ Répartir équitablement** distribue le *nombre* de groupes entre les enseignants listés (5 groupes / 2 enseignants → 3 + 2).
- **+ Ajouter un enseignant** est bloqué tant qu'un premier groupe n'a pas été choisi ; l'application affiche un message demandant de sélectionner d'abord le groupe à affecter.
- **Salles** : chaque groupe a une salle par défaut ; comme il y a moins de salles que de groupes, le moteur choisit **automatiquement une autre salle libre** (avec assez de capacité, priorité aux amphis pour les regroupements) quand la salle par défaut n'est pas disponible.
- **Contrôles automatiques** : groupes sans enseignant, groupes doublés, enseignant sans groupe, nombre total demandé ≠ nombre de groupes du module, enseignant transversal avec moins de 2 groupes, séances non conformes — résumés dans le tableau de bord (« Affectations incomplètes »).
- Le filtre de semestre masque automatiquement les modules des autres semestres. Dans chaque carte, seuls les groupes du semestre du module sont proposés ; les raccourcis « Groupes du semestre » et « Tous » restent limités à ce même périmètre.
- Tableau « Charge par enseignant » (modules et groupes pris en charge) ; suppression d'un groupe/enseignant/module : les affectations sont nettoyées automatiquement.
- Excel : feuille **Affectations** (Module · Enseignant · **Nb groupes demandé** · Groupe(s) attribué(s)). La colonne Groupe(s) attribué(s) sauvegarde exactement la répartition enseignant–module–groupe ; le nombre est recalculé à partir des groupes. La répartition automatique reste disponible comme action volontaire, mais n’est plus imposée.
- **Synchronisation bidirectionnelle avec la configuration manuelle** (Planning par groupe, Planning par semestre, Vue par enseignant, Vue par salle) :
  - **Configuration manuelle → Affectations** : quand une séance est créée ou modifiée à la main dans une de ces vues, l'affectation module ↔ enseignant correspondante est automatiquement créée ou mise à jour avec le(s) groupe(s) réellement planifié(s). Si un groupe était jusque-là affecté à un autre enseignant pour ce module, il lui est retiré (un groupe n'a qu'un enseignant par module).
  - **Affectations → configuration manuelle** : à l'inverse, tout changement dans l'onglet Affectations (réaffecter un groupe à un autre enseignant, répartir automatiquement, équitablement…) met immédiatement à jour l'enseignant des séances déjà planifiées dont les groupes correspondent, dans toutes les vues.

### 8 ter. Actions éducatives extérieures
- Dans **Ressources → Groupes**, choisissez au plus un jour d’Actions éducatives par groupe, ou laissez le champ vide. Le libellé affiché peut être personnalisé ; une valeur vide revient au libellé **ACTIONS ÉDUCATIVES**.
- Le bouton **🎲 Attribuer automatiquement les jours** complète les groupes sans jour défini, en privilégiant les journées les moins chargées et sans écraser les choix manuels. Les jours déjà occupés par un cours sont refusés en saisie manuelle et évités par la planification automatique autant que possible.
- Dans les emplois du temps par groupe et dans les PDF, la journée sélectionnée est représentée par une cellule fusionnée sur tous les créneaux, centrée et visuellement distincte. Elle n'affiche ni enseignant ni salle.
- Une Action éducative ne réserve aucune salle de l'établissement. Un cours placé le même jour pour le groupe produit un conflit dédié et doit être corrigé.

### 8 quater. 🔁 Régénérer automatiquement en cas de conflit
- Dans l'onglet **⚠️ Conflits**, le bouton **🔁 Régénérer automatiquement (autre combinaison)** relance le moteur de planification sur les séances générées automatiquement qui sont en conflit, en essayant une **nouvelle combinaison aléatoire** (autre jour/créneau/salle, voire autre répartition des groupes) jusqu'à trouver, dans la mesure du possible, un arrangement sans conflit.
- Il ne touche **jamais** les séances créées ou modifiées manuellement (via un clic sur une case du planning ou le bouton « Planifier ») : celles-ci restent protégées et doivent être ajustées à la main si elles sont en conflit.
- S'il ne trouve pas de solution parfaite après plusieurs essais, il conserve la combinaison laissant le moins de conflits et l'indique dans le message de résultat.
- Chaque conflit affiché dans **⚠️ Conflits** est cliquable. Les boutons de correction ouvrent directement la séance concernée dans le formulaire de modification ; pour un conflit entre deux séances, une action distincte est proposée pour chacune.


### 9. Import / Export Excel (.xlsx) — dans chaque module
Chaque module possède une barre **📗 Excel** (⬇️ Exporter · ⬆️ Importer · 📄 Modèle vierge) :

| Module | Export | Import |
|---|---|---|
| Tableau de bord | synthèse : charge enseignants, occupation des salles, groupes, conflits | — |
| Configuration | nom/type/statut de session, année, filière, option, date de début, jours actifs et créneaux | ✔ |
| Affectations | module → enseignant → groupes | ✔ (fusion ou remplacement) |
| Groupes / Salles / Enseignants / Modules | liste complète, Actions éducatives, modules assurés et nombres de groupes par module inclus | ✔ fusion par nom (mise à jour ou ajout, rien n'est supprimé) |
| Planning par groupe | grille mise en forme + feuille « Séances » | ✔ séances |
| Planning par semestre | une feuille-grille par groupe + « Séances » | ✔ séances |
| Vue enseignant | grille + « Séances » + « Disponibilités » | ✔ séances et disponibilités |
| Vue salle | grille + « Séances » | ✔ séances |
| Conflits | liste des conflits | — |
| Import / Export (global) | classeur complet avec la session active, l’index de toutes les sessions et les affectations | ✔ mode fusionner ou remplacer |

- Les fichiers exportés sont **réimportables tels quels** (aller-retour vérifié) ; les grilles reprennent la mise en forme du document (bandeau jaune, couleurs, cellules fusionnées, A4 paysage).
- Les **modèles vierges** contiennent des listes déroulantes et une feuille « Aide ».
- Chaque import affiche un **rapport** (ajouts, mises à jour, lignes en erreur avec leur numéro) et peut être **annulé** en un clic.
- Import des séances : doublons ignorés, option « remplacer les séances de la vue », option de création automatique des modules/enseignants/salles/groupes inconnus.
- Format accepté : `.xlsx` (bibliothèque ExcelJS embarquée dans `js/vendor/`, aucune connexion requise).
- Les onglets **Groupes, Salles, Enseignants, Modules, Affectations, Séances, Configuration, Disponibilités et Sessions** ont été vérifiés en aller-retour ; les champs Actions éducatives, modules assurés, date de début et métadonnées de session sont conservés.

### 10. Export PDF / Impression
Les documents (emploi du temps par groupe/enseignant/salle) suivent désormais la mise en page d'un document de référence institutionnel :
- Format **A4 paysage**, une page par groupe.
- En-tête : logo centré en haut, **sceau/cachet institutionnel** en haut à droite (à importer dans Configuration, comme le logo), titre « Emploi du temps » + « provisoire » en rouge, sous-titre « Session d'Automne / de Printemps », année universitaire, filière + spécialité, puis Semestre (gauche) / Groupe et salle (droite).
- Tableau : bandeau des créneaux et colonne des jours en jaune vif, bordures noires nettes, cellules de cours en vert clair, cellules vides blanches ; la colonne d'un créneau plus court (ex. pause déjeuner) est automatiquement plus étroite, proportionnellement à sa durée.
- Une salle est affichée **en rouge** dans une cellule de cours lorsqu'elle diffère de la salle par défaut du groupe (signale un changement de salle ponctuel) — à ajuster si ce n'est pas le comportement voulu.
- Pied de page : « Début des cours : [date] » en bas à gauche (date réglable dans Configuration, à côté de Filière/Option).
- Police **Times New Roman**, taille **11,5 pt** dans tous les documents exportés ; la grille interactive à l'écran (édition) garde son propre style, non affecté par ce changement.
- Bouton **Imprimer / Export PDF** sur chaque vue (groupe, semestre, enseignant, salle) → choisir « Enregistrer au format PDF ».
- Marges gérées par l'application (pas d'URL/date parasites du navigateur), nom de fichier PDF proposé automatiquement (ex. « EDT Semestre 6 - 2025-2026 »).
- Ajustement automatique : si une page est trop chargée (7 jours, noms très longs), le tableau est réduit pour tenir sur une seule page, sans réduire les dimensions institutionnelles du logo et du cachet.
- Import/Export JSON complet toujours disponible pour sauvegarder ou transférer toutes les données.

### 11. 🕘 Historique des opérations
- Chaque opération (répartition/planification automatique, bouton « Compléter », séance créée/modifiée/supprimée manuellement, import Excel/JSON, réinitialisation, création/suppression de session…) est automatiquement enregistrée dans l'onglet **🕘 Historique**, avec un libellé et l'heure exacte.
- La liste affiche l'opération la plus récente en haut (« état actuel ») ; cliquer sur **↩️ Revenir ici** sur une entrée antérieure restaure l'application **exactement** comme elle était juste après cette opération (données, séances, affectations…), après confirmation.
- Ce retour en arrière est lui-même enregistré comme une nouvelle opération (historique linéaire, sans perte des entrées intermédiaires) — on peut donc aussi bien « annuler un retour en arrière » en cliquant plus haut dans la liste.
- L'historique est conservé dans le navigateur (jusqu'à 40 opérations, séparément des données), il survit donc à un rechargement de page mais reste propre à cet appareil/navigateur. Bouton **🗑️ Vider l'historique** disponible si besoin (n'affecte pas les données actuelles).

## 🗂️ Structure des fichiers

```
edt-app/
├── index.html          → structure de la page et des modales
├── css/
│   └── style.css        → mise en forme (thème clair, grille, impression)
├── js/
│   ├── data.js           → modèle de données, état global, stockage local, données de démo
│   ├── conflicts.js       → moteur de détection des conflits
│   ├── render.js          → construction du DOM (tableaux, grilles, documents PDF)
│   ├── affectations.js    → affectation modules/enseignants (nombre de groupes), contrôles, vue dédiée
│   ├── autoscheduler.js   → répartition automatique des groupes + planification auto + régénération anti-conflits
│   ├── excel.js           → import / export Excel de tous les modules
│   ├── history.js         → vue « Historique des opérations » (liste, restauration en un clic)
│   ├── vendor/exceljs.min.js → bibliothèque ExcelJS (MIT), embarquée
│   └── app.js             → navigation, modales, gestion des événements
└── README.md
```

## 🔧 Personnalisation / évolution possible
- Brancher un vrai backend (API REST + base de données) en remplaçant les fonctions
  `loadState()` / `saveState()` de `js/data.js` par des appels HTTP.
- Le moteur `autoscheduler.js` est un solveur glouton multi-essais (aléatoire + meilleure
  tentative conservée) ; il peut être remplacé par un vrai algorithme d'optimisation
  (backtracking, satisfaction de contraintes) si les jeux de données deviennent très
  contraints (beaucoup d'enseignants très indisponibles, peu de salles/amphis).
