export type UserRole = 'user' | 'manager' | 'accounting' | 'admin'
export type ReportStatus = 'draft' | 'pending_manager' | 'pending_accounting' | 'approved' | 'rejected'
export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ExpenseCategory = 'Déplacement' | 'Restauration' | 'Affranchissement' | 'Hébergement' | 'Autre'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  manager_id: string | null
  is_active: boolean
  created_at: string
}

export interface Document {
  id: string
  original_filename: string
  mime_type: string
  file_size: number | null
  ocr_status: OcrStatus
  ocr_data: Record<string, unknown> | null
  created_at: string
}

export interface ExpenseItem {
  id: string
  document_id: string
  amount_ht: string | null
  amount_ttc: string | null
  amount_tva: string | null
  expense_date: string | null
  category: ExpenseCategory | null
  description: string | null
  vendor_name: string | null
  is_confirmed: boolean
  document: Document | null
}

export interface Approval {
  id: string
  step: string
  status: string
  reason: string | null
  created_at: string
  approver: { id: string; first_name: string; last_name: string; email: string }
}

export interface ExpenseReport {
  id: string
  title: string
  status: ReportStatus
  rejection_reason: string | null
  created_at: string
  submitted_at: string | null
  updated_at: string
  user: { id: string; first_name: string; last_name: string; email: string }
  items: ExpenseItem[]
  approvals: Approval[]
  total_ttc: string | null
}

export interface UserShort {
  id: string
  first_name: string
  last_name: string
  email: string
}

export interface ExpenseReportList {
  id: string
  title: string
  status: ReportStatus
  created_at: string
  submitted_at: string | null
  user: UserShort
  total_ttc: string | null
  item_count: number
}

export interface ExpenseReportListAll extends ExpenseReportList {
  manager: UserShort | null
  total_ht: string | null
  total_tva: string | null
}

export interface Notification {
  id: string
  title: string
  message: string
  type: string
  report_id: string | null
  is_read: boolean
  created_at: string
}

export const CATEGORIES: ExpenseCategory[] = [
  'Déplacement',
  'Restauration',
  'Affranchissement',
  'Hébergement',
  'Autre',
]

export const STATUS_LABELS: Record<ReportStatus, string> = {
  draft: 'Brouillon',
  pending_manager: 'En attente manager',
  pending_accounting: 'En attente comptabilité',
  approved: 'Approuvée',
  rejected: 'Refusée',
}

export const STATUS_COLORS: Record<ReportStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_manager: 'bg-yellow-100 text-yellow-800',
  pending_accounting: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}
