import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle, Clock, ChevronDown } from 'lucide-react'
import Layout from '../components/Layout'
import { expensesApi } from '../services/api'

const DAYS = 30

function cutoffDate() {
  const d = new Date()
  d.setDate(d.getDate() - DAYS)
  return d
}

export default function AccountingDashboard() {
  const [showAll, setShowAll] = useState(false)

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['pending-accounting'],
    queryFn: () => expensesApi.pendingAccounting().then((r) => r.data),
    refetchInterval: 30000,
  })

  const cutoff = cutoffDate()
  const recentReports = reports.filter((r) => new Date(r.created_at) >= cutoff)
  const hiddenCount = reports.length - recentReports.length
  const visibleReports = showAll ? reports : recentReports

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Comptabilité</h1>
          <p className="text-gray-500 mt-1">Notes de frais validées par les managers, en attente de validation comptable</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <span className="font-semibold">{reports.length} note{reports.length !== 1 ? 's' : ''} à traiter</span>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b flex items-center gap-3">
            <h2 className="font-semibold text-gray-900">En attente de validation comptable</h2>
            {!showAll && <span className="text-xs text-gray-400">30 derniers jours</span>}
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : visibleReports.length === 0 && reports.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucune note de frais en attente de traitement</p>
            </div>
          ) : visibleReports.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Aucune note sur les 30 derniers jours.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Collaborateur</th>
                      <th className="px-4 py-3 text-left">Titre</th>
                      <th className="px-4 py-3 text-left">Validée manager</th>
                      <th className="px-4 py-3 text-right">Montant TTC</th>
                      <th className="px-4 py-3 text-center">Pièces</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleReports.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {r.user.first_name} {r.user.last_name}
                        </td>
                        <td className="px-4 py-3">{r.title}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {r.total_ttc ? `${parseFloat(r.total_ttc).toFixed(2)} €` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{r.item_count}</td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/expenses/${r.id}`} className="btn-primary text-xs py-1.5 px-3">
                            Traiter
                          </Link>
                        </td>
                      </tr>
                    ))}
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
                    onClick={() => setShowAll(false)}
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
