// src/components/AIInputBar.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { parse } from '@/lib/smartParser'
import { useTripContext } from '@/lib/tripContext'
import { ParseResult } from '@/lib/types'
import { getCategoryById, getCategoriesForType } from '@/lib/categories'
import VoiceInput from './VoiceInput'

interface Suggestion { description: string; category: string; amount: number }

export default function AIInputBar() {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { activeTrip } = useTripContext()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch suggestions on mount
  useEffect(() => {
    fetch('/api/transactions/suggestions')
      .then(r => r.json())
      .then(d => setSuggestions((d.suggestions ?? []).slice(0, 3)))
      .catch(() => {})
  }, [])

  // Debounced parse
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!input.trim()) { setParsed(null); return }
    debounceRef.current = setTimeout(() => {
      setParsed(parse(input))
    }, 300)
  }, [input])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function submit(overrideCategory?: string) {
    if (!parsed || parsed.amount <= 0 || submitting) return
    setSubmitting(true)
    const category = overrideCategory ?? parsed.category
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: parsed.type,
          amount: parsed.amount,
          category,
          description: parsed.description,
          date: new Date().toISOString().slice(0, 10),
          trip_id: activeTrip?.id ?? null,
        }),
      })
      if (!res.ok) throw new Error()
      setInput('')
      setParsed(null)
      showToast('✓ Logged')
    } catch {
      if ((await fetch('/api/transactions').catch(() => ({ offline: true })) as any).offline) {
        showToast('You are offline')
      } else {
        showToast('Failed to log')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const catForType = getCategoriesForType('expense')

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-40 px-4">
      {/* Toast */}
      {toast && (
        <div className="mb-2 text-center text-xs text-emerald-400 font-semibold">{toast}</div>
      )}

      {/* Parse result tags */}
      {parsed && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {parsed.amount > 0 && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              ₹{parsed.amount}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-lg text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            {getCategoryById(parsed.category)?.emoji} {getCategoryById(parsed.category)?.label}
          </span>
          {activeTrip && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
              🏝️ {activeTrip.name}
            </span>
          )}
          {/* Low confidence: show category selector */}
          {parsed.confidence === 'low' && (
            <div className="w-full flex gap-1.5 mt-1 overflow-x-auto pb-0.5">
              {catForType.map(c => (
                <button key={c.id} onClick={() => submit(c.id)}
                  className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[11px] bg-slate-700/60 text-slate-300 border border-slate-600/40">
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggestion pills */}
      {!parsed && suggestions.length > 0 && (
        <div className="flex gap-1.5 mb-2 overflow-x-hidden">
          {suggestions.map((s, i) => (
            <button key={i}
              onClick={() => { setInput(`${s.description} ${s.amount}`); }}
              className="flex-shrink-0 px-2.5 py-1 rounded-2xl text-[11px] border bg-orange-500/10 border-orange-500/20 text-orange-400">
              {getCategoryById(s.category)?.emoji} {s.description}
            </button>
          ))}
        </div>
      )}

      {/* Main bar */}
      <div className="flex items-center gap-2 bg-[#16161f] border border-orange-500/30 rounded-3xl px-4 py-2.5
        shadow-xl shadow-black/50">
        <VoiceInput
          onTranscript={t => setInput(t)}
          onError={msg => showToast(msg)}
        />
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Type or speak an expense…"
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
        />
        {parsed && parsed.amount > 0 && (
          <button onClick={() => submit()}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30
              flex items-center justify-center text-sm text-orange-400">
            ➤
          </button>
        )}
      </div>
    </div>
  )
}
