import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ExpenseCategory, ExpenseItem } from '../types'
import { CATEGORIES } from '../types'

interface Props {
  item: ExpenseItem
  onSave: (data: Partial<ExpenseItem>) => void
  onClose: () => void
}

const TVA_RATES = [
  { label: '20 %', value: 20 },
  { label: '10 %', value: 10 },
  { label: '5,5 %', value: 5.5 },
  { label: 'Autre', value: -1 },
]

function roundTwo(n: number) {
  return Math.round(n * 100) / 100
}

export default function EditExpenseModal({ item, onSave, onClose }: Props) {
  const [ttc, setTtc] = useState(item.amount_ttc ? String(item.amount_ttc) : '')
  const [rateKey, setRateKey] = useState<number>(20)
  const [customRate, setCustomRate] = useState('')
  const [vendor, setVendor] = useState(item.vendor_name ?? '')
  const [date, setDate] = useState(item.expense_date ?? '')
  const [category, setCategory] = useState<ExpenseCategory>(item.category ?? 'Autre')
  const [description, setDescription] = useState(item.description ?? '')

  // Initialise le taux depuis les données existantes
  useEffect(() => {
    if (item.amount_ttc && item.amount_tva) {
      const ttcN = parseFloat(String(item.amount_ttc))
      const tvaN = parseFloat(String(item.amount_tva))
      if (ttcN > 0) {
        const rate = roundTwo((tvaN / (ttcN - tvaN)) * 100)
        const known = TVA_RATES.find((r) => r.value === rate)
        if (known && known.value !== -1) {
          setRateKey(known.value)
        } else {
          setRateKey(-1)
          setCustomRate(String(rate))
        }
      }
    }
  }, [])

  const effectiveRate = rateKey === -1 ? parseFloat(customRate || '0') : rateKey
  const ttcN = parseFloat(ttc || '0')
  const htN = effectiveRate > 0 && ttcN > 0 ? roundTwo(ttcN / (1 + effectiveRate / 100)) : null
  const tvaN = htN !== null ? roundTwo(ttcN - htN) : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ttc || ttcN <= 0 || !date) return
    onSave({
      amount_ttc: String(ttcN),
      amount_ht: htN !== null ? String(htN) : null,
      amount_tva: tvaN !== null ? String(tvaN) : null,
      expense_date: date || null,
      category,
      description: description || null,
      vendor_name: vendor || null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Saisie de la dépense</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Prestataire */}
          <div>
            <label className="label">Prestataire</label>
            <input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Ex : SNCF, Hôtel Ibis…" />
          </div>

          {/* Date + Catégorie */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date de la dépense</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Montant TTC */}
          <div>
            <label className="label">Montant TTC (€) *</label>
            <input
              className="input text-lg font-semibold"
              type="number"
              step="0.01"
              min="0"
              value={ttc}
              onChange={(e) => setTtc(e.target.value)}
              placeholder="0,00"
              required
              autoFocus
            />
          </div>

          {/* Taux TVA */}
          <div>
            <label className="label">Taux de TVA</label>
            <div className="flex gap-2 flex-wrap">
              {TVA_RATES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRateKey(r.value)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    rateKey === r.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {rateKey === -1 && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="input w-28"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  placeholder="Ex : 8,5"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
          </div>

          {/* Récapitulatif calculé */}
          {ttcN > 0 && htN !== null && (
            <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-3 gap-3 text-sm">
              <div className="text-center">
                <p className="text-gray-500 text-xs">Montant HT</p>
                <p className="font-semibold">{htN.toFixed(2)} €</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs">TVA ({effectiveRate} %)</p>
                <p className="font-semibold">{tvaN?.toFixed(2)} €</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs">TTC</p>
                <p className="font-bold text-blue-700">{ttcN.toFixed(2)} €</p>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="label">Description (optionnel)</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Objet de la dépense…" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" className="btn-primary flex-1" disabled={!ttc || ttcN <= 0 || !date}>Confirmer</button>
          </div>
        </form>
      </div>
    </div>
  )
}
