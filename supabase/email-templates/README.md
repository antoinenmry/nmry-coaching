# Emails NMRY — Supabase Auth + SMTP OVH

## 1. SMTP (Supabase → Authentication → Emails → SMTP Settings)
| Champ | Valeur |
|---|---|
| Sender email | `no-reply@nmry.fr` |
| Sender name | `NMRY Coaching` |
| Host | `ssl0.ovh.net` (ou le serveur indiqué dans ton espace OVH) |
| Port | `465` |
| Username | l'adresse complète de la **boîte** OVH (un alias seul ne peut pas se connecter) |
| Password | mot de passe de la boîte |

Après activation, la limite de 2-3 mails/heure du SMTP par défaut disparaît.

## 2. Templates (Supabase → Authentication → Emails → Templates)
Coller le contenu du fichier HTML dans « Message body » et le sujet ci-dessous dans « Subject ».

| Template Supabase | Fichier | Sujet |
|---|---|---|
| Confirm sign up | `confirm-signup.html` | `[NMRY] Confirme ton adresse email` |
| Reset password | `reset-password.html` | `[NMRY] Réinitialise ton mot de passe` |
| Magic link | `magic-link.html` | `[NMRY] Ton lien de connexion` |
| Invite user | `invite.html` | `[NMRY] Tu es invité(e) sur NMRY Coaching` |
| Change email address | `change-email.html` | `[NMRY] Confirme ta nouvelle adresse email` |
| Reauthentication | `reauthentication.html` | `[NMRY] Ton code de vérification` |

Le préfixe `[NMRY]` permet un seul filtre Gmail pour tout ranger.

## 3. Mails envoyés par l'app (alertes urgentes, demandes d'inscription)
Variables d'environnement Vercel (puis redéployer) :
| Variable | Rôle |
|---|---|
| `SMTP_HOST` | `ssl0.ovh.net` |
| `SMTP_PORT` | `465` (défaut) |
| `SMTP_USER` | adresse de la boîte OVH |
| `SMTP_PASSWORD` | mot de passe de la boîte |
| `MAIL_FROM_ADDRESS` | expéditeur affiché, défaut `no-reply@nmry.fr` |
| `MAIL_BCC` | copie cachée de tous les mails de l'app, défaut `simon.nemery@gmail.com` (vide = désactivée) |
| `MAIL_SIGNUP_TO` | destinataire des demandes d'inscription, défaut `simon.nemery@gmail.com` |

Sans `SMTP_*`, l'app retombe sur Gmail (`GMAIL_USER` / `GMAIL_APP_PASSWORD`).
La copie cachée n'existe pas pour les mails d'authentification de Supabase (le service ne la permet pas).

## 4. Filtre Gmail (boîte à part)
Gmail → Paramètres → Filtres et adresses bloquées → Créer un filtre :
- **De** : `no-reply@nmry.fr` (ou **Contient les mots** : `[NMRY]` dans l'objet)
- Cocher : **Ne pas afficher dans la boîte de réception (archiver)**, **Appliquer le libellé** « NMRY » (nouveau), **Ne jamais envoyer dans spam**.
