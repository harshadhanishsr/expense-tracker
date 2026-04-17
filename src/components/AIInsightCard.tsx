// src/components/AIInsightCard.tsx
'use client'
import { useState, useEffect } from 'react'
import { detectInsights } from '@/lib/patternEngine'
import { useTripContext } from '@/lib/tripContext'
import type { Transaction, Insight } from '@/lib/types'
import SpendingHeatmap from './SpendingHeatmap'

export default function AIInsightCard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [insight, setInsight] = useState<Insight | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [digestBody, setDigestBody] = useState('')
  const { setPendingPrefill } = useTripContext()

  useEffect(() => {
    // Prune dismissal keys older than 60 days on mount
    if (typeof window !== 'undefined') {
      const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('expense-tracker:dismissed:')) {
          try {
            const { dismissedAt } = JSON.parse(localStorage.getItem(key) ?? '{}')
            if (dismissedAt < cutoff) localStorage.removeItem(key)
          } catch {
            localStorage.removeItem(key)
          }
        }
      }
    }

    fetch('/api/transactions/recent?days=90')
      .then(r => r.json())
      .then(d => setTransactions(d.transactions ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (transactions.length === 0) return
    const today = new Date()
    const insights = detectInsights(transactions, today)
    const active = insights.find(ins => {
      const k = `expense-tracker:dismissed:${ins.dismissKey}`
      return !localStorage.getItem(k)
    })
    if (!active) return
    setInsight(active)

    if (active.type === 'digest') {
      // Compute weekly stats for the digest prompt
      const monOffset = (today.getDay() + 6) % 7
      const monday = new Date(today)
      monday.setDate(today.getDate() - monOffset)
      monday.setHours(0, 0, 0, 0)
      const prevMon = new Date(monday)
      prevMon.setDate(prevMon.getDate() - 7)

      const thisWeek = transactions.filter(
        t => new Date(t.date) >= monday && t.type === 'expense'
      )
      const prevWeek = transactions.filter(t => {
        const d = new Date(t.date)
        return d >= prevMon && d < monday && t.type === 'expense'
      })

      const weekTotal = thisWeek.reduce((s, t) => s + Number(t.amount), 0)
      const prevWeekTotal = prevWeek.reduce((s, t) => s + Number(t.amount), 0)
      const catMap = new Map<string, number>()
      for (const t of thisWeek) catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount))
      const [topCat, topAmt] = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]

      fetch('/api/ai/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekTotal, topCategory: topCat, topCategoryAmount: topAmt, prevWeekTotal }),
      })
        .then(r => r.json())
        .then(d => setDigestBody(d.text ?? ''))
        .catch(() => {
          setDigestBody(
            `Last week: ₹${weekTotal.toLocaleString('en-IN')} spent. ${topCat} was biggest (₹${topAmt.toLocaleString('en-IN')}).`
          )
        })
    }
  }, [transactions])

  function dismiss() {
    if (!insight) return
    localStorage.setItem(
      `expense-tracker:dismissed:${insight.dismissKey}`,
      JSON.stringify({ dismissedAt: Date.now() })
    )
    setDismissed(true)
  }

  const body = insight?.type === 'digest' ? digestBody : (insight?.body ?? '')
  const show = insight && !dismissed && (insight.type !== 'digest' || body)

  return (
    <div className="space-y-2">
      {show && (
        <div
          className="relative rounded-[20px] px-4 py-3"
          style={{
            background: 'rgba(255,107,53,0.08)',
            border: '1px solid rgba(255,107,53,0.25)',
            maxHeight: 90,
            overflow: 'hidden',
          }}
        >
          <div className="flex items-start gap-2">
            <span
              className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: '#ff6b35',
                animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/80 leading-[1.55] line-clamp-2">{body}</p>
              {insight.action && (
                <button
                  className="mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    background: 'rgba(255,107,53,0.18)',
                    border: '1px solid rgba(255,107,53,0.35)',
                    color: '#ff9060',
                  }}
                  onClick={() => {
                    setPendingPrefill(insight.action!.prefill)
                    dismiss()
                  }}
                >
                  {insight.action.label}
                </button>
              )}
            </div>
            <button
              onClick={dismiss}
              className="text-white/25 hover:text-white/50 text-sm ml-1 flex-shrink-0 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <SpendingHeatmap transactions={transactions} />
    </div>
  )
}
