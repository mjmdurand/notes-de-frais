from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from datetime import datetime

from ..database import get_db
from ..models.models import (
    Approval, Document, ExpenseItem, ExpenseReport, Notification,
    ReportStatus, User, UserRole
)
from ..routers.deps import get_current_user
from ..schemas.schemas import (
    ApprovalCreate, ApprovalOut, ExpenseItemOut, ExpenseItemUpdate,
    ExpenseReportCreate, ExpenseReportOut, ExpenseReportList, ExpenseReportListAll
)
from ..services import email_service

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


def _calc_total(report: ExpenseReport):
    total = sum((item.amount_ttc or Decimal("0")) for item in report.items)
    return total if total > 0 else None


def _calc_totals_all(report: ExpenseReport):
    ht = sum((item.amount_ht or Decimal("0")) for item in report.items)
    tva = sum((item.amount_tva or Decimal("0")) for item in report.items)
    ttc = sum((item.amount_ttc or Decimal("0")) for item in report.items)
    report.total_ht = ht if ht > 0 else None
    report.total_tva = tva if tva > 0 else None
    report.total_ttc = ttc if ttc > 0 else None


@router.get("", response_model=List[ExpenseReportList])
def list_expenses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        reports = db.query(ExpenseReport).order_by(ExpenseReport.created_at.desc()).all()
    else:
        reports = (
            db.query(ExpenseReport)
            .filter(ExpenseReport.user_id == current_user.id)
            .order_by(ExpenseReport.created_at.desc())
            .all()
        )

    result = []
    for r in reports:
        r.total_ttc = _calc_total(r)
        r.item_count = len(r.items)
        result.append(r)
    return result


@router.get("/pending-manager", response_model=List[ExpenseReportList])
def list_pending_manager(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in (UserRole.MANAGER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès refusé")

    if current_user.role == UserRole.ADMIN:
        reports = (
            db.query(ExpenseReport)
            .filter(ExpenseReport.status == ReportStatus.PENDING_MANAGER)
            .order_by(ExpenseReport.submitted_at.desc())
            .all()
        )
    else:
        reports = (
            db.query(ExpenseReport)
            .join(User, ExpenseReport.user_id == User.id)
            .filter(
                ExpenseReport.status == ReportStatus.PENDING_MANAGER,
                User.manager_id == current_user.id,
            )
            .order_by(ExpenseReport.submitted_at.desc())
            .all()
        )

    for r in reports:
        r.total_ttc = _calc_total(r)
        r.item_count = len(r.items)
    return reports


@router.get("/pending-accounting", response_model=List[ExpenseReportList])
def list_pending_accounting(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in (UserRole.ACCOUNTING, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès refusé")

    reports = (
        db.query(ExpenseReport)
        .filter(ExpenseReport.status == ReportStatus.PENDING_ACCOUNTING)
        .order_by(ExpenseReport.submitted_at.desc())
        .all()
    )
    for r in reports:
        r.total_ttc = _calc_total(r)
        r.item_count = len(r.items)
    return reports


@router.get("/all", response_model=List[ExpenseReportListAll])
def list_all_expenses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in (UserRole.ACCOUNTING, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Accès refusé")
    reports = (
        db.query(ExpenseReport)
        .options(joinedload(ExpenseReport.user).joinedload(User.manager))
        .order_by(ExpenseReport.created_at.desc())
        .all()
    )
    for r in reports:
        _calc_totals_all(r)
        r.item_count = len(r.items)
        r.manager = r.user.manager if r.user else None
    return reports


@router.post("", response_model=ExpenseReportOut, status_code=status.HTTP_201_CREATED)
def create_expense_report(
    data: ExpenseReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = db.query(Document).filter(Document.id.in_(data.document_ids)).all()
    if len(docs) != len(data.document_ids):
        raise HTTPException(status_code=400, detail="Un ou plusieurs documents introuvables")

    report = ExpenseReport(user_id=current_user.id, title=data.title)
    db.add(report)
    db.flush()

    for doc in docs:
        existing = db.query(ExpenseItem).filter(ExpenseItem.document_id == doc.id).first()
        if not existing:
            item = ExpenseItem(report_id=report.id, document_id=doc.id)
            db.add(item)

    db.commit()
    db.refresh(report)
    report.total_ttc = _calc_total(report)
    return report


@router.get("/{report_id}", response_model=ExpenseReportOut)
def get_expense_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = db.query(ExpenseReport).filter(ExpenseReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Note de frais introuvable")

    if current_user.role == UserRole.USER and report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    report.total_ttc = _calc_total(report)
    return report


@router.put("/items/{item_id}", response_model=ExpenseItemOut)
def update_expense_item(
    item_id: str,
    data: ExpenseItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ExpenseItem).filter(ExpenseItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ligne introuvable")

    report = db.query(ExpenseReport).filter(ExpenseReport.id == item.report_id).first()
    if report.status == ReportStatus.DRAFT:
        if report.user_id != current_user.id and current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Accès refusé")
    elif report.status == ReportStatus.PENDING_ACCOUNTING:
        if current_user.role not in (UserRole.ACCOUNTING, UserRole.ADMIN):
            raise HTTPException(status_code=403, detail="Accès refusé")
    else:
        raise HTTPException(status_code=400, detail="Impossible de modifier cette note dans son état actuel")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.post("/{report_id}/submit", response_model=ExpenseReportOut)
def submit_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = db.query(ExpenseReport).filter(ExpenseReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Note de frais introuvable")
    if report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if report.status != ReportStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Note déjà soumise")
    if not report.items:
        raise HTTPException(status_code=400, detail="La note de frais ne contient aucune ligne")
    if not all(item.is_confirmed for item in report.items):
        raise HTTPException(status_code=400, detail="Toutes les lignes doivent être confirmées avant soumission")
    if not all(item.expense_date for item in report.items):
        raise HTTPException(status_code=400, detail="Toutes les lignes doivent avoir une date de dépense")

    report.status = ReportStatus.PENDING_MANAGER
    report.submitted_at = datetime.utcnow()
    db.commit()

    manager = db.query(User).filter(User.id == current_user.manager_id).first()
    if manager:
        notif = Notification(
            user_id=manager.id,
            title="Note de frais en attente",
            message=f"{current_user.first_name} {current_user.last_name} a soumis une note de frais : {report.title}",
            type="info",
            report_id=report.id,
        )
        db.add(notif)
        db.commit()
        try:
            email_service.send_report_submitted(
                manager.email, manager.first_name,
                f"{current_user.first_name} {current_user.last_name}",
                report.title, str(report.id),
            )
        except Exception:
            pass

    db.refresh(report)
    report.total_ttc = _calc_total(report)
    return report


@router.post("/{report_id}/approve", response_model=ExpenseReportOut)
def approve_report(
    report_id: str,
    data: ApprovalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(ExpenseReport).filter(ExpenseReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Note de frais introuvable")

    user = db.query(User).filter(User.id == report.user_id).first()

    if current_user.role in (UserRole.MANAGER, UserRole.ADMIN) and report.status == ReportStatus.PENDING_MANAGER:
        step = "manager"
        new_status = ReportStatus.PENDING_ACCOUNTING if data.status == "approved" else ReportStatus.REJECTED
    elif current_user.role in (UserRole.ACCOUNTING, UserRole.ADMIN) and report.status == ReportStatus.PENDING_ACCOUNTING:
        step = "accounting"
        new_status = ReportStatus.APPROVED if data.status == "approved" else ReportStatus.REJECTED
    else:
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas valider cette note")

    approval = Approval(
        report_id=report.id,
        approver_id=current_user.id,
        step=step,
        status=data.status,
        reason=data.reason,
    )
    db.add(approval)
    report.status = new_status
    if data.status == "rejected":
        report.rejection_reason = data.reason

    # Notify and email
    if step == "manager" and data.status == "approved":
        accountants = db.query(User).filter(User.role == UserRole.ACCOUNTING, User.is_active == True).all()
        for acc in accountants:
            notif = Notification(
                user_id=acc.id,
                title="Note de frais à valider",
                message=f"La note de frais '{report.title}' de {user.first_name} {user.last_name} est en attente de validation comptable.",
                type="info",
                report_id=report.id,
            )
            db.add(notif)
        try:
            email_service.send_report_approved_by_manager(
                [a.email for a in accountants],
                f"{user.first_name} {user.last_name}",
                report.title, str(report.id),
            )
        except Exception:
            pass

    elif step == "accounting" and data.status == "approved":
        notif = Notification(
            user_id=user.id,
            title="Note de frais acceptée",
            message=f"Votre note de frais '{report.title}' a été acceptée. Un remboursement va bientôt être effectué.",
            type="success",
            report_id=report.id,
        )
        db.add(notif)
        try:
            email_service.send_report_approved_final(user.email, user.first_name, report.title)
        except Exception:
            pass

    elif data.status == "rejected":
        notif = Notification(
            user_id=user.id,
            title="Note de frais refusée",
            message=f"Votre note de frais '{report.title}' a été refusée par {'le manager' if step == 'manager' else 'la comptabilité'}."
                    + (f" Motif : {data.reason}" if data.reason else ""),
            type="error",
            report_id=report.id,
        )
        db.add(notif)
        try:
            email_service.send_report_rejected(
                user.email, user.first_name, report.title, step, data.reason
            )
        except Exception:
            pass

    db.commit()
    db.refresh(report)
    report.total_ttc = _calc_total(report)
    return report


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = db.query(ExpenseReport).filter(ExpenseReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Note de frais introuvable")
    if report.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Accès refusé")
    if report.status != ReportStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Seules les notes en brouillon peuvent être supprimées")
    db.delete(report)
    db.commit()
