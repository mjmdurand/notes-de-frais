import csv
import io
import secrets
from typing import List

import redis as redis_lib
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.models import Team, User, UserRole
from ..routers.deps import get_current_user, require_admin
from ..schemas.schemas import UserCreate, UserOut, UserUpdate
from ..services.auth_service import hash_password
from ..services.email_service import send_password_reset, send_welcome

router = APIRouter(prefix="/api/users", tags=["users"])

WELCOME_TTL = 7 * 24 * 3600  # 7 jours
RESET_TTL = 3600              # 1 heure


def _redis():
    return redis_lib.Redis.from_url(settings.redis_url, decode_responses=True)


@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Accès refusé")
    return db.query(User).order_by(User.last_name).all()


@router.get("/managers", response_model=List[UserOut])
def list_managers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(User).filter(
        User.role.in_([UserRole.MANAGER, UserRole.ADMIN]),
        User.is_active == True,
    ).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if str(current_user.id) != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Accès refusé")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return user


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    team = db.query(Team).filter(Team.id == data.team_id).first()
    if not team:
        raise HTTPException(status_code=400, detail="Équipe introuvable")

    user = User(
        email=data.email,
        hashed_password=hash_password(secrets.token_urlsafe(32)),  # inutilisable jusqu'au premier set
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role,
        team_id=team.id,
        manager_id=team.manager_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = secrets.token_urlsafe(32)
    _redis().setex(f"ndf:reset:{token}", WELCOME_TTL, str(user.id))
    try:
        send_welcome(user.email, user.first_name, token)
    except Exception:
        pass

    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if str(current_user.id) != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if data.role is not None and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Seul l'admin peut changer le rôle")

    updated = data.model_dump(exclude_unset=True)

    if "email" in updated and updated["email"] != user.email:
        existing = db.query(User).filter(User.email == updated["email"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cette adresse email est déjà utilisée")

    for field, value in updated.items():
        setattr(user, field, value)

    # Sync manager when team changes
    if "team_id" in updated:
        if data.team_id:
            team = db.query(Team).filter(Team.id == data.team_id).first()
            user.manager_id = team.manager_id if team else None
        else:
            user.manager_id = None

    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/send-reset", status_code=status.HTTP_204_NO_CONTENT)
def send_user_reset(user_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    token = secrets.token_urlsafe(32)
    _redis().setex(f"ndf:reset:{token}", RESET_TTL, str(user.id))
    try:
        send_password_reset(user.email, user.first_name, token)
    except Exception:
        pass


_ROLE_MAP = {
    "user": UserRole.USER,
    "utilisateur": UserRole.USER,
    "manager": UserRole.MANAGER,
    "accounting": UserRole.ACCOUNTING,
    "comptabilite": UserRole.ACCOUNTING,
    "comptabilité": UserRole.ACCOUNTING,
    "compta": UserRole.ACCOUNTING,
    "admin": UserRole.ADMIN,
    "administrateur": UserRole.ADMIN,
}


@router.post("/import")
def import_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    content = file.file.read().decode("utf-8-sig")  # utf-8-sig strips Excel BOM
    reader = csv.DictReader(io.StringIO(content))

    created, skipped, errors = [], [], []
    r = _redis()

    for i, row in enumerate(reader, start=2):  # row 1 = header
        prenom = (row.get("prenom") or row.get("prénom") or "").strip()
        nom = (row.get("nom") or "").strip()
        email = (row.get("email") or "").strip().lower()
        role_raw = (row.get("role") or "user").strip().lower()
        equipe_name = (row.get("equipe") or row.get("équipe") or "").strip()

        if not prenom or not nom or not email:
            errors.append({"ligne": i, "raison": "Prénom, nom et email sont obligatoires", "email": email or "?"})
            continue

        if not equipe_name:
            errors.append({"ligne": i, "raison": "Équipe obligatoire", "email": email})
            continue

        role = _ROLE_MAP.get(role_raw)
        if role is None:
            errors.append({"ligne": i, "raison": f"Rôle inconnu : '{role_raw}'", "email": email})
            continue

        if db.query(User).filter(User.email == email).first():
            skipped.append({"ligne": i, "email": email, "raison": "Email déjà existant"})
            continue

        # Find or create team
        team = db.query(Team).filter(Team.name.ilike(equipe_name)).first()
        if not team:
            team = Team(name=equipe_name)
            db.add(team)
            db.flush()

        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            first_name=prenom,
            last_name=nom,
            role=role,
            team_id=team.id,
            manager_id=team.manager_id,
        )
        db.add(user)
        db.flush()

        token = secrets.token_urlsafe(32)
        r.setex(f"ndf:reset:{token}", WELCOME_TTL, str(user.id))
        try:
            send_welcome(email, prenom, token)
        except Exception:
            pass

        created.append({"ligne": i, "email": email, "nom": f"{prenom} {nom}"})

    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.is_active = False
    db.commit()
