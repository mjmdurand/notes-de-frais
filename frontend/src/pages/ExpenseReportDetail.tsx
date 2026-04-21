import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, ExternalLink, Pencil, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import EditExpenseModal from '../components/EditExpenseModal'
import { documentsApi, expensesApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { ExpenseItem, ReportStatus } from '../types'

export default function ExpenseReportDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null)

  const { data: report, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expensesApi.get(id!).then((r) => r.data),
    enabled: !!id,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expense', id] })
    qc.invalidateQueries({ queryKey: ['expenses'] })
  }

  const handleApprove = async () => {
    setProcessing(true)
    try {
      await expensesApi.approve(id!, { status: 'approved' })
      toast.success('Note de frais approuvée')
      invalidate()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Erreur')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    setProcessing(true)
    try {
      await expensesApi.approve(id!, { status: 'rejected', reason: rejectReason || undefined })
      toast.success('Note de frais refusée')
      setShowRejectForm(false)
      invalidate()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Erreur')
    } finally {
      setProcessing(false)
    }
  }

  const openDoc = async (docId: string) => {
    try {
      const { data } = await documentsApi.getUrl(docId)
      window.open(data.url, '_blank')
    } catch {
      toast.error('Impossible d\'ouvrir le document')
    }
  }

  const canApprove =
    (user?.role === 'manager' || user?.role === 'admin') && report?.status === 'pending_manager' ||
    (user?.role === 'accounting' || user?.role === 'admin') && report?.status === 'pending_accounting'

  const canEditItems =
    (user?.role === 'accounting' || user?.role === 'admin') && report?.status === 'pending_accounting'

  const handleSaveItem = async (data: Partial<ExpenseItem>) => {
    if (!editingItem) return
    try {
      await expensesApi.updateItem(editingItem.id, data)
      toast.success('Ligne mise à jour')
      setEditingItem(null)
      invalidate()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Erreur lors de la mise à jour')
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    )
  }

  if (!report) return <Layout><p>Note introuvable</p></Layout>

  const total = report.items.reduce((s, i) => s + (i.amount_ttc ? parseFloat(i.amount_ttc) : 0), 0)

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-sm">
            ← Retour
          </button>
        </div>

        {/* Header */}
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">{report.title}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Par {report.user.first_name} {report.user.last_name} •{' '}
                {new Date(report.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <StatusBadge status={report.status as ReportStatus} />
          </div>

          {report.rejection_reason && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Motif de refus :</strong> {report.rejection_reason}
            </div>
          )}

          <div className="mt-4 flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total TTC</span>
              <p className="text-lg font-bold text-gray-900">{total.toFixed(2)} €</p>
            </div>
            {report.submitted_at && (
              <div>
                <span className="text-gray-500">Soumise le</span>
                <p className="font-medium">{new Date(report.submitted_at).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Dépenses ({report.items.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Justificatif</th>
                  <th className="px-4 py-3 text-left">Prestataire</th>
                  <th className="px-4 py-3 text-right">HT</th>
                  <th className="px-4 py-3 text-right">TVA</th>
                  <th className="px-4 py-3 text-right">TTC</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Catégorie</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">
                      {item.document?.original_filename ?? '—'}
                    </td>
                    <td className="px-4 py-3">{item.vendor_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{item.amount_ht ? `${parseFloat(item.amount_ht).toFixed(2)} €` : '—'}</td>
                    <td className="px-4 py-3 text-right">{item.amount_tva ? `${parseFloat(item.amount_tva).toFixed(2)} €` : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.amount_ttc ? `${parseFloat(item.amount_ttc).toFixed(2)} €` : '—'}</td>
                    <td className="px-4 py-3">
                      {item.expense_date ? new Date(item.expense_date).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{item.category ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canEditItems && (
                          <button
                            onClick={() => setEditingItem(item)}
                            className="text-gray-400 hover:text-blue-600"
                            title="Corriger les montants"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {item.document_id && (
                          <button
                            onClick={() => openDoc(item.document_id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Voir le justificatif"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right">Total TTC</td>
                  <td className="px-4 py-3 text-right text-blue-700">{total.toFixed(2)} €</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Approvals history */}
        {report.approvals.length > 0 && (
          <div className="card">
            <h2 className="font-semibold mb-4">Historique des validations</h2>
            <div className="space-y-3">
              {report.approvals.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  {a.status === 'approved' ? (
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {a.status === 'approved' ? 'Approuvée' : 'Refusée'} par{' '}
                      {a.approver.first_name} {a.approver.last_name}{' '}
                      <span className="text-gray-500 font-normal">
                        ({a.step === 'manager' ? 'Manager' : 'Comptabilité'})
                      </span>
                    </p>
                    {a.reason && <p className="text-sm text-gray-500 mt-0.5">Motif : {a.reason}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {editingItem && (
          <EditExpenseModal
            item={editingItem}
            onSave={handleSaveItem}
            onClose={() => setEditingItem(null)}
          />
        )}

        {/* Approve/Reject actions */}
        {canApprove && (
          <div className="card">
            <h2 className="font-semibold mb-4">Action requise</h2>
            {!showRejectForm ? (
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="btn-primary flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approuver
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="btn-danger flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Refuser
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Motif du refus (optionnel)</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Indiquez un motif..."
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowRejectForm(false)} className="btn-secondary">
                    Annuler
                  </button>
                  <button onClick={handleReject} disabled={processing} className="btn-danger">
                    Confirmer le refus
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
