import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, FileText, Trash2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import { expensesApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { ReportStatus } from '../types'

const DAYS = 30

function cutoffDate() {
  const d = new Date()
  d.setDate(d.getDate() - DAYS)
  return d
}

export default function Dashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.list().then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => expensesApi.delete(id))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setSelected(new Set())
      toast.success(`${ids.length} brouillon${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}`)
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  const cutoff = cutoffDate()
  const recentReports = reports.filter((r) => new Date(r.created_at) >= cutoff)
  const hiddenCount = reports.length - recentReports.length
  const visibleReports = showAll ? reports : recentReports

  const draftIds = new Set(visibleReports.filter((r) => r.status === 'draft').map((r) => r.id))
  const selectedDrafts = [...selected].filter((id) => draftIds.has(id))

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedDrafts.length === draftIds.size) {
      setSelected(new Set())
    } else {
      setSelected(new Set(draftIds))
    }
  }

  const handleDeleteSelected = () => {
    if (selectedDrafts.length === 0) return
    const msg =
      selectedDrafts.length === 1
        ? 'Supprimer ce brouillon ?'
        : `Supprimer ces ${selectedDrafts.length} brouillons ?`
    if (!window.confirm(msg)) return
    deleteMutation.mutate(selectedDrafts)
  }

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending_manager' || r.status === 'pending_accounting').length,
    approved: reports.filter((r) => r.status === 'approved').length,
    totalAmount: reports
      .filter((r) => r.status === 'approved')
      .reduce((s, r) => s + (r.total_ttc ? parseFloat(r.total_ttc) : 0), 0),
  }

  const allDraftsSelected = draftIds.size > 0 && selectedDrafts.length === draftIds.size

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bonjour, {user?.first_name}
            </h1>
            <p className="text-gray-500 mt-1">Gérez vos notes de frais</p>
          </div>
          <Link to="/expenses/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Créer une note de frais
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'En cours', value: stats.pending, color: 'text-yellow-600' },
            { label: 'Approuvées', value: stats.approved, color: 'text-green-600' },
            { label: 'Montant remboursé', value: `${stats.totalAmount.toFixed(2)} €`, color: 'text-blue-600' },
          ].map((s) => (
            <div key={s.label} className="card">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">Mes notes de frais</h2>
              {!showAll && (
                <span className="text-xs text-gray-400">30 derniers jours</span>
              )}
            </div>
            {selectedDrafts.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer {selectedDrafts.length > 1 ? `(${selectedDrafts.length})` : ''}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucune note de frais pour l'instant</p>
              <Link to="/expenses/new" className="btn-primary inline-flex items-center gap-2 mt-4">
                <Plus className="w-4 h-4" />
                Créer ma première note
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        {draftIds.size > 0 && (
                          <input
                            type="checkbox"
                            checked={allDraftsSelected}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300"
                            title="Sélectionner tous les brouillons"
                          />
                        )}
                      </th>
                      <th className="px-4 py-3 text-left">Titre</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Montant TTC</th>
                      <th className="px-4 py-3 text-center">Pièces</th>
                      <th className="px-4 py-3 text-left">Statut</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleReports.map((r) => {
                      const isDraft = r.status === 'draft'
                      const isSelected = selected.has(r.id)
                      return (
                        <tr key={r.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3">
                            {isDraft && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(r.id)}
                                className="rounded border-gray-300"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(r.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {r.total_ttc ? `${parseFloat(r.total_ttc).toFixed(2)} €` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-500">{r.item_count}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={r.status as ReportStatus} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/expenses/${r.id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Voir
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!showAll && hiddenCount > 0 && (
                <div className="p-3 border-t bg-gray-50 text-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <ChevronDown className="w-4 h-4" />
                    Afficher les {hiddenCount} entrée{hiddenCount > 1 ? 's' : ''} plus anciennes
                  </button>
                </div>
              )}
              {showAll && hiddenCount > 0 && (
                <div className="p-3 border-t bg-gray-50 text-center">
                  <button
                    onClick={() => { setShowAll(false); setSelected(new Set()) }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Réduire (30 derniers jours)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
