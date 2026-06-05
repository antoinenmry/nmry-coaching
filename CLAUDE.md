# NMRY Coaching — contexte projet

App de coaching **musculation** (mobile-first, responsive PC) : interface **coach/client** pour
profil & diète, plan d'entraînement, objectifs/compétitions, suivi, et bibliothèque d'exercices.
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
  se corrompent (erreurs `__webpack_modules__ is not a function`, `Cannot find module './xxx.js'`,
  "Chargement…" bloqué). Pour valider un build : **arrêter le serveur de preview d'abord**, builder,
  relancer. Pour un simple check TS pendant le dev : `npx tsc --noEmit`.
- Si le cache `.next` est corrompu : `rm -rf .next` puis relancer le dev.
- **Outil de preview** : la navigation programmatique (`location.href`) est instable et revient sur `/`.
  Préférer **cliquer les liens** (`a[href=...]`). Après clic, laisser ~4-8 s (compile + hydratation)
  avant d'inspecter. Vérifs synchrones après `click()` = faux négatifs.
- **Tests sans `.env.local`** : pour simuler Vercel sans variables, faire `mv .env.local .env.local.bak`,
  supprimer `.next`, rebuilder, et **se souvenir de le restaurer** (`mv .env.local.bak .env.local`).
  `npm run dev` et `next start` rechargent `.env.local` automatiquement, mais le comportement Edge
  (middleware) ne se reproduit qu'avec un vrai build prod sans le fichier.

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
  sans session Supabase. Déconnexion invité = supprimer le cookie + retour `/login`.
- En mode **invité**, le toggle Coach ⇄ Client est disponible (sur l'accueil et dans le planning).
  Le rôle est persisté dans `localStorage` (`nmry-local-role`).
- Pour basculer en **mode local forcé** (dev sans Supabase) : `AUTH_ENABLED = false` dans
  `lib/config.ts`. Le DataProvider ne touche plus du tout à Supabase.

### Auth flow complet (AUTH_ENABLED = true)
1. **Inscription** : nom + email + mdp → `supabase.auth.signUp` avec `emailRedirectTo: /auth/callback`
   → écran "Confirme ton email 📬" (pas de connexion immédiate si confirmation active)
2. **Confirmation email** : clic sur le lien → `/auth/callback?code=…` → échange PKCE → session →
   redirect `/`. Variante OTP : `/auth/confirm?token_hash=…&type=signup`.
3. **Connexion** : email + mdp → `signInWithPassword` → `/`
4. **Mot de passe oublié** : email → `resetPasswordForEmail` avec `redirectTo: /auth/callback?next=/auth/reset-password`
   → `/auth/reset-password` → `updateUser({ password })` → `/`
5. **Déconnexion** : `supabase.auth.signOut()` → `/login`

### ⚠️ Configuration Vercel/Supabase nécessaire pour que l'auth fonctionne
- **Vercel → Settings → Environment Variables** : `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (valeurs dans `.env.local` local, jamais commité). Sans elles → app accessible en mode dégradé
  (login + invité) mais **aucune session Supabase possible**.
- **Supabase → Auth → URL Configuration** :
  - Site URL : `https://nmry-coaching.vercel.app`
  - Redirect URLs : `https://nmry-coaching.vercel.app/auth/callback` + `http://localhost:3000/auth/callback`
- Après un changement d'env vars Vercel : **redéployer manuellement** (Deployments → Redeploy).

### ⚠️ Piège middleware — `MIDDLEWARE_INVOCATION_FAILED`
`lib/supabase/client.ts` a des placeholders de repli → ne plante jamais sans variables.
`lib/supabase/middleware.ts` construisait `createServerClient(undefined, undefined)` → **lève une
exception à la construction** → 500 sur toutes les routes. Corrigé : le middleware vérifie la
présence des variables avant de créer le client ; sinon, dégrade proprement en mode déconnecté.
Les routes `/auth/*` sont **exclues de la protection** (la session n'existe pas encore lors du
callback email — y appliquer la garde cassait la confirmation).

### État Supabase
- Projet ref : `zhvfqcxdifribggyzxgk`
- URL : `https://zhvfqcxdifribggyzxgk.supabase.co`
- Schéma : `supabase/schema.sql` (tables `profiles` + `app_state`, RLS, trigger inscription)
- Pour devenir coach : `update public.profiles set role = 'coach' where email = 'TON_EMAIL_ICI';`
- **SQL Editor** : exécuter `supabase/schema.sql` si les tables n'existent pas encore.

## Rôles coach / client
Exposés par `useData()` : `role`, `setRole`, `isGuest`.

- **Coach** (compte Supabase avec `profiles.role = 'coach'`) : crée et édite les séances (séries/reps/poids/RPE), gère la bibliothèque. Voit un sélecteur de client sur l'accueil. Peut créer des exercices inline lors de la composition d'une séance (case "Ajouter à la bibliothèque" cochée par défaut).
- **Client** (compte Supabase avec `profiles.role = 'client'`) : glisse-dépose les séances, renseigne ressenti (emoji 1-5), RPE client et commentaire. Prescription en lecture seule.
- **Invité** : toggle Coach ⇄ Client visible sur l'accueil et dans le planning. Rôle persisté dans `localStorage`.
- En mode local forcé : même toggle, rôle persisté dans `localStorage`.

## Modèle de données (`lib/types.ts` → `AppState`)
Document unique par client (JSON local ou `app_state.data` Supabase) :

- `profile` : nom, âge, taille, poids, poids objectif, diète.
- `sessions: SessionInstance[]` — **liste à plat** (pas de dictionnaire par date) :
  - `date = null` → dans la banque « À placer » (créée par le coach, pas encore positionnée).
  - `date = "YYYY-MM-DD"` → placée ce jour par le client.
  - Champs : `id`, `name`, `color`, `emoji` (0-5), `tplId`, `exercises: ExerciseInstance[]`.
  - `ExerciseInstance` : `uid`, `exId`, `name` (figé à l'ajout), `sets`, `reps`, `weight`,
    `rpeCoach`, `rpeClient` (0 = non renseigné), `clientComment`.
  - **`weight = 0`** → pas de charge prescrite (masqué côté client). **`rpeCoach = 0`** → RPE non
    renseigné (affiché "—" côté coach, masqué côté client). Valeurs par défaut à la création : 0/0.
- `goals: Goal[]` : `competition`, `date`, `place`, `expected`.
- `followups: Followup[]` : `date`, `type` (`"note"|"injury"`), `text`.
- `library: ExerciseLibrary` :
  - `categories: FilterCategory[]` : catégories de filtres (ex. Zone, Groupe musculaire, Équipement).
  - `exercises: LibraryExercise[]` : `id`, `name`, `tags` (map catId→optId), `video`.
  - **La prescription (séries/reps/RPE/poids) vit dans le plan, PAS dans la bibliothèque.**

## Carte des fichiers
| Chemin | Rôle |
|---|---|
| `app/login/` | Connexion / inscription / "Continuer en invité" / mot de passe oublié |
| `app/auth/callback/` | Route handler PKCE : échange `code` → session (confirmation email, reset mdp) |
| `app/auth/confirm/` | Route handler OTP : vérifie `token_hash` (variante flow Supabase) |
| `app/auth/reset-password/` | Page de saisie du nouveau mot de passe (après clic lien reset) |
| `app/(app)/layout.tsx` | Zone protégée : vérifie session Supabase OU cookie invité |
| `app/(app)/page.tsx` | Accueil : cartes + badge nom/rôle (toggle coach⇄client pour invités) |
| `app/(app)/plan/` | Planning mois/sem, banque « À placer », compose séance, glisser-déposer |
| `app/(app)/goals/` | Objectifs (tri par date, décompte J-X, édition) |
| `app/(app)/profile/` | Profil & diète |
| `app/(app)/followup/` | Suivi (notes/blessures) |
| `app/(app)/library/` | Bibliothèque d'exercices + filtres personnalisables |
| `components/DataProvider.tsx` | Contexte : 3 modes (auth/invité/local), chargement, sauvegarde, `me`, `role`, `isGuest` |
| `components/SessionEditor.tsx` | Édition séance (coach=tout, client=feedback) |
| `components/ExerciseMultiSelect.tsx` | Filtres + sélection multiple d'exercices (réutilisable) |
| `components/ExercisePicker.tsx` | Modale picker + création inline d'exercices (avec case "Ajouter à la bibliothèque") |
| `components/GoalInfoModal.tsx` | Fiche objectif en lecture seule (depuis le plan) |
| `components/Header.tsx` | En-tête (titre par route, bouton retour, indicateur sauvegarde) |
| `lib/types.ts` | Tous les types TypeScript + `emptyState()` + bibliothèque par défaut |
| `lib/data.ts` | Fabriques : `newSession`, `exerciseInstanceFromLibrary`, `SESSION_COLORS` |
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
  Env vars à configurer manuellement dans le dashboard Vercel.
- Commits : message en français, signés `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

## Roadmap / prochaines étapes connues
- [ ] Tests Supabase bout en bout (schema.sql + RLS + multi-client)
- [ ] Migration : `library` et `sessions` en tables Supabase dédiées (scope coach) plutôt que blob
