# NMRY Coaching

Application de coaching musculation (mobile-first, responsive PC) : interface
client/coach pour le profil, la diète, le plan d'entraînement, les objectifs
et le suivi personnalisé.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (auth email + Postgres + RLS) via `@supabase/ssr`
- Déploiement **Vercel**

## Démarrer en local

```bash
npm install
npm run dev          # http://localhost:3000
```

Variables d'environnement — créer `.env.local` (déjà présent en local) :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

> ⚠️ La clé `anon` est publique (sûre côté navigateur, protégée par le RLS).
> Ne jamais committer la clé `service_role`.

## Base de données

Le schéma SQL (tables `profiles` + `app_state`, RLS coach/client, trigger
d'inscription) est dans [`supabase/schema.sql`](supabase/schema.sql). À coller
dans Supabase → SQL Editor → Run.

## Structure

| Chemin | Rôle |
|---|---|
| `app/login` | Écran de connexion / inscription |
| `app/(app)/` | Zone authentifiée (layout protégé + header) |
| `app/(app)/page.tsx` | Accueil : 4 sections + sélecteur de client (coach) |
| `app/(app)/profile` | Profil & diète |
| `app/(app)/plan` | Planning mois/semaine, glisser-déposer |
| `app/(app)/goals` | Objectifs / compétitions |
| `app/(app)/followup` | Suivi : notes & blessures |
| `components/DataProvider.tsx` | Chargement + sauvegarde auto de l'état |
| `components/SessionEditor.tsx` | Édition d'une séance (séries, reps, poids, RPE, validation) |
| `lib/data.ts` | **Bibliothèque éditable** : exercices + modèles de séances |
| `lib/types.ts` | Types du modèle de données |
| `lib/supabase/` | Clients Supabase (navigateur / serveur / middleware) |

## Ajouter une séance ou un exercice

Tout se passe dans [`lib/data.ts`](lib/data.ts) :

- **Exercice** : une ligne dans `EXERCISES` → `{ id: "hack-squat", name: "Hack squat", group: "Jambes" }`
- **Séance** : un bloc dans `SESSION_TEMPLATES` avec sa liste d'exercices et valeurs par défaut (séries, reps, poids, RPE).

## Déploiement Vercel

Importer le repo GitHub dans Vercel, ajouter les 2 variables d'environnement
`NEXT_PUBLIC_SUPABASE_*`, déployer. Chaque `git push` redéploie automatiquement.
