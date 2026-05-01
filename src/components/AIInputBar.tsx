// src/components/AIInputBar.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { parse } from '@/lib/smartParser'
import { useTripContext } from '@/lib/tripContext'
import { saveExample, getTopExamples } from '@/lib/trainingStore'
import { ParseResult } from '@/lib/types'
import { getCategoryById, getCategoriesForType } from '@/lib/categories'
import VoiceInput from './VoiceInput'

interface Chip { description: string; category: string; amount: number }

function getSmartChips(
  transactions: Array<{ description?: string | null; category: string; amount: number; date: string }>,
): Chip[] {
  const freq = new Map<string, { chip: Chip; count: number }>()
  for (const t of transactions) {
    if (!t.description) continue
    const key = `${t.description}-${t.category}`
    const existing = freq.get(key)
    if (existing) {
      existing.count++
    } else {
      freq.set(key, {
        chip: { description: t.description, category: t.category, amount: Math.round(Number(t.amount)) },
        count: 1,
      })
    }
  }
  return [...freq.values()].sort((a, b) => b.count - a.count).slice(0, 5).map(x => x.chip)
}

export default function AIInputBar() {
  const pathname = usePathname()
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [chipTxns, setChipTxns] = useState<Array<{ description?: string | null; category: string; amount: number; date: string }>>([])
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [autoCountdown, setAutoCountdown] = useState(false)
  const { activeTrip, pendingPrefill, setPendingPrefill } = useTripContext()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastInputRef = useRef('')
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch recent transactions for smart chips
  useEffect(() => {
    fetch('/api/transactions/recent?days=90')
      .then(r => r.json())
      .then(d => setChipTxns(d.transactions ?? []))
      .catch(() => {})
  }, [])

  // Consume pendingPrefill from TripContext
  useEffect(() => {
    if (!pendingPrefill) return
    const text = `${pendingPrefill.description} ${pendingPrefill.amount}`
    setInput(text)
    lastInputRef.current = text
    const result = parse(text)
    setParsed({ ...result, type: pendingPrefill.type })
    setPendingPrefill(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [pendingPrefill, setPendingPrefill])

  // Debounced parse with Ollama fallback
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!input.trim()) { setParsed(null); return }
    debounceRef.current = setTimeout(async () => {
      const regexResult = parse(input)
      if (regexResult.confidence === 'high') {
        setParsed(regexResult)
        return
      }
      setLoading(true)
      try {
        const examples = getTopExamples(10)
        const res = await fetch('/api/ai/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input, examples }),
        })
        if (res.ok) {
          setParsed(await res.json())
        } else {
          setParsed(regexResult)
        }
      } catch {
        setParsed(regexResult)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [input])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function submitTransaction(result: ParseResult, overrideCategory?: string) {
    if (submitting) return
    setSubmitting(true)
    const category = overrideCategory ?? result.category
    const wasCorrection = overrideCategory !== undefined && overrideCategory !== result.category
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: result.type,
          amount: result.amount,
          category,
          description: result.description,
          date: new Date().toISOString().slice(0, 10),
          trip_id: activeTrip?.id ?? null,
        }),
      })
      if (!res.ok) throw new Error()
      saveExample(lastInputRef.current || result.description, { ...result, category }, wasCorrection)
      setInput('')
      lastInputRef.current = ''
      setParsed(null)
      showToast('✓ Logged')
    } catch {
      showToast('Failed to log')
    } finally {
      setSubmitting(false)
    }
  }

  async function submit(overrideCategory?: string) {
    if (!parsed || parsed.amount <= 0) return
    await submitTransaction(parsed, overrideCategory)
  }

  async function chipTap(chip: Chip) {
    await submitTransaction({
      amount: chip.amount,
      category: chip.category,
      description: chip.description,
      type: 'expense',
      confidence: 'high',
    })
  }

  // Auto-submit after 1.5s of idle when parse is high-confidence
  useEffect(() => {
    if (autoSubmitRef.current) {
      clearTimeout(autoSubmitRef.current)
      autoSubmitRef.current = null
    }
    setAutoCountdown(false)
    if (!parsed || parsed.confidence !== 'high' || parsed.amount <= 0 || submitting) return
    setAutoCountdown(true)
    const id = setTimeout(() => {
      setAutoCountdown(false)
      autoSubmitRef.current = null
      void submitTransaction(parsed)
    }, 1500)
    autoSubmitRef.current = id
    return () => {
      clearTimeout(id)
      if (autoSubmitRef.current === id) autoSubmitRef.current = null
    }
  }, [parsed, submitting, input])

  function cancelAutoSubmit() {
    if (autoSubmitRef.current) {
      clearTimeout(autoSubmitRef.current)
      autoSubmitRef.current = null
    }
    setAutoCountdown(false)
  }

  const catForType = getCategoriesForType(parsed?.type ?? 'expense')
  const chips = getSmartChips(chipTxns)

  // Hide on routes that have their own input (form pages)
  if (pathname?.startsWith('/add')) return null

  return (
    <div className="fixed left-0 right-0 z-40 px-4" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
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
          {parsed.confidence === 'low' && (
            <div className="w-full flex gap-1.5 mt-1 overflow-x-auto pb-0.5">
              {catForType.map(c => (
                <button
                  key={c.id}
                  onClick={() => submit(c.id)}
                  className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[11px] bg-slate-700/60 text-slate-300 border border-slate-600/40"
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Smart chips */}
      {!parsed && chips.length > 0 && (
        <div className="flex gap-1.5 mb-2 overflow-x-auto pb-0.5">
          {chips.map((c, i) => (
            <button
              key={i}
              onClick={() => chipTap(c)}
              className="flex-shrink-0 px-2.5 py-1 rounded-2xl text-[11px] border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 whitespace-nowrap"
            >
              {getCategoryById(c.category)?.emoji} {c.description}
            </button>
          ))}
        </div>
      )}

      {/* Main bar */}
      <div className={`glass-accent flex items-center gap-2 rounded-3xl px-4 py-3 shadow-2xl shadow-black/70 transition-all duration-300 ${!parsed && !loading ? 'ai-bar-idle' : ''}`}>
        <VoiceInput
          onTranscript={t => { setInput(t); lastInputRef.current = t }}
          onError={msg => showToast(msg)}
        />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); lastInputRef.current = e.target.value }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="e.g. coffee 80, salary 50000…"
          className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 outline-none"
          style={{ fontSize: 16 }}
        />
        {loading && (
          <span className="w-8 h-8 flex items-center justify-center text-indigo-400 text-base select-none animate-spin">
            ↻
          </span>
        )}
        {!loading && parsed && parsed.amount > 0 && (
          <button
            onClick={() => submit()}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm text-indigo-400"
          >
            ➤
          </button>
        )}
      </div>
    </div>
  )
}
