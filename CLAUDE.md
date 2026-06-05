# NMRY Coaching — contexte projet

App de coaching **musculation** (mobile-first, responsive PC) : interface **coach/client** pour
profil & diète, plan d'entraînement, objectifs/compétitions, suivi, et bibliothèque d'exercices.
UI **en français**.

## Stack
- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** (config via `@theme` dans `app/globals.css`, pas de `tailwind.config`)
- **Supabase** (auth email + Postgres + RLS) via `@supabase/ssr` — actuellement **désactivé** (mode local)
- Déploiement **Vercel** (auto-deploy sur push `main`)

## Commandes
```bash
npm run dev      # http://localhost:3000
npm run build    # build de prod
npx tsc --noEmit # type-check seul (sûr)
```

### ⚠️ Pièges à éviter (déjà rencontrés, font perdre du temps)
- **Ne JAMAIS lancer `npm run build` pendant que `next dev` tourne** : ils partagent le dossier
  `.next` et se corrompent (erreurs `__webpack_modules__ is not a function`, `Cannot find module './xxx.js'`,
  "Chargement…" bloqué). Pour valider un build : **arrêter le serveur de preview d'abord**, builder,
  puis relancer. Pour un simple check de types pendant le dev : `npx tsc --noEmit`.
- Si le cache `.next` est corrompu : `rm -rf .next` puis relancer le dev.
- **Outil de preview** : la navigation programmatique (`location.href`) est instable et tend à revenir
  sur `/`. Préférer **cliquer les liens** (`a[href=...]`) pour la navigation client. Après un clic de
  navigation, laisser ~4-8 s (compile + hydratation) avant d'inspecter. Les vérifs d'état après un
  `click()` synchrone sont des faux négatifs (le re-render React n'a pas eu lieu) → re-évaluer après coup.

## Mode local & rôles (état actuel)
- `lib/config.ts` → `AUTH_ENABLED = false` : l'app s'ouvre **sans connexion**, données dans
  **localStorage** (clé `nmry-local-state`). Passer à `true` réactive Supabase (login + sauvegarde en ligne).
- **Rôle Coach/Client** : en mode local, un **bouton de bascule** sur la page Plan (persisté dans
  `nmry-local-role`, défaut `coach`). En mode auth, le rôle viendra du compte. Exposé par `useData()` :
  `role` / `setRole`.
  - **Coach** : crée/édite les séances (prescription : séries/reps/poids/RPE coach), gère la bibliothèque.
  - **Client** : glisse-dépose les séances sur les jours + renseigne ressenti (emoji), RPE client,
    commentaire. **Prescription en lecture seule.**

## Modèle de données (`lib/types.ts` → `AppState`)
Document unique par client (JSON en local, table `app_state.data` en Supabase) :
- `profile` : infos perso + diète.
- `sessions: SessionInstance[]` : **liste à plat**. `date = null` ⇒ dans la banque « À placer » ;
  `date = "YYYY-MM-DD"` ⇒ placée ce jour. Chaque séance a `emoji` (ressenti 1-5) et des `exercises`
  (`ExerciseInstance` : sets/reps/weight/rpeCoach/rpeClient/clientComment + `name` figé + `exId`).
- `goals: Goal[]` : compétitions (competition/date/place/expected).
- `followups: Followup[]` : notes & blessures.
- `library: ExerciseLibrary` : `categories` (filtres personnalisables) + `exercises`
  (`LibraryExercise` = nom + tags + lien vidéo ; **la prescription vit dans le plan, pas ici**).

## Carte des fichiers
| Chemin | Rôle |
|---|---|
| `app/login/` | Écran connexion/inscription (auth) |
| `app/(app)/layout.tsx` | Zone authentifiée (garde auth si `AUTH_ENABLED`) + `DataProvider` + `Header` |
| `app/(app)/page.tsx` | Accueil : 5 cartes + badge rôle/nom + décompte prochain objectif |
| `app/(app)/profile/` | Profil & diète |
| `app/(app)/plan/` | Planning mois/semaine, banque « À placer », glisser-déposer, compose séance |
| `app/(app)/goals/` | Objectifs (tri par date, décompte, édition) |
| `app/(app)/followup/` | Suivi (notes/blessures) |
| `app/(app)/library/` | Bibliothèque d'exercices + filtres personnalisables |
| `components/DataProvider.tsx` | Contexte : chargement/sauvegarde état, `me`, `role`, clients |
| `components/SessionEditor.tsx` | Édition séance, **conscient du rôle** (coach=tout / client=feedback) |
| `components/ExerciseMultiSelect.tsx` | Filtres + sélection multiple d'exercices (réutilisable) |
| `components/ExercisePicker.tsx` | Modale wrapper du multi-select |
| `components/GoalInfoModal.tsx` | Fiche objectif lecture seule (depuis le plan) |
| `components/Header.tsx` | En-tête (titre par route, bouton retour) |
| `lib/types.ts` | Tous les types + `emptyState()` + bibliothèque par défaut |
| `lib/data.ts` | **Bibliothèque éditable** + fabriques (`newSession`, `exerciseInstanceFromLibrary`), `SESSION_COLORS` |
| `lib/dates.ts` | `daysUntil`, `countdownLabel`, `frenchDate` |
| `lib/supabase/` | Clients Supabase (browser/server/middleware) — repli sans env vars |
| `lib/config.ts` | `AUTH_ENABLED` |
| `supabase/schema.sql` | Schéma + RLS coach/client + trigger inscription |

## Conventions
- **Tokens couleurs** (Tailwind v4) : `bg`, `surface`, `surface2`, `line`, `ink`, `dim`, `accent`,
  `accent2`, `ok`, `danger`. Ex : `bg-surface`, `text-dim`, `border-line`, `text-ok`.
- Modales : `fixed inset-0 z-50 flex items-end sm:items-center` + carte `rounded-t-3xl sm:rounded-3xl`.
- Sauvegarde : mutations via `update((draft) => { ... })` de `useData()` (immuable + sauvegarde différée).
- Tout le texte d'UI est **en français**.

## Infra
- GitHub : `github.com/antoinenmry/nmry-coaching` — push via **SSH** (clé `~/.ssh/github_tridash`,
  remote `git@github.com:...`). Pas de token, pas de `gh`.
- Supabase : projet ref `zhvfqcxdifribggyzxgk`. Variables Vercel (quand auth ON) :
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé anon = publique, OK).
- **Déploiement** : `git push origin main` ⇒ Vercel build & deploy automatiquement (je ne peux pas
  déclencher Vercel directement). Commits en français, signés `Co-Authored-By: Claude`.

## Réactiver l'authentification (plus tard)
1. `lib/config.ts` → `AUTH_ENABLED = true`.
2. Exécuter `supabase/schema.sql` dans Supabase (SQL Editor).
3. Désactiver « Confirm email » pour tester, créer un compte, puis
   `update public.profiles set role='coach' where email='...'`.
4. Ajouter les 2 env vars `NEXT_PUBLIC_SUPABASE_*` sur Vercel.
> Migration possible plus tard : la `library` (et idéalement les `sessions`) devraient passer en
> tables dédiées / scope coach pour le multi-client, plutôt que le blob `app_state` par utilisateur.
