import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit2, KeyRound, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import { teamsApi, usersApi } from '../services/api'
import type { User, UserRole } from '../types'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'user', label: 'Utilisateur' },
  { value: 'manager', label: 'Manager' },
  { value: 'accounting', label: 'Comptabilité' },
  { value: 'admin', label: 'Administrateur' },
]

const ROLE_BADGES: Record<UserRole, string> = {
  user: 'bg-gray-100 text-gray-700',
  manager: 'bg-purple-100 text-purple-700',
  accounting: 'bg-blue-100 text-blue-700',
  admin: 'bg-red-100 text-red-700',
}

interface UserForm {
  email: string
  first_name: string
  last_name: string
  role: UserRole
  team_id: string
}

const emptyForm: UserForm = {
  email: '', first_name: '', last_name: '', role: 'user', team_id: '',
}

export default function AdminDashboard() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const { data: teams = [] } = useQuery({
    queryKey: ['admin-teams'],
    queryFn: () => teamsApi.list().then((r) => r.data),
  })

  const set = (key: keyof UserForm, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const openCreate = () => {
    setEditUser(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (u: User) => {
    setEditUser(u)
    setForm({
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
      team_id: u.team_id ?? '',
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!form.team_id) {
        toast.error('Veuillez sélectionner une équipe')
        return
      }
      const payload = { ...form }
      if (editUser) {
        await usersApi.update(editUser.id, payload)
        toast.success('Utilisateur mis à jour')
      } else {
        await usersApi.create(payload)
        toast.success('Utilisateur créé — un email d\'invitation a été envoyé')
      }
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setShowForm(false)
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Erreur')
    }
  }

  const handleSendReset = async (u: User) => {
    try {
      await usersApi.sendReset(u.id)
      toast.success(`Lien de réinitialisation envoyé à ${u.email}`)
    } catch {
      toast.error('Erreur lors de l\'envoi')
    }
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`Désactiver ${u.first_name} ${u.last_name} ?`)) return
    try {
      await usersApi.delete(u.id)
      toast.success('Utilisateur désactivé')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    } catch {
      toast.error('Erreur')
    }
  }

  return (
    <Layout>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editUser ? 'Modifier' : 'Créer'} un utilisateur</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prénom *</label>
                  <input className="input" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Nom *</label>
                  <input className="input" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required disabled={!!editUser} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Rôle</label>
                  <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Équipe *</label>
                  <select className="input" value={form.team_id} onChange={(e) => set('team_id', e.target.value)} required>
                    <option value="">— Sélectionner —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {editUser && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Mot de passe</p>
                    <p className="text-xs text-gray-500">Envoyer un lien de réinitialisation à l'utilisateur</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { handleSendReset(editUser); setShowForm(false) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Envoyer le lien
                  </button>
                </div>
              )}
              {!editUser && (
                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  Un email d'invitation sera envoyé à l'utilisateur pour qu'il crée son mot de passe.
                  Le lien est valable 7 jours.
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1">{editUser ? 'Enregistrer' : 'Créer et inviter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Administration</h1>
            <p className="text-gray-500 mt-1">Gestion des utilisateurs</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Créer un utilisateur
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Nom</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Rôle</th>
                  <th className="px-4 py-3 text-left">Équipe</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const team = teams.find((t) => t.id === u.team_id)
                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{u.first_name} {u.last_name}</td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGES[u.role]}`}>
                          {ROLES.find((r) => r.value === u.role)?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {team ? team.name : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {u.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSendReset(u)}
                            title="Envoyer un lien de réinitialisation"
                            className="p-1 text-gray-400 hover:text-blue-600"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(u)} className="p-1 text-gray-400 hover:text-blue-600">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(u)} className="p-1 text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
