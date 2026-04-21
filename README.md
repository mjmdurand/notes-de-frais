# NDF — Gestion des Notes de Frais

Application web de gestion des notes de frais avec workflow d'approbation multi-niveaux.

## Fonctionnalités

- **Espace personnel** : chaque employé gère ses propres notes de frais
- **Workflow d'approbation** : Employé → Manager → Comptabilité
- **Upload de justificatifs** (PDF, image) avec stockage MinIO
- **Saisie manuelle** : montant TTC + taux de TVA → calcul automatique HT/TVA
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
# Éditez .env si besoin (JWT_SECRET en production !)

# Lancer tous les services
docker compose up -d --build
```

L'application est disponible sur **http://localhost:3000**.

### Comptes de démonstration

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

Voir [env.example](env.example) pour la liste complète. Variables importantes :

| Variable | Défaut | Description |
|---|---|---|
| `JWT_SECRET` | `change-me-…` | **Changer en production** |
| `FRONTEND_URL` | `http://localhost:3000` | Utilisé dans les liens des emails |
| `MINIO_PUBLIC_BASE_URL` | _(vide)_ | URL publique MinIO si derrière un reverse-proxy |
| `SMTP_FROM` | `ndf@company.com` | Adresse expéditeur des emails |

### MinIO public URL

Par défaut, les URLs de prévisualisation des documents pointent vers MinIO en interne (`http://minio:9000`). Si MinIO est exposé via un reverse-proxy ou un CDN, définissez :

```env
MINIO_PUBLIC_BASE_URL=https://ged.mondomaine.fr
```

Les URLs présignées seront alors remplacées pour pointer vers le domaine public.

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
- L'employé peut supprimer ses brouillons (unitaire ou multi-sélection).

## Emails de développement

Les emails sont interceptés par MailHog. Interface web disponible sur **http://localhost:8026**.

## Structure du projet

```
ndf/
├── backend/
│   ├── app/
│   │   ├── main.py          # Point d'entrée FastAPI + seed démo
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

# Réinitialiser la base de données
docker compose down -v && docker compose up -d
```
