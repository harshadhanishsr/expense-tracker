// src/components/TransactionForm.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCategoriesForType, type TransactionType } from '@/lib/categories'
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions'
import SuggestionDropdown from '@/components/SuggestionDropdown'
import type { Suggestion } from '@/lib/types'

export default function TransactionForm() {
  const router = useRouter()
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<'weekly'|'monthly'>('monthly')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const suggestions = useDescriptionSuggestions(description, showSuggestions)
  const categories = getCategoriesForType(type)

  function handleSuggestionSelect(s: Suggestion) {
    setDescription(s.description)
    setCategory(s.category)
    setAmount(String(s.amount))
    setShowSuggestions(false)
  }

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
      body: JSON.stringify({
        type, amount: numAmount, category, description, date,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? recurrenceInterval : null,
      }),
    })
    setSubmitting(false)
    if (res.ok) { router.push('/dashboard'); router.refresh() }
    else setError('Failed to save. Please try again.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex bg-slate-700 rounded-xl p-1">
        {(['expense','income'] as TransactionType[]).map(t => (
          <button key={t} type="button" onClick={() => { setType(t); setCategory('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors capitalize ${type===t ? (t==='expense'?'bg-red-500 text-white':'bg-green-500 text-white') : 'text-slate-400 hover:text-slate-200'}`}
          >{t}</button>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Amount (₹)</p>
        <input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00"
          value={amount} onChange={e => setAmount(e.target.value)}
          className="text-4xl font-bold text-white text-center w-full outline-none bg-transparent placeholder:text-slate-600"
        />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 relative">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Note</label>
        <input type="text" placeholder="What was this for?" value={description}
          onChange={e => { setDescription(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          className="text-white text-sm w-full outline-none bg-transparent placeholder:text-slate-600"
        />
        <SuggestionDropdown suggestions={suggestions} onSelect={handleSuggestionSelect} visible={showSuggestions} />
      </div>

      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 px-1">Category</p>
        <div className="grid grid-cols-4 gap-2">
          {categories.map(cat => (
            <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-colors ${category===cat.id ? 'bg-blue-900 text-blue-300 border-2 border-blue-500' : 'bg-slate-800 text-slate-400 border-2 border-slate-700 hover:border-slate-500'}`}
            ><span className="text-xl">{cat.emoji}</span>{cat.label}</button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-white text-sm w-full outline-none bg-transparent [color-scheme:dark]" />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-300">Recurring?</label>
          <button type="button" onClick={() => setIsRecurring(r => !r)}
            className={`w-12 h-6 rounded-full transition-colors relative ${isRecurring ? 'bg-blue-500' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {isRecurring && (
          <div className="mt-3 flex gap-2">
            {(['weekly','monthly'] as const).map(interval => (
              <button key={interval} type="button" onClick={() => setRecurrenceInterval(interval)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${recurrenceInterval===interval ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              >{interval}</button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button type="submit" disabled={submitting}
        className={`w-full py-4 rounded-xl font-semibold text-white transition-colors ${type==='expense'?'bg-red-500 hover:bg-red-600 active:bg-red-700':'bg-green-500 hover:bg-green-600 active:bg-green-700'} disabled:opacity-50`}
      >{submitting ? 'Saving...' : `Add ${type==='expense'?'Expense':'Income'}`}</button>
    </form>
  )
}
