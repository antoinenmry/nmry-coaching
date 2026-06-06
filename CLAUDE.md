# NMRY Coaching — contexte projet

App de coaching **musculation** (mobile-first, responsive PC) : interface **coach/sportif** pour
profil & diète, plan d'entraînement, objectifs/compétitions, records, suivi et bibliothèque d'exercices.
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
- **Exports dans `page.tsx`** : Next.js n'autorise que `default` + exports réservés (`generateMetadata`…).
  Tout composant partagé doit vivre dans `components/`.

## Variables d'environnement
| Variable | Scope | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Clé anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Serveur uniquement** | Clé service role — accès admin (routes API coach) |

`SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** être exposée côté client.

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
- **Trigger `prevent_role_escalation`** : empêche un sportif de se passer coach via l'API.
- **Guard applicatif** : `update()` dans DataProvider refuse si `role=client` et `activeUserId ≠ me.id`.
- **`updateLibrary()`** refuse si `role !== 'coach'` en mode auth.
- **Open redirect** : le paramètre `?next=` des callbacks est validé (chemin relatif uniquement).
- **Routes API `/api/coach/*`** : vérifient session + rôle coach avant toute opération ; utilisent
  le client admin (service role) uniquement côté serveur.

## Rôles coach / sportif
Exposés par `useData()` : `role`, `me`, `clients`, `activeUserId`, `switchClient`, `library`, `updateLibrary`.

- **Coach** : crée et édite les séances, gère la bibliothèque partagée, peut dupliquer des semaines.
  Voit un `ClientSelector` dans le header (dropdown via portal, évite le clipping backdrop-blur).
  Le sportif sélectionné est persisté dans `localStorage` (`nmry-coach-selected-client`).
  Voit les objectifs de **tous** les sportifs sur son calendrier (chargés en parallèle).
  Accès à `/overview` (blessures actives + objectifs agrégés) et à la Vue Gestion des Profils.
- **Sportif** : place les séances, renseigne ressenti (emoji 1-5), RPE, commentaire, valide une séance.
  La prescription est en lecture seule. La bibliothèque est en lecture seule.

## Modèle de données (`lib/types.ts` → `AppState`)
Document unique par sportif (JSON dans `app_state.data` Supabase) :

- `profile: UserProfileData` :
  `name`, `photo` (base64), `birthDate`, `gender`, `height`, `weight`, `sports[]`, `diet`.
  ⚠️ `diet` est affiché/édité dans `/followup` (pas `/profile`).

- `sessions: SessionInstance[]` — **liste à plat** :
  - `date = null` → banque « À placer » ; `date = "YYYY-MM-DD"` → placée.
  - `ExerciseInstance` : `uid`, `exId`, `name`, `sets`, `reps`, `weight`, `rpeCoach`, `rpeClient`,
    `coachComment`, `clientComment`. `weight/rpeCoach = 0` → non renseigné.

- `goals: Goal[]` : `competition`, `date`, `place`, `expected` (commentaires libres),
  `events?: GoalEvent[]` (épreuves structurées `{ id, name, planned, achieved }`),
  `clientName?` (enrichi côté coach, non persisté).

- `followups: Followup[]` : `date` (début), `dateEnd?` (fin, blessures uniquement),
  `type` (`"note"|"injury"`), `text`.
  Les blessures actives apparaissent dans le calendrier (`/plan`) et la vue d'ensemble (`/overview`).

- `records: RecordsData` : force (max 3 par exercice), CAP, Hyrox.
- `preferences: UserPreferences` : `cardColors` (href→hex), `cardColorMode` (`"arc"|"full"`).
- `library` : **ignoré en mode auth** — la bibliothèque vient de `library_state` (table dédiée, singleton).

### Schéma Supabase étendu
| Table | Colonne | Rôle |
|---|---|---|
| `profiles` | `status` (`active`/`inactive`, défaut `active`) | Statut sportif, modifiable par le coach |
| `app_state` | `updated_by_coach_at` TIMESTAMPTZ | Dernière sauvegarde par le coach |
| `app_state` | `updated_by_client_at` TIMESTAMPTZ | Dernière sauvegarde par le sportif |
| `auth.users` | `last_sign_in_at` | Dernière connexion — lu via service role uniquement |

`DataProvider.pushNow()` écrit `updated_by_coach_at` ou `updated_by_client_at` selon le rôle connecté.

### Bibliothèque partagée (`library_state`)
Table Supabase singleton (id=1), lisible par tous, éditable seulement par le coach.
`tags: Record<string, string[]>` — multi-sélection (OR dans une catégorie, AND entre catégories).

## Routes API (server-side, service role)
| Route | Méthode | Rôle |
|---|---|---|
| `/api/coach/athletes` | GET | Profils + timestamps + `last_sign_in_at` de tous les sportifs |
| `/api/coach/athletes/[id]` | PATCH | Mise à jour `status` (`active`/`inactive`) |
| `/api/coach/athletes/[id]` | DELETE | Suppression compte auth + cascade profiles/app_state |

Toutes les routes vérifient `requireCoach()` (session + rôle). Le client admin (`lib/supabase/admin.ts`)
n'est instancié que côté serveur.

## Carte des fichiers
| Chemin | Rôle |
|---|---|
| `app/login/` | Connexion / inscription / mot de passe oublié |
| `app/auth/callback/` | Route handler PKCE : échange `code` → session |
| `app/auth/confirm/` | Route handler OTP : vérifie `token_hash` |
| `app/auth/reset-password/` | Page de saisie du nouveau mot de passe |
| `app/api/coach/athletes/` | GET liste sportifs enrichie (service role) |
| `app/api/coach/athletes/[id]/` | PATCH statut · DELETE compte |
| `app/(app)/layout.tsx` | Zone protégée : vérifie session Supabase |
| `app/(app)/page.tsx` | Accueil : cartes nav + bannière Vue d'ensemble (coach) |
| `app/(app)/plan/` | Planning mois/sem/synthèse, banque, glisser-déposer, duplication semaine |
| `app/(app)/settings/` | Réglages : compte, apparence, couleurs, Vue Gestion des Profils (coach) |
| `app/(app)/goals/` | Objectifs + épreuves prévu/réalisé |
| `app/(app)/profile/` | Profil : photo, nom, date naissance, genre, taille, poids, sports |
| `app/(app)/followup/` | Suivi : diète, blessures (dates début/fin), notes |
| `app/(app)/overview/` | Vue d'ensemble coach : blessures actives + objectifs tous sportifs |
| `app/(app)/library/` | Bibliothèque partagée + filtres multi-sélection + recherche |
| `app/(app)/records/` | Records force + CAP + Hyrox + courbes SVG |
| `components/DataProvider.tsx` | Contexte global : auth, state, library, tracking timestamps |
| `components/ClientSelector.tsx` | Dropdown coach (portal `document.body` — évite clipping header) |
| `components/Header.tsx` | En-tête sticky + bandeau ClientSelector / ⚙ |
| `components/ThemeProvider.tsx` | Dark/light mode — `localStorage` + `data-theme` sur `<html>` |
| `components/SessionEditor.tsx` | Édition séance : coach = tout ; sportif = feedback + validation |
| `components/GoalInfoModal.tsx` | Fiche objectif lecture seule (planning) — affiche épreuves + clientName |
| `components/EventsDisplay.tsx` | Tableau épreuves prévu/réalisé (partagé goals + modal) |
| `components/ExerciseMultiSelect.tsx` | Filtres + recherche + liste d'exercices à cocher |
| `components/ExercisePicker.tsx` | Modale picker + création inline |
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
- **Imports** : alias `@/` = racine du projet. UI entièrement **en français**.

## Infra
- GitHub : `github.com/antoinenmry/nmry-coaching` — SSH (`~/.ssh/github_tridash`), remote
  `git@github.com:antoinenmry/nmry-coaching.git`. Pas de token, pas de `gh`. Pas de CLI Vercel.
- Vercel : team `antoinenmry-s-projects`. `git push origin main` → deploy auto.
- Commits : message en français, signés `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

## Roadmap / prochaines étapes connues
- [ ] Configurer SMTP Resend pour lever la limite 2 emails/h (voir section Auth ci-dessus)
- [ ] Tests Supabase bout en bout (schema.sql + RLS + multi-sportif)
- [ ] Migration : `sessions` et `records` en tables Supabase dédiées plutôt que blob JSON
