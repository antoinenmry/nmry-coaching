# NMRY Coaching — contexte projet

App de coaching **musculation** (mobile-first, responsive PC) : interface **coach/sportif** pour
profil & diète, plan d'entraînement, objectifs/compétitions, records, suivi et bibliothèque d'exercices.
UI **en français**.

## Stack
- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** (config via `@theme` dans `app/globals.css`, pas de `tailwind.config`)
- **Supabase** (auth email + Postgres + RLS) via `@supabase/ssr` — **actuellement ACTIVÉ**
- **Resend** (`resend` npm) — emails d'alerte urgence coach
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
- **Instancier les clients tiers (Resend…) dans le handler**, jamais au module-level
  (`const x = new Client(process.env.KEY)` en dehors d'une fonction) → crash build Vercel
  si la variable d'env est absente au moment du bundling.

## Variables d'environnement
| Variable | Scope | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Clé anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Serveur uniquement** | Clé service role — accès admin (routes API coach) |
| `RESEND_API_KEY` | **Serveur uniquement** | Clé API Resend — emails d'alerte urgence |
| `RESEND_FROM_EMAIL` | **Serveur uniquement** | Expéditeur email ex: `NMRY Coaching <noreply@domaine.com>` |

`SUPABASE_SERVICE_ROLE_KEY` et `RESEND_API_KEY` ne doivent **jamais** être exposées côté client.

## Authentification & modes d'accès
`lib/config.ts` → `AUTH_ENABLED = true` (activé). **Le mode invité a été supprimé.**

### 2 modes
| Mode | Déclenchement | Données |
|---|---|---|
| **Auth (compte)** | Login email/mdp | Supabase (`app_state`) |
| **Local forcé** | `AUTH_ENABLED = false` | localStorage — bypass total du login |

- Pour basculer en **mode local forcé** : `AUTH_ENABLED = false` dans `lib/config.ts`.

### Auth flow complet (AUTH_ENABLED = true)
1. **Inscription** : nom + email + mdp → `supabase.auth.signUp` → écran "Confirme ton email 📬"
2. **Confirmation email** : lien → `/auth/callback?code=…` → échange PKCE → session → redirect `/`.
3. **Connexion** : email + mdp → `signInWithPassword` → `/`
4. **Reset mdp** : email → `/auth/callback?next=/auth/reset-password` → `updateUser({ password })` → `/`
5. **Déconnexion** : `supabase.auth.signOut()` → `/login` (bouton dans `/settings`)

### ⚠️ Configuration Vercel/Supabase requise
- **Vercel** : `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
  + `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (optionnel)
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
**Fix permanent — SMTP Resend** : Supabase → Authentication → Emails → SMTP Settings → activer Custom SMTP
- Host : `smtp.resend.com` · Port : `465` · User : `resend` · Password : clé API Resend

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
- **Trigger `prevent_role_escalation`** : empêche un sportif de se passer coach via l'API.
- **Guard applicatif** : `update()` dans DataProvider refuse si `role=client` et `activeUserId ≠ me.id`.
- **`updateLibrary()`** refuse si `role !== 'coach'` en mode auth.
- **`updateTemplates()`** refuse si rôle n'est pas coach/admin.
- **Open redirect** : le paramètre `?next=` des callbacks est validé (chemin relatif uniquement).
- **Routes API `/api/coach/*`** : vérifient session + rôle coach avant toute opération ; utilisent
  le client admin (service role) uniquement côté serveur.
- **Route `/api/messages/urgent`** : vérifie session Supabase avant envoi email.

## Rôles coach / sportif
Exposés par `useData()` : `role`, `me`, `clients`, `activeUserId`, `switchClient`, `library`,
`updateLibrary`, `templates`, `updateTemplates`.

- **Coach / Admin** : crée et édite les séances, gère la bibliothèque partagée, gère les templates
  (séances types + semaines types), peut dupliquer des semaines.
  Voit un `ClientSelector` dans le header (dropdown via portal, évite le clipping backdrop-blur).
  Le sportif sélectionné est persisté dans `localStorage` (`nmry-coach-selected-client`).
  Voit les objectifs de **tous** les sportifs sur son calendrier (chargés en parallèle).
  Accès à `/overview` (blessures actives + objectifs agrégés) et à la Vue Gestion des Profils.
  Reçoit un **email d'alerte** quand un sportif envoie un message urgent.
- **Sportif** : place les séances, renseigne ressenti (emoji 1-5), RPE, commentaire, valide une séance.
  La prescription est en lecture seule. La bibliothèque est en lecture seule (pas les templates).

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

- `messages: ChatMessage[]` : chat coach ↔ sportif stocké côté sportif.
  `isUrgent` → bandeau rouge + email auto au coach. `isVoice` → message vocal (base64 audio).
  `audioUrl` = data URL avec MIME natif du navigateur (mp4 iOS, webm Chrome).

- `records: RecordsData` : force (max 3 par exercice), CAP, Hyrox.
- `preferences: UserPreferences` : `cardColors` (href→hex), `cardColorMode` (`"arc"|"full"`).
- `library` : **ignoré en mode auth** — la bibliothèque vient de `library_state` (table dédiée, singleton).

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

### ⚠️ SQL à exécuter dans Supabase (table template_state — PAS encore créée)
```sql
CREATE TABLE IF NOT EXISTS public.template_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL DEFAULT '{"sessionTemplates":[],"weekTemplates":[]}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.template_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS template_coach_all ON public.template_state;
CREATE POLICY template_coach_all ON public.template_state
  FOR ALL USING (public.is_coach()) WITH CHECK (public.is_coach());
```

### Schéma Supabase étendu
| Table | Colonne | Rôle |
|---|---|---|
| `profiles` | `status` (`active`/`inactive`, défaut `active`) | Statut sportif, modifiable par le coach |
| `app_state` | `updated_by_coach_at` TIMESTAMPTZ | Dernière sauvegarde par le coach |
| `app_state` | `updated_by_client_at` TIMESTAMPTZ | Dernière sauvegarde par le sportif |
| `auth.users` | `last_sign_in_at` | Dernière connexion — lu via service role uniquement |
| `template_state` | `data` JSONB | Templates séances/semaines types — RLS coach uniquement |

`DataProvider.pushNow()` écrit `updated_by_coach_at` ou `updated_by_client_at` selon le rôle connecté.

### Bibliothèque partagée (`library_state`)
Table Supabase singleton (id=1), lisible par tous, éditable coach/admin.
`tags: Record<string, string[]>` — multi-sélection (OR dans une catégorie, AND entre catégories).
`comment?: string` — description libre de l'exercice.
Page `/library` : 3 onglets — Exercices (tous) | Séances types (coach/admin) | Semaines types (coach/admin).

## Routes API (server-side, service role)
| Route | Méthode | Rôle |
|---|---|---|
| `/api/coach/athletes` | GET | Profils + timestamps + `last_sign_in_at` de tous les sportifs |
| `/api/coach/athletes/[id]` | PATCH | Mise à jour `status` (`active`/`inactive`) |
| `/api/coach/athletes/[id]` | DELETE | Suppression compte auth + cascade profiles/app_state |
| `/api/library` | PUT | Sauvegarde bibliothèque partagée (tous rôles authentifiés) |
| `/api/templates` | GET | Lecture templates coach/admin — `requireCoach()` |
| `/api/templates` | PUT | Sauvegarde templates coach/admin — `requireCoach()` |
| `/api/messages/urgent` | POST | Email d'alerte au coach via Resend (lookup `coach_client`) |

Toutes les routes vérifient `requireCoach()` (session + rôle) sauf `/api/library` et `/api/messages/urgent`
(qui vérifient juste la session). Le client admin (`lib/supabase/admin.ts`) n'est instancié que côté serveur.

## Carte des fichiers
| Chemin | Rôle |
|---|---|
| `app/login/` | Connexion / inscription / mot de passe oublié |
| `app/auth/callback/` | Route handler PKCE : échange `code` → session |
| `app/auth/confirm/` | Route handler OTP : vérifie `token_hash` |
| `app/auth/reset-password/` | Page de saisie du nouveau mot de passe |
| `app/api/coach/athletes/` | GET liste sportifs enrichie (service role) |
| `app/api/coach/athletes/[id]/` | PATCH statut · DELETE compte |
| `app/api/library/` | PUT bibliothèque partagée |
| `app/api/templates/` | GET · PUT templates coach/admin |
| `app/api/messages/urgent/` | POST email alerte urgence via Resend |
| `app/(app)/layout.tsx` | Zone protégée : vérifie session Supabase |
| `app/(app)/page.tsx` | Accueil : cartes nav + bannière Vue d'ensemble (coach) + badge urgence |
| `app/(app)/plan/` | Planning mois/sem/synthèse, banque, glisser-déposer, duplication semaine |
| `app/(app)/settings/` | Réglages : compte, apparence, couleurs, Vue Gestion des Profils (coach) |
| `app/(app)/goals/` | Objectifs + épreuves prévu/réalisé |
| `app/(app)/profile/` | Profil : photo, nom, date naissance, genre, taille, poids, sports |
| `app/(app)/followup/` | Suivi : messages chat, diète, blessures, notes |
| `app/(app)/overview/` | Vue d'ensemble coach : messages urgents + blessures actives + objectifs |
| `app/(app)/library/` | Bibliothèque : 3 onglets Exercices / Séances types / Semaines types |
| `app/(app)/records/` | Records force + CAP + Hyrox + courbes SVG |
| `components/DataProvider.tsx` | Contexte global : auth, state, library, templates, timestamps |
| `components/ClientSelector.tsx` | Dropdown coach (portal `document.body` — évite clipping header) |
| `components/Header.tsx` | En-tête sticky + bandeau ClientSelector / ⚙ |
| `components/ThemeProvider.tsx` | Dark/light mode + bgColor coach — `localStorage` + `data-theme` |
| `components/SessionEditor.tsx` | Édition séance : coach = tout ; sportif = feedback + validation + ❌ raté |
| `components/GoalInfoModal.tsx` | Fiche objectif lecture seule (planning) — affiche épreuves + clientName |
| `components/EventsDisplay.tsx` | Tableau épreuves prévu/réalisé (partagé goals + modal) |
| `components/ExerciseMultiSelect.tsx` | Filtres + recherche + liste d'exercices à cocher |
| `components/ExercisePicker.tsx` | Modale picker + création inline (avec tags + video) |
| `components/library/ExerciseModal.tsx` | Modal création/édition exercice + champ comment + readOnly |
| `components/library/FiltersModal.tsx` | Gestion catégories de filtres |
| `components/library/SessionTemplateModal.tsx` | Création/édition séance type (exercices + prescription) |
| `components/library/WeekTemplateModal.tsx` | Création/édition semaine type (grille 7 jours) |
| `lib/types.ts` | Tous les types TypeScript + `emptyState()` + `emptyRecords()` |
| `lib/supabase/client.ts` | Client browser (composants client) |
| `lib/supabase/server.ts` | Client serveur (Server Components, route handlers) |
| `lib/supabase/admin.ts` | Client service role — **server-side uniquement** |
| `lib/supabase/middleware.ts` | Refresh session + garde routes + intercepte erreurs OTP |
| `supabase/schema.sql` | Schéma complet ré-exécutable : tables, RLS, triggers, migrations |

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
- **Mutations bibliothèque** : `updateLibrary((lib) => { ... })` — sauvegarde dans `library_state`.
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
- [ ] **Supabase SQL** : créer `template_state` (voir SQL ci-dessus — ⚠️ pas encore fait)
- [ ] **Vercel env vars** : ajouter `RESEND_API_KEY` + `RESEND_FROM_EMAIL` pour activer les emails urgence
- [ ] **PWA** : ajouter `manifest.json` + icônes + service worker → installation écran d'accueil + push Android
- [ ] **Capacitor** (optionnel) : wrapper l'app web → vraie app App Store / Google Play
- [ ] Intégration semaines types dans `/plan` (bouton "Appliquer une semaine type" → modal client)
- [ ] Configurer SMTP Resend pour lever la limite 2 emails/h Supabase (voir section Auth ci-dessus)
- [ ] Tests Supabase bout en bout (schema.sql + RLS + multi-sportif)
- [ ] Migration : `sessions` et `records` en tables Supabase dédiées plutôt que blob JSON
