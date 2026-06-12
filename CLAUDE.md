# NMRY Coaching — contexte projet

App de coaching **musculation** (mobile-first, responsive PC) : interface **coach/sportif** pour
profil & diète, plan d'entraînement, objectifs/compétitions, records, suivi et bibliothèque d'exercices.
UI **en français**.

## Stack
- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** (config via `@theme` dans `app/globals.css`, pas de `tailwind.config`)
- **Supabase** (auth email + Postgres + RLS + Realtime) via `@supabase/ssr` — **actuellement ACTIVÉ**
- **nodemailer** + Gmail SMTP — emails d'alerte urgence coach (pas de custom domain requis)
- **web-push** — notifications push PWA (VAPID). ⚠️ `lib/push.ts` **tolère l'absence des clés
  VAPID** (skip `setVapidDetails` + `sendPush*` no-op si non configuré) → le build ne plante plus
  en local sans clés ; en prod (Vercel, clés posées) les push fonctionnent.
- **immer** — mutations immuables de l'état (`update`/`updateLibrary`/`updateTemplates`) avec
  **partage structurel** (plus de `structuredClone` intégral à chaque frappe → fluidité de saisie).
- Déploiement **Vercel** (auto-deploy sur push `main`)

## Commandes
```bash
npm run dev      # http://localhost:3000
npm run build    # build de prod — ARRÊTER le dev avant de lancer !
npx tsc --noEmit # type-check seul (sûr, ne touche pas au cache)
```

### ⚠️ Pièges à éviter (déjà rencontrés, font perdre du temps)
- **Ne JAMAIS lancer `npm run build` pendant que `next dev` tourne** : ils partagent `.next/` et
  se corrompent. Pour valider un build : **arrêter le serveur de preview d'abord**, builder, relancer.
  Pour un simple check TS pendant le dev : `npx tsc --noEmit`.
- Si le cache `.next` est corrompu : `rm -rf .next` puis relancer le dev.
- **Outil de preview** : la navigation programmatique (`location.href`) est instable et revient sur `/`.
  Préférer **cliquer les liens** (`a[href=...]`). Après clic, laisser ~4-8 s (compile + hydratation).
- **Tests sans `.env.local`** : faire `mv .env.local .env.local.bak`, supprimer `.next`, rebuilder,
  et **restaurer** (`mv .env.local.bak .env.local`). Le comportement Edge ne se reproduit qu'avec
  un vrai build prod sans le fichier.
- **Exports dans `page.tsx`** : Next.js n'autorise que `default` + exports réservés (`generateMetadata`…).
  Tout composant partagé doit vivre dans `components/`.
- **Instancier les clients tiers dans le handler**, jamais au module-level
  (`const x = new Client(process.env.KEY)` en dehors d'une fonction) → crash build Vercel
  si la variable d'env est absente au moment du bundling.

## Variables d'environnement
| Variable | Scope | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Clé anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Serveur uniquement** | Clé service role — accès admin |
| `GMAIL_USER` | **Serveur uniquement** | Compte Gmail expéditeur ex: `simon.nemery@gmail.com` |
| `GMAIL_APP_PASSWORD` | **Serveur uniquement** | Mot de passe d'application Google (16 chars, sans espaces) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public | Clé VAPID publique pour les push notifications |
| `VAPID_PRIVATE_KEY` | **Serveur uniquement** | Clé VAPID privée — ne jamais exposer |
| `CRON_SECRET` | **Serveur uniquement** | Secret pour sécuriser `GET /api/cron/reminders` |

`SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_APP_PASSWORD`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` ne doivent **jamais** être exposées côté client.

### Valeurs VAPID actuelles (générées une fois, ne pas regénérer)
- Public : `BDt3cgXasa7mT_7V8Np5vZIGBlDaQBfR114Zqfh80vqoVIxe6fqyGMVQhG6DpY9e5k6h_lBpOmeJn5ES_yjaaco`
- Private : dans Vercel uniquement — ne pas committer

## Authentification & modes d'accès
`lib/config.ts` → `AUTH_ENABLED = true` (activé). **Le mode invité a été supprimé.**

### 2 modes
| Mode | Déclenchement | Données |
|---|---|---|
| **Auth (compte)** | Login email/mdp | Supabase (`app_state`) |
| **Local forcé** | `AUTH_ENABLED = false` | localStorage — bypass total du login |

- Pour basculer en **mode local forcé** : `AUTH_ENABLED = false` dans `lib/config.ts`.

### Auth flow complet (AUTH_ENABLED = true)
1. **Inscription** : nom + email + mdp → `supabase.auth.signUp` → notif push aux coaches/admins → écran "Confirme ton email 📬"
2. **Confirmation email** : lien → `/auth/callback?code=…` → échange PKCE → session → notif push coaches/admins → redirect `/`.
3. **Connexion** : email + mdp → `signInWithPassword` → `/`
4. **Reset mdp** : email → `/auth/callback?next=/auth/reset-password` → `updateUser({ password })` → `/`
5. **Déconnexion** : `supabase.auth.signOut()` → `/login` (bouton dans `/settings`)
6. **Nouveau sportif sans coach** → `NoCoachGate` bloque l'accès → écran `NoCoachScreen` affiché

### ⚠️ Configuration Vercel/Supabase requise
- **Vercel** : toutes les variables d'env ci-dessus
- **Supabase → Auth → URL Configuration** :
  - Site URL : `https://nmry-coaching.vercel.app`
  - Redirect URLs : `https://nmry-coaching.vercel.app/auth/callback` + `http://localhost:3000/auth/callback`
- Après changement d'env vars Vercel : **redéployer manuellement**.

### ⚠️ Auth redirects toujours vers la prod
`app/login/page.tsx` utilise `const SITE_URL = "https://nmry-coaching.vercel.app"` (hardcodé, pas
`window.location.origin`) pour les callbacks signup et reset-password. Intentionnel : évite que
les liens envoyés par email pointent vers `localhost` quand quelqu'un demande un reset depuis
le dev local. **Ne pas revenir à `window.location.origin`.**

### ⚠️ Limite emails Supabase (plan gratuit : 2-3 emails/heure)
**Fix immédiat — changer le mdp sans email (SQL Editor Supabase) :**
```sql
UPDATE auth.users
SET encrypted_password = crypt('nouveau_mdp', gen_salt('bf'))
WHERE email = 'user@email.com';
```

**Augmenter la durée des liens OTP :**
Supabase → Authentication → Email → "OTP Expiry" → `86400` (24h).

### ⚠️ Piège middleware — `MIDDLEWARE_INVOCATION_FAILED`
Le middleware vérifie la présence des variables avant de créer le client Supabase.
Les routes `/auth/*` sont exclues de la protection.
Intercepte `?error=access_denied` sur `/` → redirect `/login?error=lien_invalide`.

### État Supabase
- Projet ref : `zhvfqcxdifribggyzxgk`
- Schéma : `supabase/schema.sql` (tables `profiles`, `app_state`, `library_state`, RLS, triggers)
- **Pour ajouter un coach** (après inscription dans l'app) :
  `update public.profiles set role = 'coach' where email = 'EMAIL';`
  L'architecture supporte plusieurs coachs simultanément.

## Sécurité

### RLS Supabase
- `state_self_all` (sportif → ses données), `state_coach_all` (coach → **uniquement ses sportifs affectés** via `coach_client` + sa propre ligne), `library_read_all` (tous → lecture), `library_coach_write` (coach → écriture). L'admin garde l'accès complet via `state_admin_all`.
- `profiles_self_update` : `using (id=auth.uid())` **+ `with check (id=auth.uid())`**. Le changement de rôle reste bloqué par le trigger `prevent_role_escalation` (admin only). Le coach modifie le statut d'un sportif via service-role (contourne la RLS).
- **`template_state`** : RLS `template_coach_all` — `is_coach()` uniquement (bloque les clients).
- **`broadcasts`** : RLS `broadcast_coach` (coach → ses broadcasts), `broadcast_client_read` (client → broadcasts de son coach).
- **`push_subscriptions`** : RLS `push_own` (utilisateur → ses propres subscriptions).
- **`coach_client`** : RLS `cc_read` (coach_id = auth.uid() ou is_admin()). ⚠️ Le client ne peut PAS lire cette table directement → utiliser `/api/me/has-coach` (admin client bypass).
- **Trigger `prevent_role_escalation`** : empêche un sportif de se passer coach via l'API.

### ⚠️ Isolation `app_state` entre profils (anti-contamination) — CRITIQUE
`pushNow` (DataProvider) écrit le **blob `app_state` entier** du profil actif via une
sauvegarde différée (**2 s** ; + **dédoublonnage** : ne réécrit pas un blob identique au dernier
sauvegardé, baseline `lastSavedJson` amorcée au chargement → ↓ Disk IO Supabase).
Un changement de profil rapide côté coach pouvait écrire les
données d'un sportif dans la ligne d'un autre (incident réel : fiche affichant les données
d'un autre sportif). **Trois garde-fous** sont en place — ne pas les retirer :
1. **Write-fence** : `pushNow(expectedUserId)` abandonne la sauvegarde si `activeUserId` a
   changé depuis sa programmation.
2. **`update()`** lie chaque sauvegarde différée au profil édité (capture `activeRef.current`).
3. **`switchClient`** flush la sauvegarde en attente AVANT de charger le profil suivant.
+ RLS `state_coach_all` resserrée (coach → sportifs affectés) = filet de sécurité en base.
> Cause structurelle = blob monolithique. Migration future recommandée : `sessions`/`profile`
> en colonnes/tables dédiées → écritures ciblées, fin des races de blob.

### Guards applicatifs
- `update()` dans DataProvider refuse si `role=client` et `activeUserId ≠ me.id`.
- `PUT /api/library` restreint aux coaches/admins (RLS + route guard).
- `updateTemplates()` refuse si rôle n'est pas coach/admin.
- Open redirect : `?next=` validé chemin relatif uniquement (`startsWith("/") && !startsWith("//")`) dans `/auth/callback`.

### Guards API (audit complet — dernière passe)
- **Helper mutualisé** : `lib/apiAuth.ts` → `requireRole(["coach","admin"])` (ou `["admin"]`,
  `["coach"]`) retourne `{ user, role }` ou `null` (→ 401). À utiliser pour toute nouvelle route
  (remplace les anciennes gardes locales dupliquées `requireAdmin`/`requireElevated`/`requireCoach`).
- **Session** : toutes les routes vérifient `supabase.auth.getUser()` avant toute action.
- **Rôle** : routes elevées vérifient `role === "coach"|"admin"`, routes admin vérifient `role === "admin"`.
- **Email d'urgence** : nom + texte échappés (HTML) avant insertion dans le mail (anti-injection).
- **Ownership DELETE** : `DELETE /api/coach/athletes/[id]` — un coach ne peut supprimer que ses propres clients affectés.
- **Ownership PATCH** : `PATCH /api/coach/athletes/[id]` — un coach ne peut modifier le statut que de ses propres clients.
- **`clientId` anti-usurpation** : vérifié `=== user.id` dans `urgent`, `notify-injury`, `messages/notify`.
- **UUID validation** : `recipientId` dans `messages/notify` validé regex UUID avant interpolation PostgREST.
- **`/api/coach/self-assign`** : vérifie que `clientId` a le rôle `"client"` + bloque si déjà affecté à un autre coach (409).
- **`/api/admin/assignments`** : vérifie que `coachId` est coach/admin et `clientId` est client avant insertion.
- **`/api/auth/on-signup`** : anti-replay — `Max(created_at, email_confirmed_at) < 5 min` (couvre session immédiate et flow confirmation email).
- **`CRON_SECRET`** : si absent → 503 ; si mauvais → 401 (jamais `Bearer undefined` accepté).
- **Taille** : `broadcasts` max 2 000 chars, `injuryText` max 500 chars.
- **Erreurs 500** : messages Supabase internes remplacés par messages génériques (pas de fuite d'info).
- **`req.json()`** : wrappé dans `.catch(() => ({}))` sur toutes les routes POST/DELETE.

## Rôles coach / sportif
Exposés par `useData()` : `role`, `me`, `clients`, `activeUserId`, `switchClient`, `library`,
`updateLibrary`, `templates`, `updateTemplates`, `hasCoach`.

- **Coach / Admin** : crée et édite les séances, gère la bibliothèque partagée, gère les templates
  (séances types + semaines types), peut dupliquer des semaines.
  Voit un `ClientSelector` dans le header (dropdown via portal, évite le clipping backdrop-blur).
  Le sportif sélectionné est persisté dans `localStorage` (`nmry-coach-selected-client`).
  Voit les objectifs de **tous** les sportifs sur son calendrier (chargés en parallèle).
  Accès à `/overview` (blessures actives + objectifs agrégés) et à la Vue Gestion des Profils.
  Reçoit un **email + push** quand un sportif envoie un message urgent.
  Peut envoyer un **broadcast popup** à tous ses sportifs (Settings → Sportifs).
  Reçoit push pour : nouveau message, message urgent, blessure sportif, nouvelle inscription.
- **Sportif** : place les séances, renseigne ressenti (emoji 1-5), RPE, commentaire, valide une séance.
  La prescription est en lecture seule. La bibliothèque est en lecture seule (pas les templates).
  **Sans coach affecté** : `hasCoach = false` → bloqué sur `NoCoachScreen` jusqu'à affectation.
  Reçoit push pour : nouveau message, nouveau programme, rappel séance du jour (7h), J-7/J-1 objectif.

## Modèle de données (`lib/types.ts` → `AppState`)
Document unique par sportif (JSON dans `app_state.data` Supabase) :

- `profile: UserProfileData` :
  `name`, `photo` (**URL Supabase Storage** bucket `avatars` ; compressée à l'upload max 512px
  JPEG 0.72 ; base64 legacy encore possible pour d'anciens profils → s'allège au prochain changement),
  `birthDate`, `gender`, `height`, `weight`, `sports[]`, `diet`,
  `mapConsent?` (carte communauté, voir **Carte communauté**),
  `instagram?` (`@handle` ; le `@` est un préfixe visuel en `span` flex hors de l'`input`, la valeur
  stockée n'inclut pas de `@` doublé), `location?` (`{ label, lat, lng }` via API Nominatim/OpenStreetMap).
  ⚠️ `diet` est affiché/édité dans `/followup` (pas `/profile`).
  ⚠️ `height`/`weight` ne sont plus éditables dans `/profile` (remplacés par insta + localisation) :
  ils servent de valeurs initiales migrées vers les **métriques** (voir `metrics`). `/profile` propose
  désormais : photo, nom, naissance, genre, **Instagram**, **localisation**, sports.

- `sessions: SessionInstance[]` — **liste à plat** :
  - `date = null` → banque « À placer » ; `date = "YYYY-MM-DD"` → placée.
  - `ExerciseInstance` : `uid`, `exId`, `name`, `sets`, `reps`, `weight`, `rpeCoach`, `rpeClient`,
    `coachComment`, `clientComment`, `weightClient?`, `failed?`, `setsLabel?`, `repsLabel?`.
    `weight/rpeCoach = 0` → non renseigné. `setsLabel`/`repsLabel` = surcharge texte (ex: "3-4").
    `failed = true` → exercice raté par le sportif (affiché à la place du RPE).
    `weightClient?` = poids **réellement réalisé** par le sportif (indépendant de la prescription
    `weight` du coach ; saisissable même si le coach ne prescrit rien, ex. « travaille ton max »).
    Affiché en vert dans la synthèse `/plan` + vue coach (« Réalisé »).
  - **Allure (course)** : un exercice tagué `isPace` (option de filtre) utilise l'allure (min/km)
    au lieu du poids (kg). `weight`/`weightClient` stockent alors des **minutes décimales**.
    Saisie via `PaceInput` (`SessionEditor`) : accepte `5:30` (mm:ss) ou `5.5` (décimal), affiche
    « 5 min 30 s/km » en live. Côté coach (prescrit) et sportif (réalisé).
  - **Verrou date** : quand `session.done === true`, la date est figée (input désactivé côté sportif,
    drag bloqué dans `/plan`, garde dans `place()`). Indicateur 🔒.

- `goals: Goal[]` : `competition`, `date`, `place`, `expected` (commentaires libres),
  `events?: GoalEvent[]` (épreuves structurées `{ id, name, planned, achieved }`),
  `clientName?` (enrichi côté coach, non persisté).

- `followups: Followup[]` : `date` (début), `dateEnd?` (fin, blessures uniquement),
  `type` (`"note"|"injury"|"pain"`), `text`.
  Les blessures actives apparaissent dans le calendrier (`/plan`) et la vue d'ensemble (`/overview`).
  Déclarer une blessure (`type="injury"`) → push au coach si `notifPrefs.newInjury`.

- ⚠️ **`messages` NE SONT PLUS dans `app_state`** : le chat vit dans la table dédiée
  `chat_messages` (voir section **Chat**). Le champ `AppState.messages` est conservé en type pour
  rétrocompat/migration mais l'app n'y lit/écrit plus.

- `notes: BlockNote[]` : bloc-notes partagé sportif ↔ coach.
  `{ id, text, createdAt, updatedAt?, authorId, authorName, authorRole }`.
  Les deux peuvent ajouter des notes. Modifier/supprimer : auteur seulement.

- `metrics?: Metric[]` : métriques corporelles personnalisables (Poids, Taille, Tour de taille…).
  `Metric { id, name, unit, emoji?, entries: MetricEntry[], visible }`,
  `MetricEntry { id, date, value }`. Affiché dans **`/followup` → Santé → sous-onglet Métriques**
  (sous-onglets **Données** : cartes + tendance ↗/↘ +% vert/rouge + historique + ajout d'entrée ;
  **Tendances** : graphique SVG multi-courbes, toggles de sélection, périodes 1/3/6 mois/tout.
  ⚡ **Axes** : axe Y (3 valeurs min/milieu/max + unité si 1 seule courbe), axe X (3 dates :
  début/milieu/fin), échelle Y globale, **tooltip au tap** sur un point (date + valeur exacte)).
  Migration auto au 1er chargement : `profile.height`/`profile.weight` → 1ère entrée des métriques.

- `challenges?: Challenge[]` : défis (badge, titre, objectif, progression).
  `Challenge { id, emoji, title, target, unit, value, badgeImage? }`.
  `badgeImage?` = URL Storage bucket `badges` (image personnalisée uploadée par le coach, 256 px JPEG,
  s'affiche à la place de l'emoji dans `BadgeCard` et la liste des défis).

- `records: RecordsData` : force (max 3 par exercice), CAP, Hyrox.
- `preferences: UserPreferences` : `cardColors` (href→hex), `cardColorMode` (`"arc"|"full"`), `notifPrefs?: NotifPrefs`, `planNotifSentAt?` (coach : dernière notif programme par clientId).
- `library` : **ignoré en mode auth** — la bibliothèque vient de `library_state` (table dédiée, singleton).

### NotifPrefs (dans UserPreferences)
```typescript
interface NotifPrefs {
  newMessage: boolean;      // nouveau message chat (défaut: true)
  newPlan: boolean;         // nouveau programme publié (sportif, défaut: true)
  urgentMessage: boolean;   // message urgent d'un sportif (coach, défaut: true)
  newInjury: boolean;       // blessure déclarée (coach, défaut: true)
  goalReminder: boolean;    // J-7 / J-1 objectif (sportif, défaut: true)
  sessionReminder: boolean; // séance du jour à 7h (sportif, défaut: true)
}
```
Géré dans Settings → Affichage → Notifications (toggles role-based via `NotifPrefsPanel`).

### CardInfoOption & personnalisation de l'accueil
```typescript
type CardInfoOption =
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
```
- `cardInfoMode?: Record<string, CardInfoOption>` — option par carte (`href → option`), défaut `"hidden"` sauf Objectifs (toujours affiché)
- `chosenRecordExerciseId?: string` — exercice choisi pour `"chosenRecord"`
- `favoriteExerciseId?: string` — exercice marqué ⭐ dans la bibliothèque (un seul à la fois)
- Géré dans Settings → Cartes → sous-onglet **🏠 Accueil** (pills de sélection + picker exercice)
- Affiché sur l'accueil en `text-[11px] text-dim` sous le label de chaque carte
- La bibliothèque affiche un bouton ⭐/☆ sur chaque exercice (coach et sportif)
- `cardColorMode` défaut : `"full"` (fond complet)

### Templates (coach/admin uniquement)
Stockés dans `template_state` (singleton Supabase, RLS `is_coach()`).
Chargés dans `DataProvider` → `templates: TemplateLibrary`.
Mutés via `updateTemplates((t) => { ... })` — debounce 2 s → `PUT /api/templates`.

```typescript
TemplateLibrary {
  sessionTemplates: SessionTemplate[]  // séances types réutilisables
  weekTemplates: WeekTemplate[]        // semaines types (grille 7 jours)
}
SessionTemplate { id, name, color, description, exercises: TemplateExercise[] }
TemplateExercise { uid, exId, name, sets, setsLabel?, reps, repsLabel?, weight, rpeCoach, coachComment }
WeekTemplate { id, name, description, days: WeekTemplateDay[] }
WeekTemplateDay { dayIndex: 0-6, sessions: { tplId }[] }
```

### Schéma Supabase complet
| Table | Rôle |
|---|---|
| `profiles` | `id, email, name, role, status`. `status` = `active`/`inactive` |
| `app_state` | `user_id, data (jsonb), updated_at, updated_by_coach_at, updated_by_client_at` |
| `library_state` | Singleton id=1, bibliothèque d'exercices partagée |
| `template_state` | Singleton id=1, templates séances/semaines types (RLS coach) |
| `coach_client` | `coach_id, client_id, assigned_at` — affectations |
| `broadcasts` | `id, coach_id, message, created_at, expires_at` — popups broadcast |
| `push_subscriptions` | `id, user_id, endpoint, p256dh, auth, updated_at` — souscriptions push |
| `chat_messages` | `id, coach_id, client_id, sender_id, sender_name, body, audio_url, audio_path, is_voice, is_urgent, type, is_read, created_at, edited_at` — chat isolé par conversation (`audio_path` = chemin Storage pour les vocaux migrés) |

### ⚠️ SQL à exécuter dans Supabase si pas encore fait
```sql
-- audio_path sur chat_messages (vocaux → Storage)
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS audio_path TEXT;

-- bucket badges (images personnalisées pour les défis)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('badges', 'badges', true, 2097152)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY IF NOT EXISTS "badges_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'badges' AND auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "badges_update" ON storage.objects FOR UPDATE USING (bucket_id = 'badges' AND auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "badges_read"   ON storage.objects FOR SELECT USING (bucket_id = 'badges');
CREATE POLICY IF NOT EXISTS "badges_delete" ON storage.objects FOR DELETE USING (bucket_id = 'badges' AND auth.role() = 'authenticated');

-- template_state
CREATE TABLE IF NOT EXISTS public.template_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL DEFAULT '{"sessionTemplates":[],"weekTemplates":[]}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.template_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_coach_all ON public.template_state
  FOR ALL USING (public.is_coach()) WITH CHECK (public.is_coach());

-- broadcasts
CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY broadcast_coach ON public.broadcasts FOR ALL USING (coach_id = auth.uid());
CREATE POLICY broadcast_client_read ON public.broadcasts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.coach_client WHERE coach_id = broadcasts.coach_id AND client_id = auth.uid())
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;

-- push_subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_own ON public.push_subscriptions FOR ALL USING (user_id = auth.uid());
```

### Bibliothèque partagée (`library_state`)
Table Supabase singleton (id=1), lisible par tous, éditable coach/admin seulement.
`tags: Record<string, string[]>` — multi-sélection (OR dans une catégorie, AND entre catégories).
`comment?: string` — description libre de l'exercice.
Page `/library` : 3 onglets — Exercices (tous) | Séances types (coach/admin) | Semaines types (coach/admin).

**Contenu Shop & Avantages** (aussi dans `library_state`, donc **global** à tous, pas par coach) :
- `partnerLinks?: PartnerLink[]` — `{ id, name, url, code?, discount?, comment? }` (onglet Parrainage)
- `merchandiseItems?: MerchItem[]` — `{ id, image, name, price, url, comment? }` (onglet Merch)
- `shopItems?: ShopItem[]` — `{ id, image, name, brand, url, code?, discount?, comment?, category }` (onglet Shop)
- `shopTabsVisible?: { merch, shop }` — onglets Merch/Shop masqués par défaut, activés par le coach.
Page `/shop` (bouton 🎁 dans le header). Visible client seulement si du contenu existe + onglet visible.

## PWA & Push notifications
- `public/manifest.json` + `public/sw.js` → site installable (PWA)
- `public/icon-192.png` + `public/icon-512.png` → icônes carrées générées avec Pillow (logo centré + padding)
- `public/logo-light.png` / `public/logo-dark.png` → logo header (adapté au thème)
- Service Worker : gère `push` event → `showNotification`, clic → ouvre l'app sur la bonne page
- **SW enregistré globalement** via `ServiceWorkerRegistrar` (monté dans `(app)/layout.tsx`) — pas seulement depuis Settings.
- **`next.config.mjs`** : header `Cache-Control: no-cache` + `Service-Worker-Allowed: /` sur `/sw.js` (scope iOS PWA).
- **Re-synchro abonnement** : `NotifPrefsPanel` ré-upsert l'abonnement local en base au montage (évite endpoint périmé après réinstall PWA / rotation service push, qui affichait "Activées" sans recevoir de push).
- **Bouton "🔔 Envoyer une notif de test"** dans Settings → Notifications : `POST /api/push/test` renvoie un diagnostic détaillé (config VAPID, souscription absente, code d'erreur Apple/Google) — pour debug à distance sur mobile.
- **iOS** : notifications push uniquement si installé en PWA (Safari → Partager → Sur l'écran d'accueil), iOS 16.4+ requis
- **Android** : fonctionne directement depuis Chrome
- `lib/push.ts` : `sendPushToUser(userId, payload)` + `sendPushToCoachClients(coachId, payload)`
  — supprime automatiquement les souscriptions expirées (410/404)
- `lib/notifPrefs.ts` : `getUserNotifPrefs(userId)` — lit `app_state` via admin client, defaults tout à `true`

## Broadcast popup (coach → tous ses sportifs)
- Coach : Settings → Sportifs → `BroadcastComposer` → textarea + bouton "Envoyer à tous"
- `POST /api/broadcasts` → insert en base + push Realtime + push notification
- Sportif : `BroadcastPopup` (monté dans `(app)/layout.tsx`) — charge les non-vus au montage + subscribe `postgres_changes INSERT`
- IDs vus stockés en `localStorage` (`nmry_seen_broadcasts`, max 200) → ne réapparaît jamais
- Expire après 24h (`expires_at`)

## Chat coach ↔ sportif (table dédiée `chat_messages`)
**Refonte (2026-06)** : les messages étaient entassés dans `app_state.data.messages` de chaque
sportif → re-upsert du blob entier à chaque envoi → **contamination croisée** entre conversations
(le coach voyait les échanges d'autres sportifs). Désormais une **table dédiée** garantit l'isolation.

- **Conversation = couple `(coach_id, client_id)`**. Chaque message est une ligne ; lire une
  conversation = `WHERE client_id = X`. Plus aucun mélange possible.
- Colonnes : `id, coach_id, client_id, sender_id, sender_name, body, audio_url, is_voice,
  is_urgent, type, is_read, created_at, edited_at`. `type` = `null` (normal) | `broadcast` | `plan_update`.
- **RLS** : `chat_self` (sportif → sa conv), `chat_coach` (coach → conv de SES sportifs via
  `coach_client`), `chat_admin` (admin → tout).
- **Accès via API uniquement** (admin client server-side, autorisation en code) :
  - `GET /api/chat?clientId=…[&before=ISO]` → **paginé (15 derniers)** + `participants {client,
    coach}` (id/**nom/rôle** seulement) + `hasMore`. `before` = curseur pour remonter l'historique.
    Marque comme lus à la 1ʳᵉ page. ⚡ Payload **ultra léger** : exclut `audio_url` (vocaux base64,
    au play) **ET les photos** (base64, parfois lourdes pour de vieux uploads). Participants résolus
    en **1 requête batchée** (`resolveParticipants` + `.in(...)`) → chemin critique minimal.
  - `GET /api/chat/avatars?clientId=…` → `{ client:{id,photo?}, coach:{id,photo?} }`. Photos
    chargées **hors du chemin critique** (les messages s'affichent sans les attendre). Même
    autorisation que `/api/chat`. Front : cache par personne (`avatarCache`), fusion dans `avatarPhotos`.
  - `GET /api/chat/audio?id=…` → renvoie l'audio (data URL) d'**un** message vocal au moment du
    play (autorisation : sportif de la conv, son coach, ou admin). Allège fortement la liste.
  - `POST /api/chat` `{ clientId?, text?, audioUrl?, isVoice?, isUrgent? }` → insert + push.
    Coach→sportif : push si pref `newMessage`. Sportif→coach : push (sauf si urgent → géré par
    `/api/messages/urgent` qui fait email + push, pour éviter le **double push**).
  - `PATCH /api/chat/:id` `{ text }` / `DELETE /api/chat/:id` → auteur (ou admin) seulement.
  - `GET /api/chat/unread` → `{ count, urgent }` pour l'appelant (coach = total tous sportifs).
    Utilisé par le badge « Mon Suivi » **et** le bandeau « Vue d'ensemble 🚨 » du dashboard
    (l'accueil ne lit plus l'ancien `app_state.data.messages`).
- **Helpers** : `lib/chat.ts` → `insertChatMessage`, `rowToMessage`, `getCoachOf`.
  Utilisés aussi par `/api/broadcasts` (`type:'broadcast'`) et `/api/plan/notify` (`type:'plan_update'`).
- **Front** (`MessagesTab` dans `/followup`) : fetch via API, **avatars chargés séparément** des
  messages (photo réelle via `/api/chat/avatars` ou initiales colorées en attendant), groupement
  des messages consécutifs (avatar/nom en tête de série seulement).
  **Pagination** : 15 derniers + bouton « Voir les messages précédents » (conserve la position de
  scroll). **Vocaux chargés à la demande** : `VoicePlayer` récupère l'audio via `/api/chat/audio`
  au 1er play (indicateur ⏳), garde le chemin direct si `audioUrl` déjà présent. Urgent (bandeau
  rouge + email), édition/suppression : inchangés.
- ⚡ **Realtime** : `MessagesTab` s'abonne aux `postgres_changes` de `chat_messages` filtrés
  `client_id=eq.<conversation active>` (INSERT/UPDATE/DELETE) → messages **en direct** sans
  recharger, accusés de lecture ✓✓ live. Isolation : un seul `client_id` par canal + RLS
  (`chat_self`/`chat_coach`/`chat_admin`) borne ce que l'abonné reçoit. L'INSERT Realtime **omet
  l'audio** (lazy-load au play conservé). ⚠️ Nécessite `chat_messages` dans la publication
  `supabase_realtime` (bloc idempotent dans `schema.sql`). L'envoi refait quand même un
  `loadMessages` (fonctionne même si Realtime pas encore activé en base).
- ⚡ **Cache mémoire** (`chatCache`, module-level) : réaffiche la conversation **instantanément**
  au retour sur l'onglet, puis revalide en arrière-plan. Tenu à jour à chaque évolution de la liste.
- **Migration** : backfill idempotent dans `schema.sql` (depuis `app_state.data.messages`).
  ⚠️ Relancer `schema.sql` dans Supabase pour créer la table + migrer l'historique + activer Realtime.

## Stockage & quotas Supabase (Disk IO / egress)
Plan actuel : **Pro** (250 Go d'egress/mois, compute supérieur). Passé en Pro en 2026-06 suite à
un dépassement du plan gratuit (5 Go) qui a rendu le site inaccessible (504 GATEWAY_TIMEOUT).
**Cause racine = le blob `app_state` monolithique** (lu en entier à chaque chargement,
réécrit en entier à chaque édition) + base64 dans les lignes.

**Mitigations en place :**
- **Médias hors blob → Supabase Storage** (buckets publics, chemins horodatés, `cacheControl: 1 an`) :
  - `avatars` — photos de profil (upload direct navigateur, voir `/profile`). Migration faite (3 photos migrées).
  - `chat-attachments` — photos/vidéos du chat (upload direct) **+ vocaux** (nouveaux enregistrements uploadés directement ; migration faite, 2 vocaux migrés, colonne `audio_path` ajoutée).
  - `badges` — images personnalisées pour les défis (max 2 Mo, compressées à 256 px JPEG 0.82).
- **Sauvegardes `app_state` débouncées à 2 s + dédoublonnées** (pas de réécriture d'un blob identique).
- **immer** (partage structurel) au lieu de `structuredClone` intégral.
- Requêtes ciblées : chat exclut `audio_url`/photos du payload ; cron lit des sous-champs.

**Routes de migration one-shot (admin) :**
- `GET /api/admin/migrate-photos` — migre les photos base64 legacy de `app_state` → bucket `avatars`.
- `GET /api/admin/migrate-audio` — migre les vocaux base64 de `chat_messages.audio_url` → bucket `chat-attachments`.
Ces routes sont idempotentes (sautent les URLs déjà en https://).

**Leviers restants (par impact) :** **sortir `sessions`/`records` du blob**
en tables dédiées (fix de fond — supprime la cause racine).

## Cron Vercel
`vercel.json` : `GET /api/cron/reminders` tous les jours à 7h (`0 7 * * *`).
Sécurisé par `Authorization: Bearer <CRON_SECRET>`. Si `CRON_SECRET` absent → 503.
Pour chaque sportif client : rappel séance du jour + rappels J-7/J-1 objectifs (selon `notifPrefs`).
⚡ Ne charge que les sous-champs utiles (`data->sessions/goals/preferences`) des seuls sportifs,
pas le blob `app_state` entier de tout le monde.

## Routes API (server-side, service role)
| Route | Méthode | Rôle | Guard |
|---|---|---|---|
| `/api/coach/athletes` | GET | Profils + timestamps | requireElevated |
| `/api/coach/athletes/[id]` | PATCH | Status (coach → ses clients seulement) / role (admin) | requireElevated + ownership |
| `/api/coach/athletes/[id]` | DELETE | Suppression compte | requireElevated |
| `/api/coach/self-assign` | POST | Affecter coach → client (bloque si déjà pris) | requireCoach |
| `/api/coach/unassigned` | GET | Clients sans coach | requireElevated |
| `/api/admin/overview` | GET | Vue complète coaches + clients | requireAdmin |
| `/api/admin/assignments` | POST | Affecter client à coach | requireAdmin |
| `/api/admin/assignments/[id]` | DELETE | Désaffecter | requireAdmin |
| `/api/library` | PUT | Sauvegarde bibliothèque | requireElevated (coach/admin) |
| `/api/templates` | GET/PUT | Templates coach/admin | requireCoach |
| `/api/chat` | GET | Messages d'une conversation + participants (marque lus) | auth + ownership/coach |
| `/api/chat` | POST | Envoyer message (texte/vocal) + push | auth + ownership/coach |
| `/api/chat/[id]` | PATCH/DELETE | Éditer/supprimer un message | auth + auteur (ou admin) |
| `/api/chat/audio` | GET | Audio d'un message vocal, à la demande (au play) | auth + sportif/coach/admin de la conv |
| `/api/chat/avatars` | GET | Photos des participants, hors chemin critique | auth + sportif/coach/admin de la conv |
| `/api/chat/unread` | GET | Compteur `{count, urgent}` non lus de l'appelant | auth |
| `/api/messages/urgent` | POST | Email + push urgent au coach | auth + clientId===user.id |
| `/api/messages/notify` | POST | Push nouveau message (legacy, plus utilisé par le chat) | auth + vérif lien coach_client |
| `/api/followup/notify-injury` | POST | Push blessure → coach | auth + clientId===user.id |
| `/api/plan/notify` | POST | Push nouveau programme → sportifs | requireCoach |
| `/api/broadcasts` | POST | Créer broadcast + push | requireCoach |
| `/api/broadcasts` | GET | Broadcasts actifs pour le client | auth |
| `/api/push/subscribe` | POST/DELETE | Gérer souscription push | auth |
| `/api/push/test` | POST | Notif de test à soi-même (diagnostic) | auth |
| `/api/auth/on-signup` | POST | Push nouvelle inscription → coaches/admins | auth |
| `/api/me/has-coach` | GET | Vérifie si client a un coach (bypass RLS) | auth |
| `/api/cron/reminders` | GET | Rappels séance + objectifs (cron 7h) | CRON_SECRET |
| `/api/admin/migrate-photos` | GET | Migration one-shot : base64 → Storage bucket `avatars` | requireRole coach/admin |
| `/api/admin/migrate-audio` | GET | Migration one-shot : base64 → Storage bucket `chat-attachments` | requireRole coach/admin |

## Carte des fichiers
| Chemin | Rôle |
|---|---|
| `app/login/` | Connexion / inscription / mot de passe oublié |
| `app/auth/callback/` | Route handler PKCE : échange `code` → session + notif signup |
| `app/auth/confirm/` | Route handler OTP : vérifie `token_hash` |
| `app/auth/reset-password/` | Page de saisie du nouveau mot de passe |
| `app/(app)/layout.tsx` | Zone protégée : vérifie session + `NoCoachGate` + `BroadcastPopup` |
| `app/(app)/page.tsx` | Accueil : cartes nav + bannière Vue d'ensemble + badge urgence |
| `app/(app)/plan/` | Planning mois/sem/synthèse, banque, glisser-déposer, duplication, bouton 🔔 Notifier |
| `app/(app)/settings/` | Réglages : compte, notifications (NotifPrefsPanel), apparence, couleurs, Sportifs (BroadcastComposer + AthletesManager), Admin |
| `app/(app)/goals/` | Objectifs + épreuves prévu/réalisé |
| `app/(app)/profile/` | Profil : photo (**compressée à l'upload via canvas**), nom, naissance, genre, **Instagram**, **localisation** (Nominatim), sports |
| `app/(app)/followup/` | Suivi : 3 onglets Messages (chat API) / Santé (Suivi + **Métriques**) / Bloc-notes |
| `app/(app)/followup/MetricsTab.tsx` | Onglet Métriques : Données (cartes + tendance) + Tendances (graphique SVG) |
| `app/(app)/shop/` | Page Shop & Avantages : onglets Parrainage / Merch / Shop (stockés dans `library_state`, global) |
| `app/(app)/overview/` | Vue d'ensemble coach : messages urgents + blessures actives + objectifs |
| `app/(app)/library/` | Bibliothèque : 3 onglets Exercices / Séances types / Semaines types |
| `app/(app)/records/` | Records force + CAP + Hyrox + courbes SVG |
| `components/DataProvider.tsx` | Contexte global : auth, state, library, templates, hasCoach |
| `components/Header.tsx` | En-tête sticky + logo NMRY Coaching (light/dark) + bandeau ClientSelector |
| `components/ThemeProvider.tsx` | Dark/light mode + bgColor coach — `localStorage` + `data-theme` |
| `components/BroadcastPopup.tsx` | Popup Realtime pour les sportifs (broadcasts coach) |
| `components/NoCoachGate.tsx` | Bloque l'app si `hasCoach=false` (client sans coach) |
| `components/NoCoachScreen.tsx` | Écran d'attente pour les nouveaux sportifs sans coach |
| `components/NotifPrefsPanel.tsx` | Toggles notifications push (abonnement + prefs par type) |
| `components/PushSubscribeButton.tsx` | Bouton standalone abonnement push (remplacé par NotifPrefsPanel) |
| `components/ClientSelector.tsx` | Dropdown coach (portal `document.body` — évite clipping backdrop-blur) |
| `components/SessionEditor.tsx` | Édition séance : coach = tout (incl. édition des logs de séries) ; sportif = feedback + validation + ❌ raté. Labels blancs+gras (`text-ink font-semibold`), pas de placeholders. |
| `components/GoalInfoModal.tsx` | Fiche objectif lecture seule (planning) — affiche épreuves + clientName |
| `components/EventsDisplay.tsx` | Tableau épreuves prévu/réalisé (partagé goals + modal) |
| `components/ExerciseMultiSelect.tsx` | Filtres + recherche + liste d'exercices à cocher |
| `components/ExercisePicker.tsx` | Modale picker + création inline (avec tags + video) |
| `components/library/ExerciseModal.tsx` | Modal création/édition exercice + champ comment + readOnly |
| `components/library/FiltersModal.tsx` | Gestion catégories de filtres |
| `components/library/SessionTemplateModal.tsx` | Création/édition séance type |
| `components/library/WeekTemplateModal.tsx` | Création/édition semaine type (grille 7 jours) |
| `lib/types.ts` | Tous les types TypeScript + `emptyState()` + `emptyRecords()` |
| `lib/push.ts` | Utilitaire web-push : `sendPushToUser` / `sendPushToCoachClients` |
| `lib/notifPrefs.ts` | `getUserNotifPrefs(userId)` — lit prefs depuis app_state (admin client) |
| `lib/chat.ts` | Helpers chat : `insertChatMessage` / `rowToMessage` / `getCoachOf` |
| `lib/apiAuth.ts` | `requireRole([...])` — garde d'auth + rôle mutualisée pour les routes API |
| `app/api/chat/` | Routes chat : `route.ts` (GET paginé/POST), `[id]/` (PATCH/DELETE), `audio/` (GET à la demande), `unread/` |
| `lib/supabase/client.ts` | Client browser |
| `lib/supabase/server.ts` | Client serveur (Server Components, route handlers) |
| `lib/supabase/admin.ts` | Client service role — **server-side uniquement** |
| `lib/supabase/middleware.ts` | Refresh session + garde routes |
| `public/manifest.json` | Manifest PWA |
| `public/sw.js` | Service Worker : push notifications + notification click |
| `public/logo-light.png` | Logo NMRY (noir, fond transparent) — mode clair |
| `public/logo-dark.png` | Logo NMRY (blanc, fond transparent) — mode sombre |
| `public/icon-192.png` | Icône PWA 192×192 (carré, fond blanc, logo centré) |
| `public/icon-512.png` | Icône PWA 512×512 (carré, fond blanc, logo centré) |
| `vercel.json` | Cron job : `GET /api/cron/reminders` à 7h chaque jour |
| `supabase/schema.sql` | Schéma complet ré-exécutable |

## Conventions
- **Tokens couleurs Tailwind v4** : `bg-bg`, `bg-surface`, `bg-surface2`, `border-line`, `text-ink`,
  `text-dim`, `text-accent`, `bg-accent`, `text-ok`, `bg-ok`, `text-danger`, `bg-danger`,
  `bg-accent2`, `text-accent2`. Couleur violette (dupliquer) : `#a855f7` inline.
- **Thème clair/sombre** : `[data-theme="light"]` dans `globals.css`. Script anti-flash dans `app/layout.tsx`.
- **Modales** : `fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center`
  + contenu `rounded-t-3xl sm:rounded-3xl border-t border-line bg-surface p-5`.
- **Modale longue (en-tête + bas d'action fixes)** : conteneur `flex max-h-[92vh] flex-col`
  (PAS `overflow-y-auto` sur le conteneur) → en-tête `shrink-0`, zone centrale
  `min-h-0 flex-1 overflow-y-auto` (seule à défiler), pied `shrink-0 border-t pt-3`.
  Implémenté dans `ComposeModal` (`/plan`, « Nouvelle séance ») : haut fixe (titre/nom/couleur/
  biblio+filtres), milieu défilant (formulaire + bibliothèque), bas fixe (récapitulatif plafonné
  `max-h-[26vh] overflow-y-auto` + bouton « Créer la séance » toujours visible).
- **Dropdowns dans le header** : utiliser `createPortal(…, document.body)` + `position:fixed` pour
  éviter le clipping causé par `backdrop-filter: blur()` sur le header sticky.
- **Mutations d'état sportif** : `update((draft) => { ... })` — immuable via **immer** + sauvegarde
  différée **2 s** + **dédoublonnage** (pas de réécriture d'un blob identique).
- **Mutations bibliothèque** : `updateLibrary((lib) => { ... })` — coach/admin seulement.
- **Mutations templates** : `updateTemplates((t) => { ... })` — coach/admin seulement, `template_state`.
- **Sets/reps texte** : champs `type="text"` acceptant "3" ou "3-4". `setsLabel`/`repsLabel` stockent
  le texte brut, `sets`/`reps` stockent `parseInt(raw)` pour les calculs.
- **Imports** : alias `@/` = racine du projet. UI entièrement **en français**.

## VoicePlayer — notes cross-platform
- **MIME dynamique** : `mr.mimeType` utilisé pour le Blob (pas `"audio/webm"` hardcodé).
  iOS Safari produit `audio/mp4`, Chrome/Firefox produisent `audio/webm`.
- **Attributs requis iOS** : `preload="metadata"` + `playsInline` sur `<audio>`.
- **État** piloté par `onPlay`/`onPause` (pas `setPlaying` direct après `a.play()`).
- **Vitesse** : boutons 0.5× / 1× / 1.5× / 2× → `audioRef.current.playbackRate`.
- **Seek** : clic sur la barre de progression → `a.currentTime = ratio * duration`.

## Infra
- GitHub : `github.com/antoinenmry/nmry-coaching` — SSH (`~/.ssh/github_tridash`), remote
  `git@github.com:antoinenmry/nmry-coaching.git`. Pas de token, pas de `gh`. Pas de CLI Vercel.
- Vercel : team `antoinenmry-s-projects`. `git push origin main` → deploy auto.
- Commits : message en français, signés `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

## Roadmap / prochaines étapes connues
- [ ] Intégration semaines types dans `/plan` (bouton "Appliquer une semaine type" → modal client)
- [ ] Tests Supabase bout en bout (schema.sql + RLS + multi-sportif)
- [ ] Migration : `sessions` et `records` en tables Supabase dédiées plutôt que blob JSON
- [ ] Rate limiting sur les routes d'envoi (broadcasts, notifications) — issue sécurité moyenne
- [x] Limite/compression taille photos (compressées à l'upload).
- [x] Vocaux base64 → Storage (`chat-attachments`, migration faite). Nouveaux enregistrements uploadés directement, `audio_path` en base.
- [x] Photos base64 legacy → Storage (`avatars`, migration faite).
- [ ] Migrer `sessions`/`profile` hors du blob `app_state` (tables/colonnes dédiées) — supprime la cause racine des contaminations de blob
