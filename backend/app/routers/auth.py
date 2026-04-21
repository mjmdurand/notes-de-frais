import secrets

import redis as redis_lib
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.models import User
from ..routers.deps import get_current_user
from ..schemas.schemas import LoginRequest, Token, UserOut
from ..services.auth_service import authenticate_user, create_access_token, hash_password
from ..services.email_service import send_password_reset

router = APIRouter(prefix="/api/auth", tags=["auth"])

RESET_TTL = 3600  # 1 heure


def _redis():
    return redis_lib.Redis.from_url(settings.redis_url, decode_responses=True)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.get("/demo-info")
def demo_info():
    if not settings.demo_accounts:
        return {"enabled": False, "accounts": []}
    return {
        "enabled": True,
        "accounts": [
            {"role": "Admin",        "email": settings.admin_email,    "password": settings.admin_password},
            {"role": "Manager",      "email": "manager@company.com",   "password": "manager"},
            {"role": "Comptabilité", "email": "compta@company.com",    "password": "compta"},
            {"role": "Utilisateur",  "email": "user1@company.com",     "password": "user1"},
        ],
    }


@router.post("/login", response_model=Token)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe incorrect")
    return Token(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user)):
    return user


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email, User.is_active == True).first()
    if user:
        token = secrets.token_urlsafe(32)
        r = _redis()
        r.setex(f"ndf:reset:{token}", RESET_TTL, str(user.id))
        try:
            send_password_reset(user.email, user.first_name, token)
        except Exception:
            pass
    # Always return same response to avoid user enumeration
    return {"message": "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    r = _redis()
    user_id = r.get(f"ndf:reset:{data.token}")
    if not user_id:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Utilisateur introuvable")
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    r.delete(f"ndf:reset:{data.token}")
    return {"message": "Mot de passe réinitialisé avec succès"}
