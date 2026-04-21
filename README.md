# NDF — Gestion des Notes de Frais

Application web de gestion des notes de frais avec workflow d'approbation multi-niveaux.

## Fonctionnalités

- **Espace personnel** : chaque employé gère ses propres notes de frais
- **Workflow d'approbation** : Employé → Manager → Comptabilité
- **Upload de justificatifs** (PDF, image) avec stockage MinIO
- **Saisie manuelle** : montant TTC + taux de TVA → calcul automatique HT/TVA
- **Correction comptable** : la comptabilité peut corriger les montants et la date pendant la validation
- **Vue d'ensemble comptabilité** : tableau de bord avec filtres (période, équipe, salarié, statut) et export CSV
- **Notifications email** à chaque étape du workflow
- **Réinitialisation de mot de passe** par email
- **Rôles** : Utilisateur, Manager, Comptabilité, Admin

## Stack technique

| Composant | Technologie |
|---|---|
| Backend | Python 3.12 + FastAPI |
| Base de données | PostgreSQL 16 |
| Cache / sessions | Redis 7 |
| Stockage fichiers | MinIO (compatible S3) |
| Emails (dev) | MailHog |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Auth | JWT (python-jose) |

## Démarrage rapide

### Prérequis

- Docker 24+ et Docker Compose v2

### Installation

```bash
git clone <repo>
cd ndf

# Copier et adapter la configuration
cp env.example .env
# Éditez .env (JWT_SECRET et credentials admin obligatoires en production)

# Lancer tous les services
docker compose up -d --build
```

L'application est disponible sur **http://localhost:3000**.

La base de données et le bucket MinIO sont créés automatiquement au premier démarrage.

### Compte administrateur

Un compte administrateur est **toujours créé automatiquement** au premier démarrage, avec les identifiants définis dans le `.env` :

```env
ADMIN_EMAIL=admin@company.com
ADMIN_PASSWORD=Admin1234!
```

> **En production** : changez ces deux variables avant le premier `docker compose up`.  
> Si la base est déjà initialisée, modifiez le mot de passe via l'interface Admin ou la page "Mot de passe oublié".

### Comptes de démonstration

Activés par défaut (`DEMO_ACCOUNTS=true`), à désactiver en production.

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | admin@company.com | Admin1234! |
| Manager | manager@company.com | manager |
| Comptabilité | compta@company.com | compta |
| Utilisateur 1 | user1@company.com | user1 |
| Utilisateur 2 | user2@company.com | user2 |

### Ports exposés

| Service | Port |
|---|---|
| Frontend (Nginx) | 3000 |
| Backend (FastAPI) | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| MailHog SMTP | 1126 |
| MailHog Web UI | 8026 |

## Variables d'environnement

Voir [env.example](env.example) pour la liste complète.

| Variable | Défaut | Description |
|---|---|---|
| `ADMIN_EMAIL` | `admin@company.com` | Email du compte admin initial |
| `ADMIN_PASSWORD` | `Admin1234!` | **Changer en production** |
| `JWT_SECRET` | `change-me-…` | **Changer en production** |
| `DEMO_ACCOUNTS` | `true` | `false` en production |
| `FRONTEND_URL` | `http://localhost:3000` | Utilisé dans les liens des emails |
| `MINIO_PUBLIC_BASE_URL` | _(vide)_ | URL publique MinIO si derrière un reverse-proxy |
| `SMTP_FROM` | `ndf@company.com` | Adresse expéditeur des emails |

### Passage en production

Voici le `.env` minimal pour une mise en production :

```env
DEMO_ACCOUNTS=false
ADMIN_EMAIL=votre@email.com
ADMIN_PASSWORD=MotDePasseForte123!
JWT_SECRET=une-chaine-aleatoire-longue-et-secrete
FRONTEND_URL=https://ndf.mondomaine.fr
```

Puis rebuild et démarrage :

```bash
docker compose build --no-cache backend frontend
docker compose up -d
```

### MinIO public URL

Si MinIO est exposé via un reverse-proxy ou un CDN :

```env
MINIO_PUBLIC_BASE_URL=https://ged.mondomaine.fr
```

Les URLs présignées des justificatifs pointeront vers ce domaine public.

## Workflow d'approbation

```
Brouillon → [Soumis] → En attente Manager → [Approuvé/Refusé]
                                                    ↓ (si approuvé)
                                          En attente Comptabilité → [Approuvé final / Refusé]
                                                                          ↓
                                                                   Notification employé
```

- À chaque étape, un email est envoyé au destinataire concerné.
- En cas de refus, l'employé est notifié avec le motif.
- La comptabilité peut corriger les montants, la TVA et la date avant validation.
- L'employé peut supprimer ses brouillons (unitaire ou multi-sélection).

## Emails de développement

Les emails sont interceptés par MailHog. Interface web disponible sur **http://localhost:8026**.

## Structure du projet

```
ndf/
├── backend/
│   ├── app/
│   │   ├── main.py          # Point d'entrée FastAPI + création admin + seed démo
│   │   ├── config.py        # Configuration (pydantic-settings)
│   │   ├── models/          # Modèles SQLAlchemy
│   │   ├── routers/         # Endpoints API
│   │   ├── schemas/         # Schémas Pydantic
│   │   ├── services/        # Logique métier (auth, email, stockage)
│   │   └── workers/         # Celery (réservé pour usage futur)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # Vues React (Dashboard, Login, …)
│   │   ├── components/      # Composants réutilisables
│   │   ├── services/        # Client API (Axios)
│   │   ├── contexts/        # AuthContext
│   │   └── types/           # Types TypeScript
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
└── env.example
```

## Commandes utiles

```bash
# Voir les logs d'un service
docker compose logs -f backend

# Reconstruire après modification du code backend
docker compose restart backend

# Reconstruire le frontend (si Dockerfile modifié)
docker compose build --no-cache frontend && docker compose up -d frontend

# Réinitialiser la base de données (⚠ supprime toutes les données)
docker compose down -v && docker compose up -d
```
