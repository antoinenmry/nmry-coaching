# NMRY Coaching — architecture fonctionnelle

Inventaire de chaque menu, sous-menu et fonctionnalité, pour repérer les doublons, les incohérences de
positionnement et les améliorations. Relevé sur le code au 5 octobre 2026.

Rôles : **S** sportif · **C** coach · **A** admin. Sans mention, la fonctionnalité est visible par tous.
Les identifiants (D1, P1, A1…) servent à se référer aux points dans les discussions.

---

## 1. Arborescence

```
NMRY COACHING (mobile)
├── Accueil  (/)
│   ├── En-tête global (toutes les pages)
│   │   ├── Retour (hors accueil), logo ou titre de page, indicateur de synchronisation
│   │   ├── Sélecteur de sportif (C/A) + Aperçu « en tant que sportif » (C/A sur un autre profil)
│   │   ├── Shop & Avantages (C/A toujours ; S seulement si du contenu existe)
│   │   └── Réglages
│   ├── Carrousel de cartes (défilement 5 s, tous), affiché seulement s'il y a quelque chose
│   │   ├── Anniversaires du groupe (si partagé) + feu d'artifice
│   │   ├── Annonces du coach : message, promo/lien, sondage (ciblage sportifs et/ou sports, durée)
│   │   ├── Compétitions du groupe dans les 7 jours (si partagé)
│   │   └── Rappels personnels : séance du jour, objectif à J-7
│   ├── Bandeau coach (C/A, 2 pages à glisser)
│   │   ├── Page 1 : Vue d'ensemble (→ /overview), pastille si message urgent
│   │   └── Page 2 : gestion des annonces (réservé à Simon et Antoine)
│   ├── Bannière « en vacances » (S, pendant la période)
│   ├── 6 tuiles photo : Mon profil · Programmation · Objectifs · Records · Mon suivi · Bibliothèque
│   │   └── Sous-titre dynamique par tuile, pastille de messages non lus sur « Mon suivi »
│   └── Pop-up de message du coach (global, avec bulle photo du coach)
│
├── Mon profil  (/profile)
│   ├── Informations : photo, nom, naissance, genre, Instagram, localisation (Nominatim)
│   │   ├── Interrupteur « Visible sur la carte » (mapConsent)
│   │   ├── Interrupteur « Partager avec le groupe » (shareWins : anniversaire + compétitions)
│   │   └── Sports : tuiles issues de la liste du coach (library.sports)
│   ├── Carte de la communauté (si « Visible sur la carte » activé)
│   └── Mes badges : 3 badges épinglés, « À débloquer » avec progression (si des défis existent)
│
├── Programmation  (/plan)
│   ├── Modes : Semaine · Mois · Synthèse, navigation par flèches
│   ├── « À placer » (séances en attente de date), glisser/placer sur un jour
│   ├── Créer une séance (ComposeModal) + éditeur de séance (SessionEditor)
│   │   ├── Déroulé par exercice (séries × reps, kg/RPE/%), consignes du coach
│   │   ├── Côté sportif : réalisé, RPE (gouttes 0 à 5), ressenti, commentaire de fin de séance
│   │   └── Détection de record + proposition de l'enregistrer
│   ├── Actions de semaine (C/A) : Dupliquer · Copier vers un sportif ou une semaine type ·
│   │   Injecter un programme · Notifier le nouveau plan (sur un profil sportif seulement)
│   ├── Surcouches du calendrier : objectifs (pastilles + fiche), blessures, vacances
│   └── Mode vacances (modal depuis l'en-tête du plan)
│
├── Objectifs  (/goals)
│   ├── Liste « À venir » / « Passés » avec décompte
│   ├── Fiche d'un objectif (détail, épreuves prévu/réalisé)
│   └── Nouvel objectif / modifier (« + »)
│
├── Records  (/records)
│   ├── Records : musculation (par exercice), course à pied (distances), Hyrox (Open/Pro) ; « + » d'ajout, historique au tap
│   └── Tendances : courbes de progression par sport
│
├── Mon suivi  (/followup)   ← 3 onglets
│   ├── Messages : chat sportif ↔ coach (texte, vocal, pièces jointes, réactions, urgent, deep-link sur un message)
│   ├── Santé
│   │   ├── Suivi : douleurs, blessures (avec dates), notes ; « + » d'ajout
│   │   └── Métriques : Données (métriques personnalisées + entrées) · Tendances (courbes)
│   └── Bloc-notes : Plan alimentaire (texte du coach) + notes partagées
│
├── Bibliothèque  (/library)
│   ├── Exercices (tous) : liste groupée, filtres, favori, fiche + vidéo ; création (C/A)
│   ├── Séances types · Semaines types · Programmes (C/A)
│   ├── Défis (C/A éditent ; S voient s'il y en a) : badges, conditions, progression
│   └── Ma carte (tous) : carte de la communauté + liste des membres
│
├── Réglages  (/settings)
│   ├── Affichage (tous)
│   │   ├── Compte : nom, email, vacances, déconnexion
│   │   ├── Apparence : thème Sombre/Clair/Aurora, couleur de fond
│   │   └── Notifications : activation push, préférences par type, test
│   ├── Sportifs (C/A)
│   │   ├── Message aux sportifs (pop-up + chat + push, ciblable par sport)
│   │   ├── Annonces d'accueil (Simon et Antoine)
│   │   ├── Sports du profil : ajouter / supprimer (Simon et Antoine)
│   │   └── Gestion des sportifs : liste, statut, suppression, auto-assignation
│   └── Admin (A) : vue d'ensemble coachs/sportifs, assignations
│
├── Vue d'ensemble  (/overview, C/A, accessible seulement depuis le bandeau d'accueil)
│   ├── Messages urgents non lus (→ conversation sur le message)
│   ├── Blessures actives
│   └── Onglets Blessures · Objectifs de tous les sportifs
│
└── Shop & Avantages  (/shop)
    ├── Parrainage : partenaires, codes promo
    ├── Plans (payants) : visible aux sportifs si activé par le coach
    ├── Shop : produits, visible aux sportifs si activé
    └── Activation des onglets (C/A)

TRANSVERSE
├── Authentification (login, reset, confirmation), assignation automatique du coach à l'inscription (Simon)
├── Données : app_state (par utilisateur), library_state (partagée), templates ; sauvegarde différée 2 s
├── Notifications push (abonnement, rappels cron 7 h : séance du jour, objectif J-7 et J-1)
├── Pull-to-refresh, restauration de la dernière route, service worker
└── Route lecture seule /api/dashboard/today pour le dashboard mural (secret partagé)
```

---

## 2. Doublons

| # | Doublon | Où | Remarque |
|---|---------|----|----------|
| D1 | **Mode vacances** | Plan (icône d'en-tête → modal) et Réglages › Compte | Deux interfaces pour les mêmes dates (`vacation_start/end`). |
| D2 | **Gestion des annonces** | Accueil › bandeau coach page 2 et Réglages › Sportifs | Même formulaire, deux entrées. |
| D3 | **Trois canaux d'envoi collectif** | Message pop-up (Réglages), annonce de type « message » (Accueil), sondage | Un « message » peut être un pop-up ou une carte d'annonce ; le coach doit choisir sans critère clair. |
| D4 | **Carte de la communauté** | Bibliothèque › Ma carte et Profil › Carte | Même composant `CommunityMap`, deux emplacements. La liste des membres n'existe que dans la bibliothèque. |
| D5 | **Badges** | Profil › Mes badges et Bibliothèque › Défis | Les sportifs voient la progression à deux endroits ; la gestion coach n'est que dans la bibliothèque. |
| D6 | **Objectifs** | Page Objectifs, Plan (pastilles), Vue d'ensemble › Objectifs, carrousel (rappel J-7 + carte groupe), push J-7/J-1 | Cinq vues d'une même donnée ; le rappel J-7 existe en carte d'accueil **et** en push. |
| D7 | **« Tendances »** | Records › Tendances et Suivi › Santé › Métriques › Tendances | Même nom, contenus différents (records vs métriques de santé). |
| D8 | **Création de semaines types** | Bibliothèque › Semaines types / Programmes et Plan › Dupliquer, Copier, Injecter | Deux chemins pour le même objet. |
| D9 | **« Plans » / « Programmes »** | Shop › Plans (vente), Bibliothèque › Programmes, Programmation | Trois mots proches pour trois choses différentes. |
| D10 | **Messages urgents** | Vue d'ensemble, pastille « Mon suivi », pastille du bandeau d'accueil, push | Quatre signaux ; la pastille du bandeau et la section de la vue d'ensemble affichent la même liste. |
| D11 | **Deux consentements voisins** | « Visible sur la carte » et « Partager avec le groupe » | Deux interrupteurs pour deux mécanismes de visibilité, dans la même tuile du profil. La clé `shareWins` garde un nom d'avant le changement (records → compétitions). |
| D12 | **Sélecteur de sportif + Aperçu** | En-tête | Deux contrôles pour « voir comme le sportif ». |
| D13 | **Bibliothèque en double dans les données** | `state.library` (par utilisateur, ignoré en mode connecté) et `library_state` (partagée) | Reliquat historique cité dans les commentaires de la page Records. |

## 3. Incohérences de positionnement

| # | Constat | Où | Pourquoi c'est gênant |
|---|---------|----|-----------------------|
| P1 | **Le chat est rangé dans « Mon suivi »** | Mon suivi › Messages | Le titre promet du suivi ; l'onglet principal est une messagerie. |
| P2 | **« Plan alimentaire » dans « Bloc-notes »** | Mon suivi › Bloc-notes | Un plan du coach n'est pas une note du sportif. |
| P3 | **La vue d'ensemble n'a pas d'entrée de menu** | /overview, atteinte seulement via le bandeau d'accueil | Une page entière dépend d'un widget ; blessures et objectifs de tous les sportifs devraient vivre avec « Mon suivi » et « Objectifs » en mode coach. |
| P4 | **Réglages › Sportifs mélange trois choses** | Communication (message, annonces), configuration (sports), administration (statuts, suppression) | La communication au groupe n'est pas un réglage. |
| P5 | **Annonces gérées depuis l'accueil et les réglages** | voir D2 | Deux emplacements, aucun n'est « la » référence. |
| P6 | **Shop dans l'en-tête, hors de la grille** | Barre secondaire de l'en-tête | Tout le reste s'ouvre par les tuiles ; le Shop et les Réglages par de petits boutons. |
| P7 | **La Bibliothèque contient « Défis » et « Ma carte »** | Onglets de la bibliothèque | Ni l'un ni l'autre n'est de la bibliothèque d'exercices ; ils appartiennent à Profil ou à une section « Communauté ». |
| P8 | **Vacances dans « Compte »** | Réglages › Affichage › Compte | L'effet est dans la Programmation ; le réglage est loin de son résultat. |
| P9 | **Titres incohérents** | Tuile ↔ titre de page : « Objectifs » ↔ « Mes Objectifs », « Records » ↔ « Mes Records », « Bibliothèque » ↔ « Ma Bibliothèque », « Mon suivi » ↔ « Mon Suivi » | Possessifs et majuscules varient entre la tuile et l'en-tête. |
| P10 | **Vocabulaire objectif / compétition / course** | Page « Objectifs », carte « Compétition », push « Rappel objectif », champ « competition » | Un même événement porte trois noms. |
| P11 | **Quatre styles de sous-onglets** | Records (2 pilules dorées pleine largeur), Suivi (pilule + « + »), Bibliothèque (pilules à compteur défilantes), Shop (boutons carrés avec emojis), Vue d'ensemble (rouge/or) | Même fonction, rendus différents. |
| P12 | **Emojis encore présents** | Surtout Shop, Bibliothèque (✏️ 🗑️), Plan, éditeur de séance, Suivi, en-tête (⚙ 🎁 👁 ⚠️) | Profil, Objectifs, Records et accueil ont déjà été passés en icônes SVG. |
| P13 | **Boutons d'ajout hétérogènes** | « + » doré rond (Records, Objectifs, Suivi) ↔ `AddButton` du Shop ↔ boutons texte (Bibliothèque) | Le geste « ajouter » change d'une page à l'autre. |

## 4. Code mort et dettes

| # | Élément | Constat |
|---|---------|---------|
| T1 | `components/PartnersModal.tsx` | Aucun import dans l'app : remplacé par la page Shop. |
| T2 | `ExerciseLibrary.mapVisible`, `ExerciseLibrary.challengesVisible` | Présents dans `lib/types.ts`, jamais lus. |
| T3 | `/api/messages/notify` | Aucun appel dans le code ; les notifications de chat passent par `/api/chat`. |
| T4 | `/api/admin/migrate-audio`, `/api/admin/migrate-photos` | Outils de migration ponctuels, non reliés à l'interface. |
| T5 | Constantes de style dupliquées | `GOLD`, `LABEL`, `PILL_ON`… redéfinis dans au moins Records, Suivi, Annonces, Profil. |
| T6 | Pages très longues | Plan 1 834 lignes, Bibliothèque 1 673, Suivi 1 550 (+ MetricsTab 739), SessionEditor 1 259, Records 1 096, Shop 990. |
| T7 | Tuiles de carte | `CommunityMap` utilise désormais les tuiles OpenStreetMap (CARTO exige une clé API). L'usage intensif relève d'une politique d'OSM ; prévoir un fournisseur à clé si le trafic grandit. |

## 5. Améliorations proposées

Classées par rapport gain / effort. Aucune n'est appliquée : à valider.

### Simplifier (supprimer des doublons)
- **A1 · Un seul « Mode vacances »** : le garder dans Programmation (là où il agit) et le retirer de Réglages, ou l'inverse, avec un composant unique. *(D1, P8)*
- **A2 · Un seul endroit pour la communication** : une entrée « Communication » (coach) regroupant message pop-up, annonce et sondage, avec le choix du canal expliqué. Retirer les annonces de Réglages. *(D2, D3, P4, P5)*
- **A3 · Une seule carte, deux vues** : garder la carte du profil et déplacer la liste des membres dessous ; retirer « Ma carte » de la bibliothèque. *(D4, P7)*
- **A4 · Une seule page de badges** : « Mes badges » dans le profil pour tous, la gestion des défis rejoint les outils du coach. *(D5, P7)*
- **A5 · Renommer** « Tendances » (Records) en « Progression » et « Tendances » (santé) en « Courbes », et « Plans » (Shop) en « Plans payants ». *(D7, D9)*

### Replacer
- **A6 · Découper « Mon suivi »** : renommer l'onglet Messages en une entrée « Messages » à part (ou renommer la tuile « Santé & messages ») ; sortir « Plan alimentaire » du Bloc-notes vers un onglet « Nutrition ». *(P1, P2)*
- **A7 · Donner une vraie place à la vue d'ensemble** : tuile ou onglet coach dans l'accueil ; y fusionner la liste des urgents (qui peut alimenter la pastille du bandeau). *(P3, D10)*
- **A8 · Sortir le Shop de la barre d'en-tête** : en faire une tuile (ou un lien du profil), ne garder dans l'en-tête que le retour, le sélecteur et les réglages. *(P6)*

### Harmoniser
- **A9 · Un composant de sous-onglets et un bouton « + »** partagés, utilisés partout. *(P11, P13)*
- **A10 · Un seul jeu d'icônes SVG** : extraire `Ico` (déjà dans le profil) en `components/Icons.tsx` et finir le passage des emojis (Shop, Bibliothèque, Plan, éditeur, Suivi, en-tête). *(P12)*
- **A11 · Titres uniques** : une liste (tuile = titre de page), par exemple « Profil », « Programmation », « Objectifs », « Records », « Suivi », « Bibliothèque ». *(P9)*
- **A12 · Un seul mot pour l'événement** : « Compétition » partout, ou « Objectif » partout. *(P10)*
- **A13 · Fichier de styles partagés** (`lib/ui.ts`) pour `GOLD`, `LABEL`, `PILL_ON`, tuiles, modales en portail. *(T5)*

### Nettoyer
- **A14 · Supprimer** `PartnersModal`, `mapVisible`, `challengesVisible`, `/api/messages/notify` ; sortir les routes `migrate-*` du dépôt une fois les migrations terminées. *(T1 à T4)*
- **A15 · Découper les pages de plus de 1 000 lignes** par onglet ou par modale (Plan, Bibliothèque, Suivi, Records). *(T6)*
- **A16 · Renommer `shareWins`** en `shareWithGroup` (migration douce : lire les deux clés). *(D11)*
- **A17 · Retirer `state.library`** du blob utilisateur une fois les anciennes données migrées. *(D13)*

### Idées fonctionnelles (inspirées de l'arborescence de référence)
- **A18 · Rappels contextuels du sportif** : « séance manquée, que faire ? » et bilan de la semaine, affichés dans le carrousel seulement quand ils ont lieu d'être.
- **A19 · Check-in du jour** (jambes, moral, sommeil) en haut de l'accueil, relié au suivi.
- **A20 · Comparaison avec la même séance précédente** dans l'éditeur de séance.

---

## 6. Règles de lecture et de maintenance
- Ce fichier décrit l'**intention produit** ; toute nouvelle page ou tout nouvel onglet s'ajoute à l'arborescence dans la même modification.
- Contrôle utile avant de livrer : rechercher les routes API non appelées (`app/api/**/route.ts` sans référence) et les composants sans import.
- Droits d'écriture : annonces et liste des sports réservés à `ANNOUNCEMENT_EDITORS` (`lib/config.ts`), contrôlés aussi côté serveur (`PUT /api/library`).
