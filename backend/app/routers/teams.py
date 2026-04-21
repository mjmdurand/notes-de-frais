from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.models import Team, User
from ..routers.deps import require_admin
from ..schemas.schemas import TeamCreate, TeamOut, TeamUpdate

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("", response_model=List[TeamOut])
def list_teams(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(Team).order_by(Team.name).all()


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(data: TeamCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(Team).filter(Team.name == data.name).first():
        raise HTTPException(status_code=400, detail="Une équipe avec ce nom existe déjà")
    team = Team(name=data.name, manager_id=data.manager_id)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.put("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: str,
    data: TeamUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Équipe introuvable")
    if data.name is not None and data.name != team.name:
        if db.query(Team).filter(Team.name == data.name).first():
            raise HTTPException(status_code=400, detail="Une équipe avec ce nom existe déjà")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(team, field, value)
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(team_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Équipe introuvable")
    # Unlink members before deleting
    db.query(User).filter(User.team_id == team.id).update({"team_id": None})
    db.delete(team)
    db.commit()
