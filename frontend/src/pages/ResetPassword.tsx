import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Check, FileText, X } from 'lucide-react'
import { authApi } from '../services/api'

interface Rule { label: string; test: (p: string) => boolean }

const RULES: Rule[] = [
  { label: '8 caractères minimum', test: (p) => p.length >= 8 },
  { label: 'Une majuscule (A-Z)',   test: (p) => /[A-Z]/.test(p) },
  { label: 'Une minuscule (a-z)',   test: (p) => /[a-z]/.test(p) },
  { label: 'Un chiffre (0-9)',      test: (p) => /\d/.test(p) },
  { label: 'Un caractère spécial',  test: (p) => /[^a-zA-Z0-9]/.test(p) },
]

function strengthScore(p: string) {
  return RULES.filter((r) => r.test(p)).length
}

const STRENGTH_LABELS = ['', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort']
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500']

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)

  const score = strengthScore(password)
  const allRulesMet = score === RULES.length
  const confirmMatch = password === confirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError('')
    if (!allRulesMet) return
    if (!confirmMatch) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      navigate('/login?reset=1')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Lien invalide ou expiré')
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
          <p className="text-gray-500 mt-1">Choisissez un mot de passe sécurisé</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nouveau mot de passe</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setTouched(true) }}
              placeholder="••••••••"
              required
              autoFocus
            />

            {/* Strength bar */}
            {password.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-1">
                  {RULES.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < score ? STRENGTH_COLORS[score] : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${score >= 4 ? 'text-green-600' : score >= 3 ? 'text-yellow-600' : 'text-red-500'}`}>
                  {STRENGTH_LABELS[score]}
                </p>
              </div>
            )}

            {/* Rules checklist */}
            {(touched || password.length > 0) && (
              <ul className="mt-3 space-y-1">
                {RULES.map((r) => {
                  const ok = r.test(password)
                  return (
                    <li key={r.label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                      {ok
                        ? <Check className="w-3.5 h-3.5 shrink-0" />
                        : <X className="w-3.5 h-3.5 shrink-0" />}
                      {r.label}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div>
            <label className="label">Confirmer le mot de passe</label>
            <input
              className={`input ${confirm.length > 0 && !confirmMatch ? 'border-red-400 focus:ring-red-200' : ''}`}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
            {confirm.length > 0 && !confirmMatch && (
              <p className="mt-1 text-xs text-red-500">Les mots de passe ne correspondent pas</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full py-2.5 disabled:opacity-50"
            disabled={loading || !allRulesMet || !confirmMatch}
          >
            {loading ? 'Enregistrement...' : 'Définir mon mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
