from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr

from ..models.models import ExpenseCategory, OcrStatus, ReportStatus, UserRole


# --- Auth ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# --- User ---
class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole = UserRole.USER
    manager_id: Optional[UUID] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None
    manager_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserShort(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True


# --- Document ---
class DocumentOut(BaseModel):
    id: UUID
    original_filename: str
    mime_type: str
    file_size: Optional[int]
    ocr_status: OcrStatus
    ocr_data: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Expense Item ---
class ExpenseItemUpdate(BaseModel):
    amount_ht: Optional[Decimal] = None
    amount_ttc: Optional[Decimal] = None
    amount_tva: Optional[Decimal] = None
    expense_date: Optional[date] = None
    category: Optional[ExpenseCategory] = None
    description: Optional[str] = None
    vendor_name: Optional[str] = None
    is_confirmed: Optional[bool] = None


class ExpenseItemOut(BaseModel):
    id: UUID
    document_id: UUID
    amount_ht: Optional[Decimal]
    amount_ttc: Optional[Decimal]
    amount_tva: Optional[Decimal]
    expense_date: Optional[date]
    category: Optional[ExpenseCategory]
    description: Optional[str]
    vendor_name: Optional[str]
    is_confirmed: bool
    document: Optional[DocumentOut]

    class Config:
        from_attributes = True


# --- Approval ---
class ApprovalCreate(BaseModel):
    status: str  # "approved" or "rejected"
    reason: Optional[str] = None


class ApprovalOut(BaseModel):
    id: UUID
    step: str
    status: str
    reason: Optional[str]
    created_at: datetime
    approver: UserShort

    class Config:
        from_attributes = True


# --- Expense Report ---
class ExpenseReportCreate(BaseModel):
    title: str
    document_ids: List[UUID]


class ExpenseReportOut(BaseModel):
    id: UUID
    title: str
    status: ReportStatus
    rejection_reason: Optional[str]
    created_at: datetime
    submitted_at: Optional[datetime]
    updated_at: datetime
    user: UserShort
    items: List[ExpenseItemOut] = []
    approvals: List[ApprovalOut] = []
    total_ttc: Optional[Decimal] = None

    class Config:
        from_attributes = True


class ExpenseReportList(BaseModel):
    id: UUID
    title: str
    status: ReportStatus
    created_at: datetime
    submitted_at: Optional[datetime]
    user: UserShort
    total_ttc: Optional[Decimal] = None
    item_count: int = 0

    class Config:
        from_attributes = True


class ExpenseReportListAll(BaseModel):
    id: UUID
    title: str
    status: ReportStatus
    created_at: datetime
    submitted_at: Optional[datetime]
    user: UserShort
    manager: Optional[UserShort] = None
    total_ht: Optional[Decimal] = None
    total_tva: Optional[Decimal] = None
    total_ttc: Optional[Decimal] = None
    item_count: int = 0

    class Config:
        from_attributes = True


# --- Notification ---
class NotificationOut(BaseModel):
    id: UUID
    title: str
    message: str
    type: str
    report_id: Optional[UUID]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
