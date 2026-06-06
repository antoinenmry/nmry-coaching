# NMRY Coaching — contexte projet

App de coaching **musculation** (mobile-first, responsive PC) : interface **coach/sportif** pour
profil & diète, plan d'entraînement, objectifs/compétitions, records, suivi et bibliothèque d'exercices.
UI **en français**.

## Stack
- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** (config via `@theme` dans `app/globals.css`, pas de `tailwind.config`)
- **Supabase** (auth email + Postgres + RLS + Realtime) via `@supabase/ssr` — **actuellement ACTIVÉ**
- **nodemailer** + Gmail SMTP — emails d'alerte urgence coach (pas de custom domain requis)
- **web-push** — notifications push PWA (VAPID)
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
- **RLS** : `state_self_all` (sportif → ses données), `state_coach_all` (coach → tout le monde),
  `library_read_all` (tous → lecture), `library_coach_write` (coach → écriture).
- **`template_state`** : RLS `template_coach_all` — `is_coach()` uniquement (bloque les clients).
- **`broadcasts`** : RLS `broadcast_coach` (coach → ses broadcasts), `broadcast_client_read` (client → broadcasts de son coach).
- **`push_subscriptions`** : RLS `push_own` (utilisateur → ses propres subscriptions).
- **`coach_client`** : RLS `cc_read` (coach_id = auth.uid() ou is_admin()). ⚠️ Le client ne peut PAS lire cette table directement → utiliser `/api/me/has-coach` (admin client bypass).
- **Trigger `prevent_role_escalation`** : empêche un sportif de se passer coach via l'API.
- **Guard applicatif** : `update()` dans DataProvider refuse si `role=client` et `activeUserId ≠ me.id`.
- **`updateLibrary()`** : `PUT /api/library` restreint aux coaches/admins (RLS + route guard).
- **`updateTemplates()`** refuse si rôle n'est pas coach/admin.
- **Open redirect** : le paramètre `?next=` des callbacks est validé (chemin relatif uniquement).
- **Routes API coach** : vérifient session + rôle + appartenance (un coach ne peut modifier que ses propres clients).
- **`clientId` dans body** : vérifié contre `user.id` dans toutes les routes (anti-usurpation).
- **`CRON_SECRET`** : si absent → 503 (jamais `Bearer undefined` accepté).
- **`/api/coach/self-assign`** : bloque si client déjà affecté à un autre coach (409 Conflict).

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
  `name`, `photo` (base64), `birthDate`, `gender`, `height`, `weight`, `sports[]`, `diet`.
  ⚠️ `diet` est affiché/édité dans `/followup` (pas `/profile`).

- `sessions: SessionInstance[]` — **liste à plat** :
  - `date = null` → banque « À placer » ; `date = "YYYY-MM-DD"` → placée.
  - `ExerciseInstance` : `uid`, `exId`, `name`, `sets`, `reps`, `weight`, `rpeCoach`, `rpeClient`,
    `coachComment`, `clientComment`, `failed?`, `setsLabel?`, `repsLabel?`.
    `weight/rpeCoach = 0` → non renseigné. `setsLabel`/`repsLabel` = surcharge texte (ex: "3-4").
    `failed = true` → exercice raté par le sportif (affiché à la place du RPE).

- `goals: Goal[]` : `competition`, `date`, `place`, `expected` (commentaires libres),
  `events?: GoalEvent[]` (épreuves structurées `{ id, name, planned, achieved }`),
  `clientName?` (enrichi côté coach, non persisté).

- `followups: Followup[]` : `date` (début), `dateEnd?` (fin, blessures uniquement),
  `type` (`"note"|"injury"|"pain"`), `text`.
  Les blessures actives apparaissent dans le calendrier (`/plan`) et la vue d'ensemble (`/overview`).
  Déclarer une blessure (`type="injury"`) → push au coach si `notifPrefs.newInjury`.

- `messages: ChatMessage[]` : chat coach ↔ sportif stocké côté sportif.
  `isUrgent` → bandeau rouge + email Gmail + push au coach. `isVoice` → message vocal (base64 audio).
  `audioUrl` = data URL avec MIME natif du navigateur (mp4 iOS, webm Chrome).
  `editedAt?` → timestamp si modifié après envoi. Modifier/supprimer : auteur seulement, à tout moment.

- `notes: BlockNote[]` : bloc-notes partagé sportif ↔ coach.
  `{ id, text, createdAt, updatedAt?, authorId, authorName, authorRole }`.
  Les deux peuvent ajouter des notes. Modifier/supprimer : auteur seulement.

- `records: RecordsData` : force (max 3 par exercice), CAP, Hyrox.
- `preferences: UserPreferences` : `cardColors` (href→hex), `cardColorMode` (`"arc"|"full"`), `notifPrefs?: NotifPrefs`.
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

### Templates (coach/admin uniquement)
Stockés dans `template_state` (singleton Supabase, RLS `is_coach()`).
Chargés dans `DataProvider` → `templates: TemplateLibrary`.
Mutés via `updateTemplates((t) => { ... })` — debounce 500ms → `PUT /api/templates`.

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

### ⚠️ SQL à exécuter dans Supabase si pas encore fait
```sql
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

## PWA & Push notifications
- `public/manifest.json` + `public/sw.js` → site installable (PWA)
- `public/icon-192.png` + `public/icon-512.png` → icônes carrées générées avec Pillow (logo centré + padding)
- `public/logo-light.png` / `public/logo-dark.png` → logo header (adapté au thème)
- Service Worker : gère `push` event → `showNotification`, clic → ouvre l'app sur la bonne page
- **iOS** : notifications push uniquement si installé en PWA (Safari → Partager → Sur l'écran d'accueil)
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

## Cron Vercel
`vercel.json` : `GET /api/cron/reminders` tous les jours à 7h (`0 7 * * *`).
Sécurisé par `Authorization: Bearer <CRON_SECRET>`. Si `CRON_SECRET` absent → 503.
Pour chaque sportif client : rappel séance du jour + rappels J-7/J-1 objectifs (selon `notifPrefs`).

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
| `/api/messages/urgent` | POST | Email + push urgent au coach | auth + clientId===user.id |
| `/api/messages/notify` | POST | Push nouveau message | auth + vérif lien coach_client |
| `/api/followup/notify-injury` | POST | Push blessure → coach | auth + clientId===user.id |
| `/api/plan/notify` | POST | Push nouveau programme → sportifs | requireCoach |
| `/api/broadcasts` | POST | Créer broadcast + push | requireCoach |
| `/api/broadcasts` | GET | Broadcasts actifs pour le client | auth |
| `/api/push/subscribe` | POST/DELETE | Gérer souscription push | auth |
| `/api/auth/on-signup` | POST | Push nouvelle inscription → coaches/admins | auth |
| `/api/me/has-coach` | GET | Vérifie si client a un coach (bypass RLS) | auth |
| `/api/cron/reminders` | GET | Rappels séance + objectifs (cron 7h) | CRON_SECRET |

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
| `app/(app)/profile/` | Profil : photo, nom, date naissance, genre, taille, poids, sports |
| `app/(app)/followup/` | Suivi : messages chat, bloc-notes, blessures, notes |
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
| `components/SessionEditor.tsx` | Édition séance : coach = tout ; sportif = feedback + validation + ❌ raté |
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
- **Dropdowns dans le header** : utiliser `createPortal(…, document.body)` + `position:fixed` pour
  éviter le clipping causé par `backdrop-filter: blur()` sur le header sticky.
- **Mutations d'état sportif** : `update((draft) => { ... })` — immuable + sauvegarde différée 500 ms.
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
- [ ] Limite taille `app_state` (photos/audio base64 sans validation de taille)
