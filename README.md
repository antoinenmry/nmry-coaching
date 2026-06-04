# NMRY Coaching

Application mobile-first (responsive PC) de coaching musculation : interface client/coach
pour le profil, la diète, le plan d'entraînement, les objectifs et le suivi personnalisé.

## Lancer en local

Aucune dépendance — c'est du HTML/CSS/JS statique.

```bash
python3 -m http.server 4173
# puis ouvrir http://localhost:4173
```

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Page + conteneur des vues |
| `css/styles.css` | Styles (thème sombre, mobile-first) |
| `js/data.js` | **Bibliothèque éditable** : exercices + modèles de séances |
| `js/storage.js` | Couche de stockage (localStorage ; Supabase à venir) |
| `js/app.js` | Logique : accueil, profil, planning, objectifs, suivi |

## Ajouter une séance ou un exercice

Tout se passe dans `js/data.js` :

- **Exercice** : une ligne dans `EXERCISES` → `{ id: 'hack-squat', name: 'Hack squat', group: 'Jambes' }`
- **Séance** : un bloc dans `SESSION_TEMPLATES` avec une liste d'exercices et leurs valeurs par défaut (séries, reps, poids, RPE).

## Fonctionnalités

- Accueil : 4 sections (Profil & Diète, Planning, Objectifs, Suivi).
- Planning : vue mois / semaine, glisser-déposer des séances (tap-to-place sur mobile).
- Éditeur de séance : séries, répétitions, poids (curseur + champ libre), RPE /10 (coach), validation client.
- Objectifs : compétitions, dates, lieux, performances attendues.
- Suivi : notes et blessures datées.

## Déploiement

Hébergé sur Vercel (projet statique). Chaque push sur `main` redéploie automatiquement.
