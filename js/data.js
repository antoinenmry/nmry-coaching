/* =========================================================================
   BIBLIOTHÈQUE — Édite UNIQUEMENT ce fichier pour ajouter du contenu.
   =========================================================================

   1) EXERCISES : la liste de tous les mouvements disponibles.
      Pour ajouter un exercice -> ajoute une ligne dans le tableau.
      { id: 'identifiant-unique', name: 'Nom affiché', group: 'Groupe musculaire' }

   2) SESSION_TEMPLATES : des modèles de séances prêts à glisser dans le
      planning. Pour créer une nouvelle séance -> copie un bloc { ... } et
      change les valeurs. Chaque exercice de la séance reprend un `exId`
      présent dans EXERCISES, plus ses valeurs par défaut (séries, reps...).
   ========================================================================= */

// ---- 1) Exercices ----------------------------------------------------------
const EXERCISES = [
  // Pectoraux
  { id: 'bench',        name: 'Développé couché',        group: 'Pectoraux' },
  { id: 'incline-db',   name: 'Développé incliné haltères', group: 'Pectoraux' },
  { id: 'dips',         name: 'Dips',                    group: 'Pectoraux' },
  { id: 'pec-fly',      name: 'Écarté poulie',           group: 'Pectoraux' },

  // Dos
  { id: 'deadlift',     name: 'Soulevé de terre',        group: 'Dos' },
  { id: 'pullup',       name: 'Tractions',               group: 'Dos' },
  { id: 'row-barbell',  name: 'Rowing barre',            group: 'Dos' },
  { id: 'lat-pulldown', name: 'Tirage vertical',         group: 'Dos' },

  // Jambes
  { id: 'squat',        name: 'Squat',                   group: 'Jambes' },
  { id: 'leg-press',    name: 'Presse à cuisses',        group: 'Jambes' },
  { id: 'rdl',          name: 'Soulevé de terre roumain', group: 'Jambes' },
  { id: 'leg-curl',     name: 'Leg curl',                group: 'Jambes' },
  { id: 'calf-raise',   name: 'Mollets debout',          group: 'Jambes' },

  // Épaules
  { id: 'ohp',          name: 'Développé militaire',     group: 'Épaules' },
  { id: 'lateral-raise',name: 'Élévations latérales',    group: 'Épaules' },
  { id: 'face-pull',    name: 'Face pull',               group: 'Épaules' },

  // Bras
  { id: 'curl-barbell', name: 'Curl barre',              group: 'Bras' },
  { id: 'curl-db',      name: 'Curl haltères',           group: 'Bras' },
  { id: 'triceps-push', name: 'Extension triceps poulie', group: 'Bras' },

  // Gainage
  { id: 'plank',        name: 'Gainage',                 group: 'Gainage' },
  { id: 'crunch',       name: 'Crunch',                  group: 'Gainage' },
];

// ---- 2) Modèles de séances --------------------------------------------------
// Valeurs par exercice :
//   exId   : id d'un exercice ci-dessus
//   sets   : nombre de séries
//   reps   : répétitions par série
//   weight : charge en kg (le client peut ajuster via curseur + champ libre)
//   rpe    : RPE /10 indiqué par le coach (le client valide ou non)
const SESSION_TEMPLATES = [
  {
    id: 'push',
    name: 'Push (Pecs / Épaules / Triceps)',
    color: '#ef5350',
    exercises: [
      { exId: 'bench',        sets: 4, reps: 8,  weight: 60, rpe: 8 },
      { exId: 'incline-db',   sets: 3, reps: 10, weight: 22, rpe: 8 },
      { exId: 'ohp',          sets: 3, reps: 10, weight: 35, rpe: 8 },
      { exId: 'lateral-raise',sets: 4, reps: 15, weight: 10, rpe: 9 },
      { exId: 'triceps-push', sets: 3, reps: 12, weight: 25, rpe: 9 },
    ],
  },
  {
    id: 'pull',
    name: 'Pull (Dos / Biceps)',
    color: '#42a5f5',
    exercises: [
      { exId: 'deadlift',     sets: 4, reps: 5,  weight: 100, rpe: 8 },
      { exId: 'pullup',       sets: 4, reps: 8,  weight: 0,   rpe: 8 },
      { exId: 'row-barbell',  sets: 3, reps: 10, weight: 50,  rpe: 8 },
      { exId: 'face-pull',    sets: 3, reps: 15, weight: 20,  rpe: 9 },
      { exId: 'curl-barbell', sets: 3, reps: 12, weight: 25,  rpe: 9 },
    ],
  },
  {
    id: 'legs',
    name: 'Legs (Jambes)',
    color: '#66bb6a',
    exercises: [
      { exId: 'squat',     sets: 5, reps: 5,  weight: 90, rpe: 8 },
      { exId: 'rdl',       sets: 3, reps: 8,  weight: 80, rpe: 8 },
      { exId: 'leg-press', sets: 3, reps: 12, weight: 150, rpe: 8 },
      { exId: 'leg-curl',  sets: 3, reps: 12, weight: 40, rpe: 9 },
      { exId: 'calf-raise',sets: 4, reps: 15, weight: 60, rpe: 9 },
    ],
  },
  {
    id: 'fullbody',
    name: 'Full Body',
    color: '#ab47bc',
    exercises: [
      { exId: 'squat',        sets: 3, reps: 8,  weight: 80, rpe: 7 },
      { exId: 'bench',        sets: 3, reps: 8,  weight: 60, rpe: 7 },
      { exId: 'row-barbell',  sets: 3, reps: 10, weight: 50, rpe: 7 },
      { exId: 'plank',        sets: 3, reps: 1,  weight: 0,  rpe: 8 },
    ],
  },
];

// Accès rapide
const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
const TEMPLATE_BY_ID = Object.fromEntries(SESSION_TEMPLATES.map((t) => [t.id, t]));
