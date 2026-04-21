import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../services/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoAccounts, setDemoAccounts] = useState<{ role: string; email: string; password: string }[]>([])

  useEffect(() => {
    authApi.demoInfo().then((r) => {
      if (r.data.enabled) setDemoAccounts(r.data.accounts)
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate(searchParams.get('redirect') ?? '/')
    } catch {
      toast.error('Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-4">
            <FileText className="w-7 h-7 text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Notes de Frais</h1>
          <p className="text-gray-500 mt-1">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Adresse email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.com"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
          <div className="text-center">
            <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800">
              Mot de passe oublié ?
            </Link>
          </div>
        </form>

        {demoAccounts.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-600">Comptes de démonstration :</p>
            {demoAccounts.map((a) => (
              <p key={a.role}>{a.role} : {a.email} / {a.password}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
