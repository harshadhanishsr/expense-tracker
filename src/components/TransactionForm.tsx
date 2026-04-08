// src/components/TransactionForm.tsx
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCategoriesForType, CATEGORY_COLORS, type TransactionType } from '@/lib/categories'
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions'
import SuggestionDropdown from '@/components/SuggestionDropdown'
import type { Suggestion } from '@/lib/types'

export default function TransactionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillType = (searchParams.get('type') ?? 'expense') as TransactionType
  const prefillAmount = searchParams.get('amount') ?? ''
  const prefillCategory = searchParams.get('category') ?? ''
  const prefillDescription = decodeURIComponent(searchParams.get('description') ?? '')
  const isRepeat = searchParams.has('type')

  const [type, setType] = useState<TransactionType>(prefillType)
  const [amount, setAmount] = useState(prefillAmount)
  const [category, setCategory] = useState(prefillCategory)
  const [description, setDescription] = useState(prefillDescription)
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

  const isExpense = type === 'expense'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Repeat banner */}
      {isRepeat && (
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-3">
          <span className="text-blue-400 text-lg">↺</span>
          <p className="text-blue-300 text-sm font-medium">Repeating a past transaction — edit if needed</p>
        </div>
      )}

      {/* Type toggle */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1">
        {(['expense','income'] as TransactionType[]).map(t => (
          <button key={t} type="button" onClick={() => { setType(t); setCategory('') }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 capitalize active:scale-95
              ${type===t
                ? t==='expense'
                  ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30'
                : 'text-slate-500 hover:text-slate-300'}`}
          >{t}</button>
        ))}
      </div>

      {/* Amount */}
      <div className={`rounded-2xl p-6 text-center border transition-all
        ${isExpense ? 'bg-red-950/30 border-red-900/50' : 'bg-emerald-950/30 border-emerald-900/50'}`}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-slate-400">Amount (₹)</p>
        <input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0"
          value={amount} onChange={e => setAmount(e.target.value)}
          className={`text-5xl font-extrabold text-center w-full outline-none bg-transparent placeholder:text-slate-700 tracking-tight
            ${isExpense ? 'text-red-300' : 'text-emerald-300'}`}
        />
      </div>

      {/* Description */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3.5 relative">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Note</label>
        <input type="text" placeholder="What was this for?" value={description}
          onChange={e => { setDescription(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          className="text-white text-sm w-full outline-none bg-transparent placeholder:text-slate-600"
        />
        <SuggestionDropdown suggestions={suggestions} onSelect={handleSuggestionSelect} visible={showSuggestions} />
      </div>

      {/* Category grid */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 px-1">Category</p>
        <div className="grid grid-cols-4 gap-2">
          {categories.map(cat => {
            const colors = CATEGORY_COLORS[cat.id] ?? CATEGORY_COLORS['other_expense']
            const isSelected = category === cat.id
            return (
              <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-xs font-semibold transition-all duration-200 active:scale-95
                  ${isSelected
                    ? `${colors.bg} border-2 ${colors.text} border-current/30 scale-105 shadow-lg`
                    : 'bg-slate-900/60 border-2 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'}`}
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className="text-[10px] leading-tight">{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Date */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-white text-sm w-full outline-none bg-transparent [color-scheme:dark]" />
      </div>

      {/* Recurring toggle */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Recurring</p>
            <p className="text-xs text-slate-500 mt-0.5">Repeats automatically</p>
          </div>
          <button type="button" onClick={() => setIsRecurring(r => !r)}
            className={`w-12 h-6 rounded-full transition-all duration-300 relative flex-shrink-0
              ${isRecurring ? 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/30' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${isRecurring ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {isRecurring && (
          <div className="mt-3 flex gap-2">
            {(['weekly','monthly'] as const).map(interval => (
              <button key={interval} type="button" onClick={() => setRecurrenceInterval(interval)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all active:scale-95
                  ${recurrenceInterval===interval
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >{interval}</button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      <button type="submit" disabled={submitting}
        className={`w-full py-4 rounded-2xl font-bold text-white text-base transition-all active:scale-95 disabled:opacity-50 shadow-lg
          ${isExpense
            ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/30 hover:shadow-red-500/50'
            : 'bg-gradient-to-r from-emerald-500 to-green-600 shadow-emerald-500/30 hover:shadow-emerald-500/50'}`}
      >{submitting ? 'Saving...' : `Add ${isExpense ? 'Expense' : 'Income'}`}</button>

    </form>
  )
}
