from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.models import User, UserRole
from ..routers.deps import get_current_user, require_admin
from ..schemas.schemas import UserCreate, UserOut, UserUpdate
from ..services.auth_service import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


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
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role,
        manager_id=data.manager_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
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

    # Users can only update their own basic info; role changes require admin
    if str(current_user.id) != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if data.role is not None and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Seul l'admin peut changer le rôle")

    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "password" and value:
            user.hashed_password = hash_password(value)
        else:
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.is_active = False
    db.commit()
