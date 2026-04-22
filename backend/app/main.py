from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine, SessionLocal
from .models import models  # noqa: ensures all models are registered
from .routers import auth, users, expenses, documents, notifications, teams
from .services.auth_service import hash_password
from .services.storage_service import ensure_bucket_exists


def create_initial_data():
    db = SessionLocal()
    try:
        from .models.models import User, UserRole

        if not db.query(User).filter(User.email == settings.admin_email).first():
            admin = User(
                email=settings.admin_email,
                hashed_password=hash_password(settings.admin_password),
                first_name=settings.admin_first_name,
                last_name=settings.admin_last_name,
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.commit()
            print(f"Admin account created: {settings.admin_email}")

        if settings.demo_accounts:
            from .models.models import Team

            # Utilisateurs de base (login page)
            base_users = [
                ("manager@company.com",  "manager", "Jean",    "Martin", UserRole.MANAGER),
                ("compta@company.com",   "compta",  "Sophie",  "Dupont", UserRole.ACCOUNTING),
                ("user1@company.com",    "user1",   "Paul",    "Bernard", UserRole.USER),
                ("user2@company.com",    "user2",   "Marie",   "Leroy",  UserRole.USER),
            ]
            # Comptes supplémentaires pour les équipes démo
            extra_users = [
                ("manager.direction@company.com", "dir1",   "Philippe", "Renard",   UserRole.MANAGER),
                ("user.direction@company.com",    "dir2",   "Christine","Faure",    UserRole.USER),
                ("manager.info@company.com",      "info1",  "Marc",     "Laurent",  UserRole.MANAGER),
                ("manager.compta@company.com",    "cpta1",  "Isabelle", "Moreau",   UserRole.MANAGER),
                ("user.compta@company.com",       "cpta2",  "Thomas",   "Girard",   UserRole.USER),
                ("manager.recouv@company.com",    "recv1",  "Nathalie", "Blanc",    UserRole.MANAGER),
                ("user.recouv@company.com",       "recv2",  "Antoine",  "Rousseau", UserRole.USER),
            ]
            for email, pwd, fn, ln, role in base_users + extra_users:
                if not db.query(User).filter(User.email == email).first():
                    db.add(User(
                        email=email,
                        hashed_password=hash_password(pwd),
                        first_name=fn,
                        last_name=ln,
                        role=role,
                    ))
            db.flush()

            def _u(email):
                return db.query(User).filter(User.email == email).first()

            # 5 équipes démo avec leur manager et leurs membres
            teams_def = [
                ("Direction",    "manager.direction@company.com", ["user.direction@company.com"]),
                ("Commerciaux",  "manager@company.com",           ["user1@company.com"]),
                ("Informatique", "manager.info@company.com",      ["user2@company.com"]),
                # Équipe Comptabilité : rôle USER/MANAGER dans l'équipe ; le rôle ACCOUNTING
                # (validation des notes) est indépendant et porté par compta@company.com
                ("Comptabilité", "manager.compta@company.com",    ["user.compta@company.com", "compta@company.com"]),
                ("Recouvrement", "manager.recouv@company.com",    ["user.recouv@company.com"]),
            ]
            for team_name, mgr_email, member_emails in teams_def:
                if db.query(Team).filter(Team.name == team_name).first():
                    continue
                mgr = _u(mgr_email)
                team = Team(name=team_name, manager_id=mgr.id if mgr else None)
                db.add(team)
                db.flush()
                for email in member_emails:
                    u = _u(email)
                    if u:
                        u.team_id = team.id
                        u.manager_id = team.manager_id
                if mgr:
                    mgr.team_id = team.id

            db.commit()

    finally:
        db.close()


app = FastAPI(title="Notes de Frais API", version="1.0.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
app.include_router(expenses.router)
app.include_router(documents.router)
app.include_router(notifications.router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    try:
        ensure_bucket_exists()
    except Exception as e:
        print(f"MinIO bucket init failed: {e}")
    create_initial_data()


@app.get("/api/health")
def health():
    return {"status": "ok"}
