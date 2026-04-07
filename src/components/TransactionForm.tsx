'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCategoriesForType, type TransactionType } from '@/lib/categories'

export default function TransactionForm() {
  const router = useRouter()
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const numAmount = parseFloat(amount)
    if (!amount || !category) { setError('Amount and category are required'); return }
    if (isNaN(numAmount) || numAmount <= 0) { setError('Enter a valid amount'); return }
    setSubmitting(true)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount: numAmount, category, description, date }),
    })
    setSubmitting(false)
    if (res.ok) { router.push('/dashboard'); router.refresh() }
    else setError('Failed to save. Please try again.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex bg-slate-100 rounded-xl p-1">
        {(['expense','income'] as TransactionType[]).map(t => (
          <button key={t} type="button" onClick={() => { setType(t); setCategory('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors capitalize ${type===t ? (t==='expense'?'bg-red-500 text-white':'bg-green-500 text-white') : 'text-slate-500'}`}
          >{t}</button>
        ))}
      </div>
      <div className="bg-white rounded-xl p-5 text-center shadow-sm">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Amount (₹)</p>
        <input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00"
          value={amount} onChange={e => setAmount(e.target.value)}
          className="text-4xl font-bold text-slate-800 text-center w-full outline-none bg-transparent placeholder:text-slate-200"
        />
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Category</p>
        <div className="grid grid-cols-4 gap-2">
          {getCategoriesForType(type).map(cat => (
            <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-colors ${category===cat.id ? 'bg-blue-100 text-blue-700 border-2 border-blue-400' : 'bg-white text-slate-600 border-2 border-transparent shadow-sm hover:border-slate-200'}`}
            ><span className="text-xl">{cat.emoji}</span>{cat.label}</button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-slate-800 text-sm w-full outline-none bg-transparent" />
      </div>
      <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Note (optional)</label>
        <input type="text" placeholder="What was this for?" value={description} onChange={e => setDescription(e.target.value)}
          className="text-slate-800 text-sm w-full outline-none bg-transparent placeholder:text-slate-300" />
      </div>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <button type="submit" disabled={submitting}
        className={`w-full py-4 rounded-xl font-semibold text-white transition-colors ${type==='expense'?'bg-red-500 hover:bg-red-600':'bg-green-500 hover:bg-green-600'} disabled:opacity-60`}
      >{submitting ? 'Saving...' : `Add ${type==='expense'?'Expense':'Income'}`}</button>
    </form>
  )
}
