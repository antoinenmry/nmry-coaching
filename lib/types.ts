export type Role = "coach" | "client" | "admin";
export type AthleteStatus = "active" | "inactive";

/** Données enrichies retournées par GET /api/coach/athletes */
export interface AthleteAdminData {
  coach_id?: string | null;    // coach affecté (null = non affecté)
  id: string;
  name: string;
  email: string;
  status: AthleteStatus;
  vacation_start: string | null; // début de la période de vacances (YYYY-MM-DD)
  vacation_end: string | null;   // fin de la période de vacances (null = indéfinie)
  last_sign_in_at: string | null;
  updated_by_coach_at: string | null;
  updated_by_client_at: string | null;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  status?: AthleteStatus;         // "active" par défaut (champ optionnel pour rétrocompat)
  vacation_start?: string | null; // période vacances (YYYY-MM-DD ou null)
  vacation_end?: string | null;
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

/** Une entrée de mesure pour une métrique corporelle (date + valeur). */
export interface MetricEntry {
  id: string;
  date: string;   // YYYY-MM-DD
  value: number;
}

/** Une métrique personnalisable (Poids, Taille, Tour de taille…). */
export interface Metric {
  id: string;
  name: string;
  unit: string;
  emoji?: string;
  entries: MetricEntry[];  // triées par date asc
  visible: boolean;
}

/** Un exercice dans une séance posée (la prescription, éditable). */
export interface ExerciseInstance {
  uid: string;
  exId: string; // référence l'exercice de la bibliothèque (ou d'un modèle)
  name: string; // nom figé à l'ajout (robuste si la biblio change)
  sets: number;
  reps: number;
  weight: number;
  rpeCoach: string | number; // RPE prescrit par le coach — texte libre "7", "7/8", "~8" (0 ou "" = non prescrit)
  rpeClient: number;         // RPE ressenti par le client (0 = non renseigné)
  coachComment: string; // consigne/note du coach pour cet exercice
  clientComment: string; // retour libre du client
  weightClient?: number; // poids réellement utilisé par le sportif (indépendant de la prescription)
  failed?: boolean; // true si le sportif a marqué l'exercice comme raté
  setsLabel?: string; // surcharge d'affichage pour sets (ex: "3-4")
  repsLabel?: string; // surcharge d'affichage pour reps (ex: "8-12")
  setLogs?: { w: number; r: number; kind?: "warmup" | "fail" }[]; // log par série — w=poids, r=reps, kind: échauffement 🔥 / échec ❌ (undefined = série de travail)
  prDismissedWeight?: number; // poids pour lequel la bannière "nouveau record" a déjà été traitée (enregistrée ou ignorée) → ne pas la re-proposer
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
  photo: string;      // URL Supabase Storage (bucket avatars) ; base64 legacy ou "" possibles
  birthDate: string;  // "YYYY-MM-DD" ou ""
  gender: string;     // "homme" | "femme" | ""
  height: string;     // cm (conservé pour rétrocompat / migration métriques)
  weight: string;     // kg (conservé pour rétrocompat / migration métriques)
  sports: string[];   // sports sélectionnés
  diet: string;
  dietComment?: string; // commentaire / retour du sportif sur sa diète
  instagram?: string;   // @username ou URL complète
  location?: { label: string; lat: number; lng: number };
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
  audioUrl?: string;          // base64 data URL audio/webm
  createdAt: string;          // ISO timestamp
  editedAt?: string;          // ISO timestamp si modifié après envoi
  senderId: string;           // user id de l'expéditeur
  senderName?: string;        // dénormalisé pour affichage
  isRead: boolean;
  type?: "broadcast" | "plan_update"; // undefined = message normal
  attachmentUrl?: string;     // Supabase Storage public URL (image ou vidéo)
  attachmentType?: "image" | "video";
  attachmentPath?: string;    // chemin Storage pour la suppression
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
  color?: string;   // couleur associée (hex) — affichée sur les chips de filtre
  isPace?: boolean; // si true, remplace "Poids (kg)" par "Allure (min/km)" dans l'éditeur
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

/** Un lien partenaire avec code promo — visible par tous, éditable coach/admin. */
export interface PartnerLink {
  id: string;
  name: string;
  url: string;
  code?: string;
  discount?: string;
  comment?: string;  // note libre du coach (infos partenariat, conditions…)
  color?: string;    // couleur hex de la bannière (ex: "#ef4444")
}

/** Produit de la boutique merch (ex: NMRY Hoodie). */
export interface MerchItem {
  id: string;
  image: string;   // URL image externe
  name: string;
  price: string;   // texte libre "59 €"
  url: string;     // lien d'achat
  comment?: string;
}

/** Recommandation produit dans l'onglet Shop. */
export interface ShopItem {
  id: string;
  image: string;
  name: string;
  brand: string;
  url: string;
  code?: string;
  discount?: string;
  comment?: string;
  category: string; // texte libre, ex: "Compléments"
}

/**
 * Plan vendable dans /shop. C'est une VITRINE qui pointe vers un Program de la
 * bibliothèque (`programId`). Comme les sportifs ne chargent pas les templates
 * (RLS coach-only), les infos d'affichage sont SNAPSHOT ici au moment de la
 * publication → lisibles par tous via library_state.
 */
export interface TrainingPlan {
  id: string;
  programId: string;          // → Program.id (source pour l'injection après achat)
  name: string;               // snapshot
  sport: string;              // snapshot
  level: string;              // snapshot
  durationWeeks: number;      // snapshot (= program.weeks.length)
  sessionsTotal: number;      // snapshot (nb de séances générées)
  price: string;              // texte libre, ex: "49 €"
  description: string;        // description marketing
  visible: boolean;           // activé / désactivé pour les sportifs
  color?: string;             // couleur hex de la bannière
  difficulty?: number;        // 1-5 (nb de gourdes 💧 remplies)
  goal?: string;              // ex: "Terminer un 10km", "Passer sous les 45 min"
  distance?: string;          // ex: "10 km", "Semi-marathon"
}

// ---- Défis & Badges ----

export type ChallengeConditionType =
  | "session_count"    // X séances validées
  | "pr_count"         // X records enregistrés
  | "streak_weeks"     // X semaines consécutives avec ≥1 séance validée
  | "goal_achieved";   // X objectifs avec au moins une épreuve "Réalisé" renseignée

export interface Challenge {
  id: string;
  icon: string;
  title: string;
  description: string;
  condition: { type: ChallengeConditionType; value: number };
  color?: string;  // hex, ex: "#534AB7"
}

export interface UnlockedBadge {
  challengeId: string;
  unlockedAt: string;  // YYYY-MM-DD
}

export interface ExerciseLibrary {
  categories: FilterCategory[];
  exercises: LibraryExercise[];
  partnerLinks?: PartnerLink[];
  merchandiseItems?: MerchItem[];
  shopItems?: ShopItem[];
  trainingPlans?: TrainingPlan[];
  shopTabsVisible?: { merch?: boolean; plan?: boolean; shop: boolean };
  challenges?: Challenge[];
  challengesVisible?: boolean;  // true = carte visible côté client sur l'accueil
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
  rpeCoach: string | number; // "" ou 0 = non prescrit
  coachComment: string;
}

/** Séance type : un modèle réutilisable de séance (coach/admin only). */
export interface SessionTemplate {
  id: string;
  name: string;
  color: string;
  description: string;
  exercises: TemplateExercise[];
  sport?: string; // ex: "Musculation", "Course à pied" — même liste que lib.categories[Sport]
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
  sport?: string; // ex: "Musculation", "Course à pied"
}

/** Programme : enchaînement ordonné de semaines types sur plusieurs semaines (coach/admin only).
 *  Brique au-dessus de la semaine type. Sert de source pour les plans vendus dans /shop. */
export interface ProgramWeek {
  weekTplId: string;   // → WeekTemplate.id
}

export interface Program {
  id: string;
  name: string;
  sport: string;        // ex: "Course à pied", "Muscu"
  level: string;        // "Débutant" | "Intermédiaire" | "Avancé"
  description: string;
  weeks: ProgramWeek[]; // liste ordonnée — une même semaine type peut être répétée
}

/** Ensemble des templates, stocké dans template_state (Supabase). */
export interface TemplateLibrary {
  sessionTemplates: SessionTemplate[];
  weekTemplates: WeekTemplate[];
  programs?: Program[];
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

/** Option d'info affichée sur une carte de l'accueil. */
export type CardInfoOption =
  | "hidden"
  | "nextSession"       // prochaine séance à venir (plan)
  | "weekPct"           // % séances réalisées cette semaine (plan)
  | "remaining"         // nombre de séances restantes (plan)
  | "lastRecord"        // dernier record enregistré (records)
  | "chosenRecord"      // record d'un exercice au choix (records)
  | "activeInjury"      // blessure active (suivi)
  | "lastNote"          // dernier bloc-note (suivi)
  | "exerciseCount"     // nombre d'exercices disponibles (bibliothèque)
  | "favoriteExercise"; // exercice favori ⭐ (bibliothèque)

/** Préférences visuelles par compte (couleurs cartes accueil…). */
export interface UserPreferences {
  cardColors: Record<string, string>;              // href → couleur hex
  cardColorMode: "arc" | "full";                   // arc de cercle ou fond entier
  cardInfoMode?: Record<string, CardInfoOption>;   // option d'info par carte (href → option)
  chosenRecordExerciseId?: string;                 // exercice choisi pour "chosenRecord"
  favoriteExerciseId?: string;                     // exercice favori ⭐ bibliothèque
  notifPrefs?: NotifPrefs;                         // préférences notifications
  planNotifSentAt?: Record<string, string>;        // coach : dernière notif programme par clientId (ISO timestamp)
}

/** Document complet d'un client (stocké en JSON dans app_state.data). */
export interface AppState {
  profile: UserProfileData;
  sessions: SessionInstance[]; // toutes les séances (date = null si dans la banque)
  goals: Goal[];
  followups: Followup[];
  notes: BlockNote[];          // bloc-notes partagé sportif ↔ coach
  library: ExerciseLibrary;
  records: RecordsData;
  preferences: UserPreferences;
  metrics?: Metric[];          // métriques corporelles personnalisables
  badges?: UnlockedBadge[];    // badges débloqués par le sportif
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
  notes: [],
  library: defaultLibrary(),
  records: emptyRecords(),
  preferences: { cardColors: {}, cardColorMode: "full" },
});
