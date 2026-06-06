export type Role = "coach" | "client" | "admin";
export type AthleteStatus = "active" | "inactive";

/** Données enrichies retournées par GET /api/coach/athletes */
export interface AthleteAdminData {
  coach_id?: string | null;    // coach affecté (null = non affecté)
  id: string;
  name: string;
  email: string;
  status: AthleteStatus;
  last_sign_in_at: string | null;
  updated_by_coach_at: string | null;
  updated_by_client_at: string | null;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  status?: AthleteStatus; // "active" par défaut (champ optionnel pour rétrocompat)
}

/** Vue admin : un coach avec ses clients affectés */
export interface CoachWithClients {
  id: string;
  name: string;
  email: string;
  role: "coach" | "admin";
  clients: Profile[];
}

/** Vue admin : données complètes pour le panneau d'administration */
export interface AdminOverview {
  coaches: CoachWithClients[];
  unassigned: Profile[]; // clients sans coach
}

/** Un exercice dans une séance posée (la prescription, éditable). */
export interface ExerciseInstance {
  uid: string;
  exId: string; // référence l'exercice de la bibliothèque (ou d'un modèle)
  name: string; // nom figé à l'ajout (robuste si la biblio change)
  sets: number;
  reps: number;
  weight: number;
  rpeCoach: number; // RPE prescrit par le coach (1-10)
  rpeClient: number; // RPE ressenti par le client (0 = non renseigné)
  coachComment: string; // consigne/note du coach pour cet exercice
  clientComment: string; // retour libre du client
  failed?: boolean; // true si le sportif a marqué l'exercice comme raté
  setsLabel?: string; // surcharge d'affichage pour sets (ex: "3-4")
  repsLabel?: string; // surcharge d'affichage pour reps (ex: "8-12")
}

/** Une séance. `date` = null tant qu'elle est dans la banque « À placer ». */
export interface SessionInstance {
  id: string;
  tplId: string;
  name: string;
  color: string;
  emoji: number; // ressenti global de la séance (0 = non noté, 1-5)
  done: boolean; // séance validée par le client
  coachComment: string; // commentaire global du coach pour la séance
  date: string | null; // "YYYY-MM-DD" si placée, null si dans la banque
  exercises: ExerciseInstance[];
}

export interface UserProfileData {
  name: string;
  photo: string;      // base64 data URL ou ""
  birthDate: string;  // "YYYY-MM-DD" ou ""
  gender: string;     // "homme" | "femme" | ""
  height: string;     // cm
  weight: string;     // kg
  sports: string[];   // sports sélectionnés
  diet: string;
  dietComment?: string; // commentaire / retour du sportif sur sa diète
}

export interface GoalEvent {
  id: string;
  name: string;     // nom de l'épreuve (ex : Squat, 100m nage libre…)
  planned: string;  // objectif prévu
  achieved: string; // réalisation effective
}

export interface Goal {
  id: string;
  competition: string;
  date: string;
  place: string;
  expected: string;       // commentaires libres (renommé côté UI)
  events?: GoalEvent[];   // épreuves structurées prévu / réalisé
  clientName?: string;    // enrichi côté coach pour la vue planning multi-sportifs
}

export interface Followup {
  id: string;
  date: string;       // date de début (ou date d'ajout pour les notes)
  dateEnd?: string;   // date de fin (blessures uniquement)
  type: "note" | "injury" | "pain"; // pain = douleur confinée au suivi ; injury = visible plan + overview
  text: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  isUrgent: boolean;
  isVoice: boolean;
  audioUrl?: string;    // base64 data URL audio/webm
  createdAt: string;    // ISO timestamp
  editedAt?: string;    // ISO timestamp si modifié après envoi
  senderId: string;     // user id de l'expéditeur
  senderName?: string;  // dénormalisé pour affichage
  isRead: boolean;
}

/** Une note du bloc-notes partagé sportif ↔ coach (stocké dans app_state du sportif). */
export interface BlockNote {
  id: string;
  text: string;
  createdAt: string;   // ISO timestamp
  updatedAt?: string;  // ISO timestamp si modifié
  authorId: string;
  authorName: string;
  authorRole: Role;
}

// ---- Bibliothèque d'exercices (filtres personnalisables) ----

/** Une option de filtre, ex. « Haut du corps ». */
export interface FilterOption {
  id: string;
  label: string;
}

/** Une catégorie de filtre = une ligne de chips, ex. « Zone du corps ». */
export interface FilterCategory {
  id: string;
  name: string;
  options: FilterOption[];
}

/** Un exercice de la bibliothèque : son identité (la prescription vit dans le plan). */
export interface LibraryExercise {
  id: string;
  name: string;
  tags: Record<string, string[]>; // categoryId -> optionId[] (multi-sélection)
  video: string; // URL
  comment?: string; // notes/description libres (visibles par tous)
}

export interface ExerciseLibrary {
  categories: FilterCategory[];
  exercises: LibraryExercise[];
}

// ---- Templates (Séances types & Semaines types) — visibles coach/admin seulement ----

/** Exercice prescrit dans une séance type (valeurs par défaut modifiables). */
export interface TemplateExercise {
  uid: string;           // identifiant unique dans la séance type
  exId: string;          // → LibraryExercise.id
  name: string;          // snapshot du nom (robuste si la biblio évolue)
  sets: number;
  setsLabel?: string;    // ex: "3-4"
  reps: number;
  repsLabel?: string;    // ex: "8-12"
  weight: number;        // 0 = non prescrit
  rpeCoach: number;      // 0 = non prescrit
  coachComment: string;
}

/** Séance type : un modèle réutilisable de séance (coach/admin only). */
export interface SessionTemplate {
  id: string;
  name: string;
  color: string;
  description: string;
  exercises: TemplateExercise[];
}

/** Un slot dans une semaine type : plusieurs séances sur un jour. */
export interface WeekTemplateDay {
  dayIndex: number;                      // 0=Lun … 6=Dim
  sessions: { tplId: string }[];         // références à SessionTemplate.id
}

/** Semaine type : un modèle de semaine d'entraînement (coach/admin only). */
export interface WeekTemplate {
  id: string;
  name: string;
  description: string;
  days: WeekTemplateDay[];               // 0..7 entrées (jours non vides seulement)
}

/** Ensemble des templates, stocké dans template_state (Supabase). */
export interface TemplateLibrary {
  sessionTemplates: SessionTemplate[];
  weekTemplates: WeekTemplate[];
}

// ---- Records ----

export type CapDistance = "1km" | "5km" | "10km" | "21km" | "42km";
export type HyroxCategory = "pro" | "open";

export interface StrengthRecord {
  id: string;
  date: string;    // "YYYY-MM-DD"
  reps: number;
  weight: number;  // kg
}

export interface CardioRecord {
  id: string;
  date: string;        // "YYYY-MM-DD"
  timeSeconds: number;
}

export interface ExerciseRecords {
  exId: string;
  name?: string;   // snapshot nom (obligatoire pour les exercices personnalisés hors bibliothèque)
  visible: boolean;
  entries: StrengthRecord[]; // max 3
}

export interface RecordsData {
  activeSports?: ("strength" | "cap" | "hyrox")[]; // sports activés (undefined = legacy)
  strength: ExerciseRecords[];
  activeCap?: CapDistance[];       // distances CAP activées (undefined = legacy)
  cap: Record<CapDistance, CardioRecord[]>;
  activeHyrox?: HyroxCategory[];   // catégories Hyrox activées (undefined = legacy)
  hyrox: Record<HyroxCategory, CardioRecord[]>;
}

/** Préférences de notifications push par utilisateur. */
export interface NotifPrefs {
  newMessage: boolean;      // nouveau message chat (coach → sportif / sportif → coach)
  newPlan: boolean;         // nouveau programme publié par le coach (sportif uniquement)
  urgentMessage: boolean;   // message urgent d'un sportif (coach uniquement)
  newInjury: boolean;       // blessure déclarée par un sportif (coach uniquement)
  goalReminder: boolean;    // rappel J-7 / J-1 avant objectif (sportif uniquement)
  sessionReminder: boolean; // rappel séance du jour à 7h (sportif uniquement)
}

/** Préférences visuelles par compte (couleurs cartes accueil…). */
export interface UserPreferences {
  cardColors: Record<string, string>; // href → couleur hex
  cardColorMode: "arc" | "full";      // arc de cercle ou fond entier
  notifPrefs?: NotifPrefs;            // préférences notifications (undefined = tout activé par défaut)
}

/** Document complet d'un client (stocké en JSON dans app_state.data). */
export interface AppState {
  profile: UserProfileData;
  sessions: SessionInstance[]; // toutes les séances (date = null si dans la banque)
  goals: Goal[];
  followups: Followup[];
  messages: ChatMessage[];     // chat coach ↔ sportif (stocké côté sportif)
  notes: BlockNote[];          // bloc-notes partagé sportif ↔ coach
  library: ExerciseLibrary;
  records: RecordsData;
  preferences: UserPreferences;
}

// Bibliothèque de départ (catégories muscu modifiables/supprimables).
const defaultLibrary = (): ExerciseLibrary => ({
  categories: [
    {
      id: "zone",
      name: "Zone du corps",
      options: [
        { id: "haut", label: "Haut du corps" },
        { id: "bas", label: "Bas du corps" },
        { id: "core", label: "Tronc / Core" },
      ],
    },
    {
      id: "muscle",
      name: "Groupe musculaire",
      options: [
        { id: "pecs", label: "Pectoraux" },
        { id: "dos", label: "Dos" },
        { id: "epaules", label: "Épaules" },
        { id: "bras", label: "Bras" },
        { id: "jambes", label: "Jambes" },
        { id: "fessiers", label: "Fessiers" },
        { id: "abdos", label: "Abdos" },
      ],
    },
    {
      id: "equip",
      name: "Équipement",
      options: [
        { id: "barre", label: "Barre" },
        { id: "halteres", label: "Haltères" },
        { id: "poulie", label: "Poulie" },
        { id: "machine", label: "Machine" },
        { id: "pdc", label: "Poids du corps" },
      ],
    },
  ],
  exercises: [
    { id: "ex-bench", name: "Développé couché", tags: { zone: ["haut"], muscle: ["pecs"], equip: ["barre"] }, video: "" },
    { id: "ex-squat", name: "Squat", tags: { zone: ["bas"], muscle: ["jambes", "fessiers"], equip: ["barre"] }, video: "" },
    { id: "ex-pullup", name: "Tractions", tags: { zone: ["haut"], muscle: ["dos", "bras"], equip: ["pdc"] }, video: "" },
  ],
});

export const emptyRecords = (): RecordsData => ({
  strength: [],
  cap: { "1km": [], "5km": [], "10km": [], "21km": [], "42km": [] },
  hyrox: { pro: [], open: [] },
});

export const emptyState = (): AppState => ({
  profile: { name: "", photo: "", birthDate: "", gender: "", height: "", weight: "", sports: [], diet: "" },
  sessions: [],
  goals: [],
  followups: [],
  messages: [],
  notes: [],
  library: defaultLibrary(),
  records: emptyRecords(),
  preferences: { cardColors: {}, cardColorMode: "arc" },
});
