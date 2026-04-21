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
            demo_users = [
                ("manager@company.com", "manager", "Jean", "Martin", UserRole.MANAGER),
                ("compta@company.com", "compta", "Sophie", "Dupont", UserRole.ACCOUNTING),
                ("user1@company.com", "user1", "Paul", "Bernard", UserRole.USER),
                ("user2@company.com", "user2", "Marie", "Leroy", UserRole.USER),
            ]
            for email, pwd, fn, ln, role in demo_users:
                if not db.query(User).filter(User.email == email).first():
                    u = User(
                        email=email,
                        hashed_password=hash_password(pwd),
                        first_name=fn,
                        last_name=ln,
                        role=role,
                    )
                    db.add(u)
                    db.flush()

            db.commit()

            manager = db.query(User).filter(User.email == "manager@company.com").first()
            for email in ["user1@company.com", "user2@company.com"]:
                u = db.query(User).filter(User.email == email).first()
                if u and u.manager_id is None:
                    u.manager_id = manager.id

            # Équipe démo
            if not db.query(Team).filter(Team.name == "Commercial").first():
                team = Team(name="Commercial", manager_id=manager.id)
                db.add(team)
                db.flush()
                for email in ["user1@company.com", "user2@company.com"]:
                    u = db.query(User).filter(User.email == email).first()
                    if u:
                        u.team_id = team.id
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
