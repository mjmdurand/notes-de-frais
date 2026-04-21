import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BookOpen, Download, RotateCcw, Search, X } from 'lucide-react'
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

function fmtDate(iso: string | null | undefined, fmt: 'YYYYMMDD' | 'DDMMYYYY'): string {
  if (!iso) return ''
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return fmt === 'YYYYMMDD' ? `${y}${m}${day}` : `${day}${m}${y}`
}

function fmtAmount(val: string | null | undefined): string {
  const n = val ? parseFloat(val) : 0
  return n.toFixed(2).replace('.', ',')
}

function exportFec(reports: ExpenseReportListAll[]) {
  const headers = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
    'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
    'PieceRef', 'PieceDate', 'EcritureLib',
    'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
  ]
  const rows: string[][] = []
  let seq = 1
  for (const r of reports) {
    const date = fmtDate(r.submitted_at ?? r.created_at, 'YYYYMMDD')
    const pieceDate = fmtDate(r.submitted_at ?? r.created_at, 'YYYYMMDD')
    const lib = r.title.slice(0, 50).replace(/\t/g, ' ')
    const empCode = `AUX${r.user.id.slice(0, 8).replace(/-/g, '').toUpperCase()}`
    const empName = fullName(r.user).slice(0, 50)
    const ht = parseFloat(r.total_ht ?? '0')
    const tva = parseFloat(r.total_tva ?? '0')
    const ttc = parseFloat(r.total_ttc ?? '0')
    const num = String(seq).padStart(6, '0')

    // 625100 — Frais de déplacement (HT)
    rows.push([
      'NDF', 'Notes de frais', num, date,
      '625100', 'Frais de déplacement', '', '',
      r.id.slice(0, 8).toUpperCase(), pieceDate, lib,
      fmtAmount(ht.toFixed(2)), '0,00', '', '', '', '', '',
    ])

    // 445660 — TVA déductible (TVA, only if > 0)
    if (tva > 0) {
      rows.push([
        'NDF', 'Notes de frais', num, date,
        '445660', 'TVA déductible sur autres biens', '', '',
        r.id.slice(0, 8).toUpperCase(), pieceDate, lib,
        fmtAmount(tva.toFixed(2)), '0,00', '', '', '', '', '',
      ])
    }

    // 421000 — Rémunérations dues (TTC, credit)
    rows.push([
      'NDF', 'Notes de frais', num, date,
      '421000', 'Rémunérations dues', empCode, empName,
      r.id.slice(0, 8).toUpperCase(), pieceDate, lib,
      '0,00', fmtAmount(ttc.toFixed(2)), '', '', '', '', '',
    ])

    seq++
  }
  const content = [headers, ...rows].map((row) => row.join('\t')).join('\r\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `FEC-NDF-${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function exportSage100(reports: ExpenseReportListAll[]) {
  const rows: string[] = []
  for (const r of reports) {
    const date = fmtDate(r.submitted_at ?? r.created_at, 'DDMMYYYY')
    const lib = r.title.slice(0, 69).replace(/;/g, ' ')
    const pieceNum = r.id.slice(0, 8).toUpperCase()
    const empCode = `AUX${r.user.id.slice(0, 8).replace(/-/g, '').toUpperCase()}`
    const ht = parseFloat(r.total_ht ?? '0')
    const tva = parseFloat(r.total_tva ?? '0')
    const ttc = parseFloat(r.total_ttc ?? '0')

    // 625100 — HT
    rows.push(['E', 'NDF', date, '625100', '', pieceNum, lib, fmtAmount(ht.toFixed(2)), '0,00'].join(';'))

    // 445660 — TVA
    if (tva > 0) {
      rows.push(['E', 'NDF', date, '445660', '', pieceNum, lib, fmtAmount(tva.toFixed(2)), '0,00'].join(';'))
    }

    // 421000 — TTC crédit
    rows.push(['E', 'NDF', date, '421000', empCode, pieceNum, lib, '0,00', fmtAmount(ttc.toFixed(2))].join(';'))
  }
  const blob = new Blob([rows.join('\r\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Sage100-NDF-${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

type AccountingFormat = 'fec' | 'sage100'

export default function AccountingAllReports() {
  const defaultDateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState('')
  const [managerId, setManagerId] = useState('')
  const [userId, setUserId] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('approved')
  const [showAccountingExport, setShowAccountingExport] = useState(false)
  const [accountingFormat, setAccountingFormat] = useState<AccountingFormat>('fec')

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAccountingExport(true)}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
            >
              <BookOpen className="w-4 h-4" />
              Export logiciel comptable
            </button>
            <button
              onClick={() => exportCsv(filtered)}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Exporter CSV ({filtered.length})
            </button>
          </div>
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

      {/* Accounting export modal */}
      {showAccountingExport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Export logiciel comptable</h2>
              <button onClick={() => setShowAccountingExport(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Sélectionnez le format d'export compatible avec votre logiciel comptable.
                L'export portera sur les <strong>{filtered.length} notes</strong> correspondant aux filtres actifs.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAccountingFormat('fec')}
                  className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-colors ${
                    accountingFormat === 'fec'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-semibold text-sm text-gray-900">CEGID Loop</span>
                  <span className="text-xs text-gray-500">Format FEC (Fichier des Écritures Comptables)</span>
                  <span className="text-xs text-gray-400 mt-1">Séparateur tabulation · .txt</span>
                </button>

                <button
                  onClick={() => setAccountingFormat('sage100')}
                  className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-colors ${
                    accountingFormat === 'sage100'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-semibold text-sm text-gray-900">Sage 100 Comptabilité</span>
                  <span className="text-xs text-gray-500">Format import Sage 100</span>
                  <span className="text-xs text-gray-400 mt-1">Séparateur point-virgule · .txt</span>
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <p className="font-medium text-gray-600">Comptes PCG utilisés :</p>
                <p>625100 — Frais de déplacement (montant HT)</p>
                <p>445660 — TVA déductible sur autres biens (TVA)</p>
                <p>421000 — Rémunérations dues (montant TTC, crédit)</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => setShowAccountingExport(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (accountingFormat === 'fec') exportFec(filtered)
                  else exportSage100(filtered)
                  setShowAccountingExport(false)
                }}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
