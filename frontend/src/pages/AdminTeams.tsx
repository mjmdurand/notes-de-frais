import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, Layers, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import { teamsApi, usersApi } from '../services/api'
import type { Team } from '../types'

interface TeamForm {
  name: string
  manager_id: string
}

const emptyForm: TeamForm = { name: '', manager_id: '' }

export default function AdminTeams() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)
  const [form, setForm] = useState<TeamForm>(emptyForm)

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['admin-teams'],
    queryFn: () => teamsApi.list().then((r) => r.data),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const managers = users.filter((u) => (u.role === 'manager' || u.role === 'admin') && u.is_active)

  const set = (key: keyof TeamForm, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setEditTeam(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (t: Team) => {
    setEditTeam(t)
    setForm({ name: t.name, manager_id: t.manager?.id ?? '' })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      const payload = { name: form.name.trim(), manager_id: form.manager_id || undefined }
      if (editTeam) {
        await teamsApi.update(editTeam.id, payload)
        toast.success('Équipe mise à jour')
      } else {
        await teamsApi.create(payload)
        toast.success('Équipe créée')
      }
      qc.invalidateQueries({ queryKey: ['admin-teams'] })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setShowForm(false)
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Erreur')
    }
  }

  const handleDelete = async (t: Team) => {
    if (!confirm(`Supprimer l'équipe "${t.name}" ? Les membres seront désaffectés.`)) return
    try {
      await teamsApi.delete(t.id)
      toast.success('Équipe supprimée')
      qc.invalidateQueries({ queryKey: ['admin-teams'] })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    } catch {
      toast.error('Erreur')
    }
  }

  const memberCount = (teamId: string) => users.filter((u) => u.team_id === teamId).length

  return (
    <Layout>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editTeam ? 'Modifier' : 'Créer'} une équipe</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nom de l'équipe</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ex : Commercial, Technique, RH…"
                  required
                />
              </div>
              <div>
                <label className="label">Manager responsable</label>
                <select className="input" value={form.manager_id} onChange={(e) => set('manager_id', e.target.value)}>
                  <option value="">— Aucun —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1">{editTeam ? 'Enregistrer' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Équipes</h1>
            <p className="text-gray-500 mt-1">Gestion des équipes et affectation des managers</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Créer une équipe
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : teams.length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucune équipe créée</p>
              <button onClick={openCreate} className="mt-4 text-sm text-blue-600 hover:underline">
                Créer la première équipe
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Équipe</th>
                  <th className="px-4 py-3 text-left">Manager</th>
                  <th className="px-4 py-3 text-center">Membres</th>
                  <th className="px-4 py-3 text-left">Créée le</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teams.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {t.manager
                        ? `${t.manager.first_name} ${t.manager.last_name}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                        {memberCount(t.id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(t.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(t)} className="p-1 text-gray-400 hover:text-blue-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(t)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
