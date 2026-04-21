import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { CheckCircle, Edit2, File, Loader2, Upload, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import EditExpenseModal from '../components/EditExpenseModal'
import { documentsApi, expensesApi } from '../services/api'
import type { Document, ExpenseItem } from '../types'
import { CATEGORIES } from '../types'

interface Row {
  document: Document
  item: Partial<ExpenseItem>
  confirmed: boolean
}

export default function CreateExpenseReport() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [rows, setRows] = useState<Row[]>([])
  const [uploading, setUploading] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return
    setUploading(true)
    try {
      const docs = await Promise.all(accepted.map((f) => documentsApi.upload(f).then((r) => r.data)))
      setRows((prev) => [...prev, ...docs.map((doc) => ({ document: doc, item: {}, confirmed: false }))])
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Erreur lors du dépôt')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
  })

  const handleGoReview = () => {
    if (!title.trim()) return toast.error('Veuillez saisir un titre')
    if (!rows.length) return toast.error('Veuillez déposer au moins un justificatif')
    setStep('review')
  }

  const handleSaveEdit = (index: number, data: Partial<ExpenseItem>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, item: { ...r.item, ...data }, confirmed: true } : r)),
    )
    setEditingIndex(null)
  }

  const handleRemove = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const allConfirmed = rows.length > 0 && rows.every((r) => r.confirmed)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const reportRes = await expensesApi.create({
        title,
        document_ids: rows.map((r) => r.document.id),
      })
      const report = reportRes.data

      await Promise.all(
        report.items.map(async (item) => {
          const row = rows.find((r) => r.document.id === item.document_id)
          if (!row) return
          await expensesApi.updateItem(item.id, { ...row.item, is_confirmed: true })
        }),
      )

      await expensesApi.submit(report.id)
      toast.success('Note de frais envoyée !')
      navigate('/')
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? "Erreur lors de l'envoi")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      {editingIndex !== null && (
        <EditExpenseModal
          item={rows[editingIndex].item as ExpenseItem}
          onSave={(data) => handleSaveEdit(editingIndex, data)}
          onClose={() => setEditingIndex(null)}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 text-sm">
            ← Retour
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Créer une note de frais</h1>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 text-sm">
          {(['upload', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-gray-300" />}
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium ${step === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${step === s ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>{i + 1}</span>
                {s === 'upload' ? 'Dépôt des justificatifs' : 'Saisie & envoi'}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1 — Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="card">
              <label className="label">Titre de la note de frais *</label>
              <input
                className="input"
                placeholder="Ex : Déplacement Paris juin 2025"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="card">
              <h2 className="font-semibold mb-4">Justificatifs</h2>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">
                  {isDragActive ? 'Déposez ici...' : 'Glissez vos fichiers ou cliquez pour parcourir'}
                </p>
                <p className="text-sm text-gray-400 mt-1">JPG, PNG, WEBP, PDF — max 10 Mo par fichier</p>
              </div>

              {uploading && (
                <div className="flex items-center gap-2 mt-3 text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Dépôt en cours…
                </div>
              )}

              {rows.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {rows.map((r, i) => (
                    <li key={r.document.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <File className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-700 flex-1 truncate">{r.document.original_filename}</span>
                      <span className="text-xs text-gray-400">
                        {r.document.file_size ? `${(r.document.file_size / 1024).toFixed(0)} Ko` : ''}
                      </span>
                      <button onClick={() => handleRemove(i)} className="text-gray-400 hover:text-red-500">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end">
              <button
                className="btn-primary"
                onClick={handleGoReview}
                disabled={!rows.length || !title.trim()}
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Manual entry */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="card p-0 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="font-semibold">Saisie des dépenses</h2>
                <span className="text-sm text-gray-500">
                  {rows.filter((r) => r.confirmed).length}/{rows.length} confirmées
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Fichier</th>
                      <th className="px-4 py-3 text-left">Prestataire</th>
                      <th className="px-4 py-3 text-right">HT</th>
                      <th className="px-4 py-3 text-right">TVA</th>
                      <th className="px-4 py-3 text-right">TTC</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Catégorie</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => (
                      <tr key={r.document.id} className={r.confirmed ? 'bg-green-50' : 'bg-amber-50'}>
                        <td className="px-4 py-3 font-medium max-w-[140px] truncate text-gray-700">
                          {r.document.original_filename}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{r.item.vendor_name ?? <span className="text-gray-300 italic">—</span>}</td>
                        <td className="px-4 py-3 text-right">
                          {r.item.amount_ht ? `${parseFloat(r.item.amount_ht as string).toFixed(2)} €` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.item.amount_tva ? `${parseFloat(r.item.amount_tva as string).toFixed(2)} €` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {r.item.amount_ttc ? `${parseFloat(r.item.amount_ttc as string).toFixed(2)} €` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {r.item.expense_date
                            ? new Date(r.item.expense_date as string).toLocaleDateString('fr-FR')
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                            {r.item.category ?? <span className="text-gray-400">—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {r.confirmed ? (
                              <>
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                <button
                                  onClick={() => setEditingIndex(i)}
                                  className="text-gray-400 hover:text-blue-600"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setEditingIndex(i)}
                                className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                Saisir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-sm text-gray-500">
              Cliquez sur <strong>Saisir</strong> pour chaque ligne afin d'indiquer les montants, la date et la catégorie.
            </p>

            <div className="flex items-center justify-between">
              <button onClick={() => setStep('upload')} className="btn-secondary">← Retour</button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={handleSubmit}
                disabled={!allConfirmed || submitting}
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Envoi en cours…</>
                  : 'Envoyer la note de frais'}
              </button>
            </div>

            {!allConfirmed && (
              <p className="text-sm text-amber-600 text-right">
                Toutes les lignes doivent être saisies avant l'envoi
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
