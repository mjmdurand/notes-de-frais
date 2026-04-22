import re
from datetime import datetime, timedelta
from typing import List, Optional

import bcrypt
from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import settings
from ..models.models import PasswordHistory, User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except JWTError:
        return None


def validate_password_strength(password: str) -> None:
    errors: List[str] = []
    if len(password) < 8:
        errors.append("au moins 8 caractères")
    if not re.search(r'[A-Z]', password):
        errors.append("une majuscule")
    if not re.search(r'[a-z]', password):
        errors.append("une minuscule")
    if not re.search(r'\d', password):
        errors.append("un chiffre")
    if not re.search(r'[^a-zA-Z0-9]', password):
        errors.append("un caractère spécial")
    if errors:
        raise HTTPException(status_code=400, detail=f"Mot de passe trop faible — requis : {', '.join(errors)}")


def is_password_reused(db: Session, user_id: str, new_password: str, limit: int = 5) -> bool:
    history = (
        db.query(PasswordHistory)
        .filter(PasswordHistory.user_id == user_id)
        .order_by(PasswordHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return any(verify_password(new_password, h.hashed_password) for h in history)


def push_password_history(db: Session, user_id: str, hashed_password: str, limit: int = 5) -> None:
    db.add(PasswordHistory(user_id=user_id, hashed_password=hashed_password))
    # Prune oldest entries beyond limit
    old = (
        db.query(PasswordHistory)
        .filter(PasswordHistory.user_id == user_id)
        .order_by(PasswordHistory.created_at.desc())
        .offset(limit)
        .all()
    )
    for entry in old:
        db.delete(entry)


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user
