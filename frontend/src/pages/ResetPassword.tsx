import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      toast.success('Mot de passe réinitialisé avec succès')
      navigate('/login')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Lien invalide ou expiré')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <p className="text-red-600 font-medium">Lien invalide ou expiré.</p>
          <Link to="/login" className="btn-primary inline-flex mt-4">Retour à la connexion</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-4">
            <FileText className="w-7 h-7 text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau mot de passe</h1>
          <p className="text-gray-500 mt-1">Choisissez un nouveau mot de passe pour votre compte</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nouveau mot de passe</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoFocus
              minLength={6}
            />
          </div>
          <div>
            <label className="label">Confirmer le mot de passe</label>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Réinitialiser le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
