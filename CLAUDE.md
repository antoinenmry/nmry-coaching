# NMRY Coaching — contexte projet

App de coaching **musculation** (mobile-first, responsive PC) : interface **coach/client** pour
profil & diète, plan d'entraînement, objectifs/compétitions, records, suivi, et bibliothèque d'exercices.
UI **en français**.

## Stack
- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** (config via `@theme` dans `app/globals.css`, pas de `tailwind.config`)
- **Supabase** (auth email + Postgres + RLS) via `@supabase/ssr` — **actuellement ACTIVÉ**
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

## Authentification & modes d'accès
`lib/config.ts` → `AUTH_ENABLED = true` (activé).

### 3 modes
| Mode | Déclenchement | Données |
|---|---|---|
| **Auth (compte)** | Login email/mdp | Supabase (`app_state`) |
| **Invité** | Bouton « Continuer en invité » sur `/login` | localStorage (`nmry-local-state`) |
| **Local forcé** | `AUTH_ENABLED = false` | localStorage — bypass total du login |

- Le mode **invité** est marqué par un cookie `nmry-guest=1` (`lib/guest.ts`).
  Le middleware et le layout (`app/(app)/layout.tsx`) vérifient ce cookie pour autoriser l'accès
  sans session Supabase.
- En mode **invité**, le toggle Coach ⇄ Client est disponible (accueil + planning).
  Le rôle est persisté dans `localStorage` (`nmry-local-role`).
- Pour basculer en **mode local forcé** : `AUTH_ENABLED = false` dans `lib/config.ts`.

### Auth flow complet (AUTH_ENABLED = true)
1. **Inscription** : nom + email + mdp → `supabase.auth.signUp` → écran "Confirme ton email 📬"
2. **Confirmation email** : lien → `/auth/callback?code=…` → échange PKCE → session → redirect `/`.
3. **Connexion** : email + mdp → `signInWithPassword` → `/`
4. **Reset mdp** : email → `/auth/callback?next=/auth/reset-password` → `updateUser({ password })` → `/`
5. **Déconnexion** : `supabase.auth.signOut()` → `/login`

### ⚠️ Configuration Vercel/Supabase requise
- **Vercel** : `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les env vars.
- **Supabase → Auth → URL Configuration** :
  - Site URL : `https://nmry-coaching.vercel.app`
  - Redirect URLs : `https://nmry-coaching.vercel.app/auth/callback` + `http://localhost:3000/auth/callback`
- Après changement d'env vars Vercel : **redéployer manuellement**.

### ⚠️ Piège middleware — `MIDDLEWARE_INVOCATION_FAILED`
Le middleware vérifie la présence des variables avant de créer le client Supabase ; sinon, dégrade
proprement. Les routes `/auth/*` sont exclues de la protection.

### État Supabase
- Projet ref : `zhvfqcxdifribggyzxgk`
- Schéma : `supabase/schema.sql` (tables `profiles` + `app_state`, RLS, trigger inscription)
- Pour devenir coach : `update public.profiles set role = 'coach' where email = 'TON_EMAIL_ICI';`

## Rôles coach / client
Exposés par `useData()` : `role`, `setRole`, `isGuest`.

- **Coach** : crée et édite les séances (séries/reps/poids/RPE/commentaires), gère la bibliothèque.
  Peut créer des exercices inline. Voit un sélecteur de client sur l'accueil.
  Dans le SessionEditor, boutons bas de page : **Valider** (ferme) + **Supprimer** (supprime la séance).
- **Client** : place les séances, renseigne ressenti (emoji 1-5), RPE client, commentaire, et peut
  **valider une séance** (bouton dédié). La prescription est en lecture seule.
- **Invité** : toggle Coach ⇄ Client visible sur l'accueil et dans le planning.

## Modèle de données (`lib/types.ts` → `AppState`)
Document unique par client (JSON local ou `app_state.data` Supabase) :

- `profile: UserProfileData` :
  - `name`, `photo` (base64), `birthDate` (YYYY-MM-DD), `gender` (homme/femme/""),
    `height` (cm), `weight` (kg), `sports: string[]`, `diet`.
  - La photo s'affiche dans la barre utilisateur de l'accueil.

- `sessions: SessionInstance[]` — **liste à plat** :
  - `date = null` → dans la banque « À placer ».
  - `date = "YYYY-MM-DD"` → placée ce jour par le client.
  - Champs : `id`, `name`, `color`, `emoji` (0-5), `done` (booléen — validée par client),
    `coachComment`, `tplId`, `exercises: ExerciseInstance[]`.
  - `ExerciseInstance` : `uid`, `exId`, `name` (figé à l'ajout), `sets`, `reps`, `weight`,
    `rpeCoach`, `rpeClient` (0 = non renseigné), `coachComment`, `clientComment`.
  - **`weight = 0`** → pas de charge prescrite. **`rpeCoach = 0`** → RPE non renseigné.
  - Sur le calendrier : ✅ si séance validée (+ RPE moyen + emoji en vue semaine), ❌ si date
    passée et non validée.

- `goals: Goal[]` : `competition`, `date`, `place`, `expected`.
- `followups: Followup[]` : `date`, `type` (`"note"|"injury"`), `text`.
- `library: ExerciseLibrary` :
  - `categories: FilterCategory[]` : catégories de filtres personnalisables.
  - `exercises: LibraryExercise[]` : `id`, `name`, `tags` (map catId→optId), `video`.
  - **La prescription vit dans le plan, PAS dans la bibliothèque.**
  - Filtres : **multi-sélection** par catégorie (OR dans une catégorie, AND entre catégories).

- `records: RecordsData` :
  - `strength: ExerciseRecords[]` : records de force par exercice (max 3 par exercice).
    Chaque entrée : `date`, `weight` (kg), `reps`. Toggle affiché/masqué par exercice.
  - `cap: Record<CapDistance, CardioRecord[]>` : records course (1km/5km/10km/21km/42km), max 3.
  - `hyrox: Record<HyroxCategory, CardioRecord[]>` : records Hyrox (pro/open), max 3.
  - Onglet **Tendances** : courbe SVG par discipline, meilleur record mis en vert.

## Carte des fichiers
| Chemin | Rôle |
|---|---|
| `app/login/` | Connexion / inscription / "Continuer en invité" / mot de passe oublié |
| `app/auth/callback/` | Route handler PKCE : échange `code` → session |
| `app/auth/confirm/` | Route handler OTP : vérifie `token_hash` |
| `app/auth/reset-password/` | Page de saisie du nouveau mot de passe |
| `app/(app)/layout.tsx` | Zone protégée : vérifie session Supabase OU cookie invité |
| `app/(app)/page.tsx` | Accueil : 6 cartes (Profil, Programmation, Objectifs, Records, Suivi, Biblio) + avatar photo |
| `app/(app)/plan/` | Planning mois/sem, banque « À placer », compose séance, glisser-déposer, badges ✅/❌ |
| `app/(app)/goals/` | Objectifs (tri par date, décompte J-X, édition) |
| `app/(app)/profile/` | Profil : photo, nom, date naissance, genre, taille, poids, sports, diète |
| `app/(app)/followup/` | Suivi (notes/blessures) |
| `app/(app)/library/` | Bibliothèque d'exercices + filtres multi-sélection |
| `app/(app)/records/` | Records force (muscu) + CAP + Hyrox + courbes de tendance SVG |
| `components/DataProvider.tsx` | Contexte : 3 modes (auth/invité/local), chargement, sauvegarde, `me`, `role`, `isGuest` |
| `components/SessionEditor.tsx` | Édition séance : coach = tout éditer + commentaires ; client = feedback + validation |
| `components/ExerciseMultiSelect.tsx` | Filtres multi-sélection + liste d'exercices à cocher (réutilisable) |
| `components/ExercisePicker.tsx` | Modale picker + création inline d'exercices |
| `components/GoalInfoModal.tsx` | Fiche objectif en lecture seule (depuis le plan) |
| `components/Header.tsx` | En-tête (titre par route, bouton retour, indicateur sauvegarde) |
| `lib/types.ts` | Tous les types TypeScript + `emptyState()` + `emptyRecords()` + bibliothèque par défaut |
| `lib/data.ts` | Fabriques : `newSession`, `exerciseInstanceFromLibrary`, `instanceFromTemplate`, `SESSION_COLORS` |
| `lib/dates.ts` | `daysUntil`, `countdownLabel`, `frenchDate` |
| `lib/config.ts` | `AUTH_ENABLED` |
| `lib/guest.ts` | `GUEST_COOKIE`, `isGuestClient()`, `setGuest()` |
| `lib/supabase/client.ts` | Client Supabase navigateur (repli placeholder si env vars absentes) |
| `lib/supabase/server.ts` | Client Supabase serveur |
| `lib/supabase/middleware.ts` | Refresh session + garde routes (dégrade proprement si vars absentes) |
| `middleware.ts` | Entry-point Next.js pour le middleware Supabase |
| `supabase/schema.sql` | Schéma + RLS + trigger d'inscription automatique |

## Conventions
- **Tokens couleurs Tailwind v4** : `bg-bg`, `bg-surface`, `bg-surface2`, `border-line`, `text-ink`,
  `text-dim`, `text-accent`, `bg-accent`, `text-ok`, `bg-ok`, `text-danger`, `bg-danger`,
  `bg-accent2`, `text-accent2`.
- **Modales** : `fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center`
  + contenu `rounded-t-3xl sm:rounded-3xl border-t border-line bg-surface p-5`.
- **Mutations d'état** : toujours via `update((draft) => { ... })` de `useData()` — immuable
  (`structuredClone`) + sauvegarde différée 500 ms.
- **Imports** : alias `@/` = racine du projet.
- UI entièrement **en français**.

## Infra
- GitHub : `github.com/antoinenmry/nmry-coaching` — SSH (`~/.ssh/github_tridash`), remote
  `git@github.com:antoinenmry/nmry-coaching.git`. Pas de token, pas de `gh`. Pas de CLI Vercel.
- Vercel : team `antoinenmry-s-projects`. `git push origin main` → deploy auto.
- Commits : message en français, signés `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

## Roadmap / prochaines étapes connues
- [ ] Tests Supabase bout en bout (schema.sql + RLS + multi-client)
- [ ] Migration : `library`, `sessions` et `records` en tables Supabase dédiées (scope coach) plutôt que blob
