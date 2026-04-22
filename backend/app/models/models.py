import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, JSON, Numeric, String, Text, Date
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..database import Base


class UserRole(str, PyEnum):
    USER = "user"
    MANAGER = "manager"
    ACCOUNTING = "accounting"
    ADMIN = "admin"


class ReportStatus(str, PyEnum):
    DRAFT = "draft"
    PENDING_MANAGER = "pending_manager"
    PENDING_ACCOUNTING = "pending_accounting"
    APPROVED = "approved"
    REJECTED = "rejected"


class ExpenseCategory(str, PyEnum):
    TRANSPORT = "Déplacement"
    RESTAURANT = "Restauration"
    POSTAGE = "Affranchissement"
    ACCOMMODATION = "Hébergement"
    OTHER = "Autre"


class OcrStatus(str, PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Team(Base):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    manager = relationship(
        "User",
        foreign_keys=[manager_id],
        primaryjoin="Team.manager_id == User.id",
    )
    members = relationship(
        "User",
        back_populates="team",
        primaryjoin="User.team_id == Team.id",
        foreign_keys="[User.team_id]",
    )


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.USER)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    manager = relationship("User", remote_side=[id], foreign_keys=[manager_id])
    team = relationship(
        "Team",
        back_populates="members",
        foreign_keys=[team_id],
        primaryjoin="User.team_id == Team.id",
    )
    expense_reports = relationship("ExpenseReport", back_populates="user", foreign_keys="ExpenseReport.user_id")
    notifications = relationship("Notification", back_populates="user")


class ExpenseReport(Base):
    __tablename__ = "expense_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    status = Column(Enum(ReportStatus), nullable=False, default=ReportStatus.DRAFT)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="expense_reports", foreign_keys=[user_id])
    items = relationship("ExpenseItem", back_populates="report", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="report", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=True)
    ocr_status = Column(Enum(OcrStatus), nullable=False, default=OcrStatus.PENDING)
    ocr_data = Column(JSON, nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploader = relationship("User")
    expense_item = relationship("ExpenseItem", back_populates="document", uselist=False)


class ExpenseItem(Base):
    __tablename__ = "expense_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("expense_reports.id"), nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    amount_ht = Column(Numeric(10, 2), nullable=True)
    amount_ttc = Column(Numeric(10, 2), nullable=True)
    amount_tva = Column(Numeric(10, 2), nullable=True)
    expense_date = Column(Date, nullable=True)
    category = Column(Enum(ExpenseCategory), nullable=True, default=ExpenseCategory.OTHER)
    description = Column(Text, nullable=True)
    vendor_name = Column(String(255), nullable=True)
    is_confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("ExpenseReport", back_populates="items")
    document = relationship("Document", back_populates="expense_item")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("expense_reports.id"), nullable=False)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    step = Column(String(50), nullable=False)  # "manager" or "accounting"
    status = Column(String(20), nullable=False)  # "approved" or "rejected"
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("ExpenseReport", back_populates="approvals")
    approver = relationship("User")


class PasswordHistory(Base):
    __tablename__ = "password_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)  # "info", "success", "warning", "error"
    report_id = Column(UUID(as_uuid=True), ForeignKey("expense_reports.id"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
