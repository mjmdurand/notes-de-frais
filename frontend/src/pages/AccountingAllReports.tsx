import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Download, RotateCcw, Search } from 'lucide-react'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import { expensesApi } from '../services/api'
import type { ExpenseReportListAll, ReportStatus } from '../types'
import { STATUS_LABELS } from '../types'

const STATUSES: { label: string; value: ReportStatus | '' }[] = [
  { label: 'Tous les statuts', value: '' },
  { label: 'Brouillon', value: 'draft' },
  { label: 'En attente manager', value: 'pending_manager' },
  { label: 'En attente comptabilité', value: 'pending_accounting' },
  { label: 'Approuvée', value: 'approved' },
  { label: 'Refusée', value: 'rejected' },
]

function fullName(u: { first_name: string; last_name: string }) {
  return `${u.first_name} ${u.last_name}`
}

function exportCsv(reports: ExpenseReportListAll[]) {
  const headers = [
    'Salarié', 'Équipe (Manager)', 'Titre', 'Créée le', 'Soumise le', 'Statut',
    'Montant HT (€)', 'TVA (€)', 'Montant TTC (€)',
  ]
  const rows = reports.map((r) => [
    fullName(r.user),
    r.manager ? fullName(r.manager) : '—',
    r.title,
    new Date(r.created_at).toLocaleDateString('fr-FR'),
    r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR') : '—',
    STATUS_LABELS[r.status],
    r.total_ht ? parseFloat(r.total_ht).toFixed(2) : '0.00',
    r.total_tva ? parseFloat(r.total_tva).toFixed(2) : '0.00',
    r.total_ttc ? parseFloat(r.total_ttc).toFixed(2) : '0.00',
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `notes-de-frais-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AccountingAllReports() {
  const defaultDateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState('')
  const [managerId, setManagerId] = useState('')
  const [userId, setUserId] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('approved')

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: () => expensesApi.listAll().then((r) => r.data),
  })

  // Unique managers and employees derived from data
  const managers = useMemo(() => {
    const map = new Map<string, { id: string; first_name: string; last_name: string }>()
    for (const r of reports) {
      if (r.manager) map.set(r.manager.id, r.manager)
    }
    return [...map.values()].sort((a, b) => fullName(a).localeCompare(fullName(b)))
  }, [reports])

  const employees = useMemo(() => {
    const map = new Map<string, { id: string; first_name: string; last_name: string }>()
    for (const r of reports) {
      map.set(r.user.id, r.user)
    }
    return [...map.values()].sort((a, b) => fullName(a).localeCompare(fullName(b)))
  }, [reports])

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59)
        if (new Date(r.created_at) > to) return false
      }
      if (managerId && r.manager?.id !== managerId) return false
      if (userId && r.user.id !== userId) return false
      if (statusFilter && r.status !== statusFilter) return false
      return true
    })
  }, [reports, dateFrom, dateTo, managerId, userId, statusFilter])

  const stats = useMemo(() => {
    const total = filtered.length
    const totalAmount = filtered.reduce((s, r) => s + (r.total_ttc ? parseFloat(r.total_ttc) : 0), 0)
    const approved = filtered.filter((r) => r.status === 'approved')
    const approvedAmount = approved.reduce((s, r) => s + (r.total_ttc ? parseFloat(r.total_ttc) : 0), 0)
    const pending = filtered.filter(
      (r) => r.status === 'pending_manager' || r.status === 'pending_accounting',
    ).length
    return { total, totalAmount, approvedCount: approved.length, approvedAmount, pending }
  }, [filtered])

  const hasFilters = dateFrom !== defaultDateFrom || dateTo || managerId || userId || statusFilter !== 'approved'
  const resetFilters = () => {
    setDateFrom(defaultDateFrom)
    setDateTo('')
    setManagerId('')
    setUserId('')
    setStatusFilter('approved')
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vue d'ensemble — Notes de frais</h1>
            <p className="text-gray-500 mt-1">Toutes les notes de frais, tous statuts confondus</p>
          </div>
          <button
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Exporter CSV ({filtered.length})
          </button>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label">Du</label>
              <input className="input w-36" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Au</label>
              <input className="input w-36" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="label">Équipe / Manager</label>
              <select className="input w-48" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                <option value="">Tous</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{fullName(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Salarié</label>
              <select className="input w-48" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Tous</option>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>{fullName(u)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select
                className="input w-52"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500">Notes trouvées</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Montant total</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalAmount.toFixed(2)} €</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Approuvées</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.approvedCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stats.approvedAmount.toFixed(2)} €</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">En attente</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucune note de frais ne correspond aux critères</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Salarié</th>
                    <th className="px-4 py-3 text-left">Équipe</th>
                    <th className="px-4 py-3 text-left">Titre</th>
                    <th className="px-4 py-3 text-left">Créée le</th>
                    <th className="px-4 py-3 text-left">Soumise le</th>
                    <th className="px-4 py-3 text-left">Statut</th>
                    <th className="px-4 py-3 text-right">HT</th>
                    <th className="px-4 py-3 text-right">TVA</th>
                    <th className="px-4 py-3 text-right">TTC</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{fullName(r.user)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {r.manager ? fullName(r.manager) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">{r.title}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status as ReportStatus} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                        {r.total_ht ? `${parseFloat(r.total_ht).toFixed(2)} €` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                        {r.total_tva ? `${parseFloat(r.total_tva).toFixed(2)} €` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                        {r.total_ttc ? `${parseFloat(r.total_ttc).toFixed(2)} €` : '—'}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
