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
- **Vercel** : `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les env vars.
- **Supabase → Auth → URL Configuration** :
  - Site URL : `https://nmry-coaching.vercel.app`
  - Redirect URLs : `https://nmry-coaching.vercel.app/auth/callback` + `http://localhost:3000/auth/callback`
- Après changement d'env vars Vercel : **redéployer manuellement**.

### ⚠️ Limite emails Supabase (plan gratuit : 2-3 emails/heure)
Le plan gratuit Supabase bloque les envois d'emails auth après 2-3 emails/heure.
**Symptôme** : "email rate limit exceeded" sur reset password / magic link.

**Fix immédiat — changer le mdp sans email (SQL Editor Supabase) :**
```sql
UPDATE auth.users
SET encrypted_password = crypt('nouveau_mdp', gen_salt('bf'))
WHERE email = 'user@email.com';
```

**Fix permanent — SMTP Resend (gratuit, 100 emails/jour) :**
1. Créer un compte sur **resend.com** → API Keys → créer une clé
2. Supabase → **Authentication → Emails → SMTP Settings** → activer "Custom SMTP"
   - Host : `smtp.resend.com` · Port : `465`
   - User : `resend` · Password : clé API Resend
   - Sender : adresse email avec ton domaine (ou `onboarding@resend.dev` pour tester)

**Augmenter la durée des liens OTP :**
Supabase → Authentication → Email → "OTP Expiry" → mettre `86400` (24h au lieu de 1h).

### ⚠️ Piège middleware — `MIDDLEWARE_INVOCATION_FAILED`
Le middleware vérifie la présence des variables avant de créer le client Supabase ; sinon, dégrade
proprement. Les routes `/auth/*` sont exclues de la protection.
Le middleware intercepte aussi `?error=access_denied` sur la racine `/` (erreur OTP expiré de Supabase)
et redirige vers `/login?error=lien_invalide`.

### État Supabase
- Projet ref : `zhvfqcxdifribggyzxgk`
- Schéma : `supabase/schema.sql` (tables `profiles`, `app_state`, `library_state`, RLS, triggers)
- **Pour ajouter un coach** (après inscription dans l'app) :
  `update public.profiles set role = 'coach' where email = 'EMAIL';`
  L'architecture supporte plusieurs coachs simultanément.

## Sécurité
- **RLS** : `state_self_all` (client → ses données), `state_coach_all` (coach → tout le monde),
  `library_read_all` (tous → lecture), `library_coach_write` (coach → écriture).
- **Trigger `prevent_role_escalation`** : empêche un client de se passer coach via l'API.
- **Guard applicatif** : `update()` dans DataProvider refuse si `role=client` et `activeUserId ≠ me.id`.
- **`updateLibrary()`** refuse si `role !== 'coach'` en mode auth.
- **Open redirect** : le paramètre `?next=` des callbacks est validé (chemin relatif uniquement).

## Rôles coach / client
Exposés par `useData()` : `role`, `me`, `clients`, `activeUserId`, `switchClient`, `library`, `updateLibrary`.

- **Coach** : crée et édite les séances, gère la bibliothèque partagée, peut dupliquer des semaines.
  Voit un `ClientSelector` dans le header pour naviguer entre les clients.
  Le client sélectionné est persisté dans `localStorage` (`nmry-coach-selected-client`).
- **Client** : place les séances, renseigne ressenti (emoji 1-5), RPE client, commentaire, valide une séance.
  La prescription est en lecture seule. La bibliothèque est en lecture seule.

## Modèle de données (`lib/types.ts` → `AppState`)
Document unique par client (JSON dans `app_state.data` Supabase) :

- `profile: UserProfileData` :
  `name`, `photo` (base64), `birthDate`, `gender`, `height`, `weight`, `sports[]`, `diet`.

- `sessions: SessionInstance[]` — **liste à plat** :
  - `date = null` → banque « À placer » ; `date = "YYYY-MM-DD"` → placée.
  - `ExerciseInstance` : `uid`, `exId`, `name`, `sets`, `reps`, `weight`, `rpeCoach`, `rpeClient`,
    `coachComment`, `clientComment`. `weight/rpeCoach = 0` → non renseigné.

- `goals: Goal[]` : `competition`, `date`, `place`, `expected`.
- `followups: Followup[]` : `date`, `type` (`"note"|"injury"`), `text`.
- `records: RecordsData` : force (max 3 par exercice), CAP, Hyrox.
- `preferences: UserPreferences` : `cardColors` (href→hex), `cardColorMode` (`"arc"|"full"`).
- `library` : **ignoré en mode auth** — la bibliothèque vient de `library_state` (table dédiée, singleton).

### Bibliothèque partagée (`library_state`)
Table Supabase singleton (id=1), lisible par tous les comptes auth, éditable seulement par le coach.
`tags: Record<string, string[]>` — **multi-sélection** par catégorie (OR dans une catégorie, AND entre).
En mode local/invité, la bibliothèque reste dans `state.library` (localStorage).

## Carte des fichiers
| Chemin | Rôle |
|---|---|
| `app/login/` | Connexion / inscription / mot de passe oublié (pas de mode invité) |
| `app/auth/callback/` | Route handler PKCE : échange `code` → session |
| `app/auth/confirm/` | Route handler OTP : vérifie `token_hash` |
| `app/auth/reset-password/` | Page de saisie du nouveau mot de passe |
| `app/(app)/layout.tsx` | Zone protégée : vérifie session Supabase uniquement |
| `app/(app)/page.tsx` | Accueil : 6 cartes avec couleurs personnalisables (arc ou fond) |
| `app/(app)/plan/` | Planning mois/sem, banque « À placer », glisser-déposer, duplication de semaine |
| `app/(app)/settings/` | Réglages : compte, dark/light mode, couleurs cartes |
| `app/(app)/goals/` | Objectifs (tri par date, décompte J-X, édition) |
| `app/(app)/profile/` | Profil : photo, nom, date naissance, genre, taille, poids, sports, diète |
| `app/(app)/followup/` | Suivi (notes/blessures) |
| `app/(app)/library/` | Bibliothèque partagée + filtres multi-sélection + recherche texte |
| `app/(app)/records/` | Records force + CAP + Hyrox + courbes de tendance SVG |
| `components/DataProvider.tsx` | Contexte : modes auth/local, `library`+`updateLibrary` séparés du state client |
| `components/ClientSelector.tsx` | Dropdown coach pour changer de client actif |
| `components/Header.tsx` | En-tête + bandeau `[ClientSelector] [⚙]` |
| `components/ThemeProvider.tsx` | Dark/light mode — lit/écrit `localStorage` + `data-theme` sur `<html>` |
| `components/SessionEditor.tsx` | Édition séance : coach = tout éditer ; client = feedback + validation |
| `components/ExerciseMultiSelect.tsx` | Filtres + recherche texte + liste d'exercices à cocher |
| `components/ExercisePicker.tsx` | Modale picker + création inline |
| `lib/types.ts` | Tous les types TypeScript + `emptyState()` + `emptyRecords()` |
| `lib/supabase/middleware.ts` | Refresh session + garde routes + intercepte erreurs Supabase OTP |
| `supabase/schema.sql` | Schéma complet : profiles, app_state, library_state, RLS, triggers |

## Conventions
- **Tokens couleurs Tailwind v4** : `bg-bg`, `bg-surface`, `bg-surface2`, `border-line`, `text-ink`,
  `text-dim`, `text-accent`, `bg-accent`, `text-ok`, `bg-ok`, `text-danger`, `bg-danger`,
  `bg-accent2`, `text-accent2`. Couleur violette (bouton dupliquer) : `#a855f7` inline.
- **Thème clair/sombre** : `[data-theme="light"]` dans `globals.css`. Script anti-flash dans `app/layout.tsx`.
- **Modales** : `fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center`
  + contenu `rounded-t-3xl sm:rounded-3xl border-t border-line bg-surface p-5`.
- **Mutations d'état client** : `update((draft) => { ... })` — immuable + sauvegarde différée 500 ms.
- **Mutations bibliothèque** : `updateLibrary((lib) => { ... })` — sauvegarde dans `library_state`.
- **Imports** : alias `@/` = racine du projet. UI entièrement **en français**.

## Infra
- GitHub : `github.com/antoinenmry/nmry-coaching` — SSH (`~/.ssh/github_tridash`), remote
  `git@github.com:antoinenmry/nmry-coaching.git`. Pas de token, pas de `gh`. Pas de CLI Vercel.
- Vercel : team `antoinenmry-s-projects`. `git push origin main` → deploy auto.
- Commits : message en français, signés `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

## Gestion des sportifs (Vue coach — Réglages)

### Schéma étendu
| Table | Colonne | Rôle |
|---|---|---|
| `profiles` | `status` (`active`/`inactive`) | Statut du sportif, modifiable par le coach |
| `app_state` | `updated_by_coach_at` | Timestamp dernière sauvegarde par le coach |
| `app_state` | `updated_by_client_at` | Timestamp dernière sauvegarde par le sportif |
| `auth.users` | `last_sign_in_at` | Dernière connexion — lu via service role (API route) |

### API routes (service role)
- `GET /api/coach/athletes` → retourne `[{ id, last_sign_in_at, updated_by_coach_at, updated_by_client_at, status }]`
- `DELETE /api/coach/athletes/[id]` → supprime le compte auth + profil (cascade)
- `PATCH /api/coach/athletes/[id]` → met à jour `status` (`active`/`inactive`)

### Variables d'environnement requises
- `SUPABASE_SERVICE_ROLE_KEY` (Vercel + `.env.local`) — clé secrète Supabase, jamais exposée au client

### UI — Settings
- Dropdown coach : "Affichage standard" / "Vue Gestion des Profils"
- Vue Gestion : grille de cartes par sportif avec toutes les métadonnées + bouton Supprimer (modale de confirmation)

## Roadmap / prochaines étapes connues
- [ ] Configurer SMTP Resend pour lever la limite 2 emails/h (voir section Auth ci-dessus)
- [ ] Tests Supabase bout en bout (schema.sql + RLS + multi-client)
- [ ] Migration : `sessions` et `records` en tables Supabase dédiées (scope coach) plutôt que blob
