import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      toast.error('Une erreur est survenue, veuillez réessayer.')
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
          <h1 className="text-2xl font-bold text-gray-900">Mot de passe oublié</h1>
          <p className="text-gray-500 mt-1">
            {sent
              ? 'Vérifiez votre boîte mail'
              : 'Saisissez votre email pour recevoir un lien de réinitialisation'}
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 rounded-xl text-green-700 text-sm">
              Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.
              Ce lien est valable 1 heure.
            </div>
            <Link to="/login" className="btn-primary inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </Link>
          </div>
        ) : (
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
            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
            </button>
            <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
