# NDF — Gestion des Notes de Frais

Application web de gestion des notes de frais avec workflow d'approbation multi-niveaux.

## Fonctionnalités

- **Espace personnel** : chaque employé gère ses propres notes de frais
- **Workflow d'approbation** : Employé → Manager → Comptabilité
- **Upload de justificatifs** (PDF, image) avec stockage MinIO
- **Saisie manuelle** : montant TTC + taux de TVA → calcul automatique HT/TVA
- **Correction comptable** : la comptabilité peut corriger les montants, la TVA et la date pendant la validation
- **Vue d'ensemble comptabilité** : tableau de bord avec filtres (période, équipe, salarié, statut), stats et exports
- **Export CSV** : toutes colonnes HT/TVA/TTC, compatible Excel (BOM UTF-8)
- **Export logiciel comptable** : format FEC (CEGID Loop) et format Sage 100 Comptabilité
- **Notifications email** à chaque étape du workflow (templates HTML)
- **Réinitialisation de mot de passe** par email avec lien sécurisé (TTL 1h)
- **Gestion des équipes** : création d'équipes, affectation d'un manager responsable, assignation des utilisateurs
- **Invitation par email** : à la création d'un compte, l'utilisateur reçoit un email avec un lien pour créer son mot de passe (valable 7 jours) — aucun mot de passe saisi par l'admin
- **Réinitialisation admin** : l'admin peut déclencher un email de réinitialisation de mot de passe pour n'importe quel utilisateur
- **Désactivation / réactivation** : l'admin peut désactiver ou réactiver un compte (icône dédiée, pas de suppression). Un compte désactivé ne peut plus se connecter et reçoit un message explicite à la tentative de login
- **Filtres utilisateurs** : recherche textuelle (nom, prénom, email) + filtres par rôle, équipe et statut sur la page d'administration
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
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=Système
```

> **En production** : changez ces variables avant le premier `docker compose up`.  
> Si la base est déjà initialisée, modifiez le mot de passe via l'interface Admin ou la page "Mot de passe oublié".

### Comptes de démonstration

Activés par défaut (`DEMO_ACCOUNTS=true`), à désactiver en production.

**Comptes affichés sur la page de connexion :**

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | admin@company.com | Admin1234! |
| Manager | manager@company.com | manager |
| Comptabilité (validateur) | compta@company.com | compta |
| Utilisateur | user1@company.com | user1 |

**Équipes et comptes créés automatiquement :**

| Équipe | Rôle | Nom | Email | Mot de passe |
|---|---|---|---|---|
| Direction | Manager | Philippe Renard | manager.direction@company.com | dir1 |
| Direction | Utilisateur | Christine Faure | user.direction@company.com | dir2 |
| Commerciaux | Manager | Jean Martin | manager@company.com | manager |
| Commerciaux | Utilisateur | Paul Bernard | user1@company.com | user1 |
| Informatique | Manager | Marc Laurent | manager.info@company.com | info1 |
| Informatique | Utilisateur | Marie Leroy | user2@company.com | user2 |
| Comptabilité | Manager | Isabelle Moreau | manager.compta@company.com | cpta1 |
| Comptabilité | Utilisateur | Thomas Girard | user.compta@company.com | cpta2 |
| Comptabilité | Validateur NDF¹ | Sophie Dupont | compta@company.com | compta |
| Recouvrement | Manager | Nathalie Blanc | manager.recouv@company.com | recv1 |
| Recouvrement | Utilisateur | Antoine Rousseau | user.recouv@company.com | recv2 |

> ¹ `compta@company.com` a le rôle **Comptabilité** (validation des notes de frais) et est rattachée à l'équipe Comptabilité, mais son rôle de validation est indépendant de son appartenance à l'équipe. Tous les membres de l'équipe Comptabilité peuvent soumettre des notes de frais.

La page de connexion affiche automatiquement les identifiants de démonstration lorsque `DEMO_ACCOUNTS=true`, en les récupérant dynamiquement depuis l'API. Les identifiants affichés reflètent toujours la configuration réelle (y compris un `ADMIN_PASSWORD` personnalisé).

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

Voir [env.example](env.example) pour la liste complète et les exemples SMTP.

### Générales

| Variable | Défaut | Description |
|---|---|---|
| `ADMIN_EMAIL` | `admin@company.com` | Email du compte admin initial |
| `ADMIN_PASSWORD` | `Admin1234!` | **Changer en production** |
| `ADMIN_FIRST_NAME` | `Admin` | Prénom du compte admin |
| `ADMIN_LAST_NAME` | `Système` | Nom du compte admin |
| `JWT_SECRET` | `change-me-…` | **Changer en production** |
| `DEMO_ACCOUNTS` | `true` | `false` en production |
| `FRONTEND_URL` | `http://localhost:3000` | Utilisé dans les liens des emails |
| `MINIO_PUBLIC_BASE_URL` | _(vide)_ | URL publique MinIO si derrière un reverse-proxy |
| `SMTP_FROM` | `ndf@company.com` | Adresse email expéditeur |
| `SMTP_FROM_NAME` | `Notes de Frais` | Nom d'affichage de l'expéditeur (indépendant du compte d'auth) |

### Configuration SMTP

Trois modes sont supportés via la variable `SMTP_MODE`.

`SMTP_FROM_NAME` est facultatif mais recommandé : il définit le nom d'affichage de l'expéditeur (ex. `Notes de Frais`), indépendamment du compte d'authentification. Cela permet d'envoyer au nom d'une adresse de service (`no-reply@`, `ndf@`, etc.) tout en s'authentifiant avec n'importe quel compte autorisé.

#### SMTP non authentifié — relais O365 (connecteur Exchange entrant requis)

```env
SMTP_MODE=plain
SMTP_HOST=<domaine>.mail.protection.outlook.com
SMTP_PORT=25
SMTP_FROM=ndf@mondomaine.com
SMTP_FROM_NAME=Notes de Frais
```

#### SMTP authentifié — O365 standard (recommandé)

```env
SMTP_MODE=starttls
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_FROM=no-reply@mondomaine.com
SMTP_FROM_NAME=Notes de Frais
SMTP_USER=compte-service@mondomaine.com
SMTP_PASSWORD=motdepasse
```

#### SMTP avec SSL direct

```env
SMTP_MODE=ssl
SMTP_HOST=smtp.mondomaine.com
SMTP_PORT=465
SMTP_FROM=no-reply@mondomaine.com
SMTP_FROM_NAME=Notes de Frais
SMTP_USER=compte-service@mondomaine.com
SMTP_PASSWORD=motdepasse
```

#### OAuth2 Microsoft Graph — Exchange Online

Nécessite une app Azure AD avec la permission applicative `Mail.Send` et le consentement administrateur.

```env
SMTP_MODE=oauth2
SMTP_FROM=no-reply@mondomaine.com
SMTP_FROM_NAME=Notes de Frais
SMTP_OAUTH_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SMTP_OAUTH_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SMTP_OAUTH_CLIENT_SECRET=votre-secret
```

### Passage en production

`.env` minimal pour une mise en production :

```env
DEMO_ACCOUNTS=false
ADMIN_EMAIL=votre@email.com
ADMIN_PASSWORD=MotDePasseForte123!
JWT_SECRET=une-chaine-aleatoire-longue-et-secrete
FRONTEND_URL=https://ndf.mondomaine.fr

SMTP_MODE=starttls
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_FROM=no-reply@mondomaine.com
SMTP_FROM_NAME=Notes de Frais
SMTP_USER=compte-service@mondomaine.com
SMTP_PASSWORD=motdepasse
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

## Gestion des équipes

Les équipes sont gérées par l'administrateur via le menu **Équipes** (accessible uniquement au rôle admin).

- Chaque équipe a un **nom** et un **manager responsable** optionnel
- Les utilisateurs sont assignés à une équipe depuis la page **Utilisateurs**
- La suppression d'une équipe désaffecte automatiquement ses membres (sans les supprimer)
- La page **Vue d'ensemble** (comptabilité) permet de filtrer les notes par équipe et par manager séparément
- L'export CSV inclut les colonnes Équipe et Manager

En mode démonstration, 5 équipes sont créées automatiquement : **Direction**, **Commerciaux**, **Informatique**, **Comptabilité** et **Recouvrement**, chacune avec un manager et au moins un utilisateur. L'équipe Comptabilité regroupe des employés qui soumettent des notes de frais — la permission de validation comptable est un rôle distinct, indépendant de l'équipe.

## Import CSV d'utilisateurs

Depuis la page **Utilisateurs**, le bouton **Importer CSV** permet de créer des utilisateurs en masse.

### Format du fichier

```csv
prenom,nom,email,role,equipe
Jean,Dupont,jean.dupont@company.com,user,Commercial
Marie,Martin,marie.martin@company.com,manager,Tech
Alice,Durand,alice.durand@company.com,comptabilite,Finance
```

| Colonne | Obligatoire | Valeurs acceptées |
|---|---|---|
| `prenom` | Oui | Texte libre |
| `nom` | Oui | Texte libre |
| `email` | Oui | Adresse email valide |
| `role` | Non (défaut : `user`) | `user` / `utilisateur`, `manager`, `comptabilite` / `accounting`, `admin` |
| `equipe` | Oui | Nom de l'équipe (créée automatiquement si inexistante) |

### Comportement

- Les équipes sont créées automatiquement si elles n'existent pas encore
- Un email d'invitation est envoyé à chaque nouvel utilisateur (lien valable 7 jours)
- Les emails déjà existants sont ignorés sans erreur
- Un rapport de résultat s'affiche après l'import : créés / ignorés / erreurs ligne par ligne
- Compatible avec les exports Excel (BOM UTF-8 géré automatiquement)

## Workflow d'approbation

```
Brouillon → [Soumis] → En attente Manager → [Approuvé/Refusé]
                                                    ↓ (si approuvé)
                                          En attente Comptabilité → [Approuvé final / Refusé]
                                                                          ↓
                                                                   Notification employé
```

- À chaque étape, un email HTML est envoyé au destinataire concerné.
- En cas de refus, l'employé est notifié avec le motif.
- La comptabilité peut corriger les montants, la TVA et la date avant validation.
- L'employé peut supprimer ses brouillons (unitaire ou multi-sélection).

## Réinitialisation de mot de passe

1. L'utilisateur clique sur "Mot de passe oublié ?" sur la page de connexion.
2. Un email avec un lien sécurisé (token valable 1h, stocké dans Redis) est envoyé.
3. Le lien redirige vers `/reset-password?token=…` où l'utilisateur choisit un nouveau mot de passe.
4. Les liens des emails (workflow + reset) redirigent directement vers la bonne page après connexion.

### Politique de mot de passe

Tout nouveau mot de passe (réinitialisation ou création de compte) doit respecter les règles suivantes :

- 8 caractères minimum
- Au moins une majuscule (A-Z)
- Au moins une minuscule (a-z)
- Au moins un chiffre (0-9)
- Au moins un caractère spécial

La page de réinitialisation affiche une barre de force en temps réel et une liste de critères avec indicateurs ✓/✗. La soumission est bloquée tant que tous les critères ne sont pas satisfaits.

De plus, les 5 derniers mots de passe utilisés sont mémorisés : il est impossible de réutiliser un mot de passe récent.

## Export comptable

Depuis l'écran **Vue d'ensemble** (menu Comptabilité), le bouton **Export logiciel comptable** génère un fichier compatible avec les logiciels de comptabilité, sur la base des notes filtrées à l'écran.

### Format FEC — CEGID Loop

Fichier texte séparé par des tabulations, conforme au format légal Fichier des Écritures Comptables (FEC).

Champs : `JournalCode`, `JournalLib`, `EcritureNum`, `EcritureDate`, `CompteNum`, `CompteLib`, `CompAuxNum`, `CompAuxLib`, `PieceRef`, `PieceDate`, `EcritureLib`, `Debit`, `Credit`, `EcritureLet`, `DateLet`, `ValidDate`, `Montantdevise`, `Idevise`

### Format Sage 100 Comptabilité

Fichier texte séparé par des points-virgules, compatible avec le module d'import de Sage 100.

Champs : `E`, `CodeJournal`, `DateJournal (JJMMAAAA)`, `CompteNum`, `CompteAux`, `NumPiece`, `Libellé`, `Débit`, `Crédit`

### Comptes PCG utilisés

| Compte | Libellé | Sens |
|---|---|---|
| 625100 | Frais de déplacement | Débit (HT) |
| 445660 | TVA déductible sur autres biens | Débit (TVA, si > 0) |
| 421000 | Rémunérations dues | Crédit (TTC) |

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
