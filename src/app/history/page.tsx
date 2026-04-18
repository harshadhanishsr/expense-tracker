// src/app/history/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import TransactionList from '@/components/TransactionList'
import BottomNav from '@/components/BottomNav'

interface Transaction { id: string; type: 'income'|'expense'; amount: number; category: string; description?: string; date: string }

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all'|'income'|'expense'>('all')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  })

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ month })
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (search) params.set('search', search)
    const res = await fetch(`/api/transactions?${params}`)
    const json = await res.json()
    setTransactions(json.transactions ?? [])
    setLoading(false)
  }, [month, typeFilter, search])

  useEffect(() => {
    const timer = setTimeout(fetchTransactions, 300)
    return () => clearTimeout(timer)
  }, [fetchTransactions])

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setTransactions(tx => tx.filter(t => t.id !== id))
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    return { val, label }
  })

  // Summary stats
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
  const shown = transactions.filter(t => typeFilter === 'all' || t.type === typeFilter)
  const shownTotal = shown.reduce((s,t) => s + Number(t.amount), 0)

  // Unique days with activity for daily avg
  const uniqueDays = new Set(transactions.filter(t => t.type === 'expense').map(t => t.date)).size
  const dailyAvg = uniqueDays > 0 ? Math.round(totalExpense / uniqueDays) : 0

  return (
    <main className="min-h-screen pb-32" style={{ background: '#0b0c15' }}>
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 0% 0%, rgba(255,107,53,0.08), transparent 50%)' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="pt-14 pb-4">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Records</p>
          <h1 className="text-white text-2xl font-bold">History</h1>
        </div>

        {/* Month selector */}
        <div className="mb-3">
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none appearance-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.8)' }}
          >
            {monthOptions.map(o => (
              <option key={o.val} value={o.val} style={{ background: '#111' }}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)' }}
          />
        </div>

        {/* Type filter pills */}
        <div className="flex gap-2 mb-4">
          {(['all', 'expense', 'income'] as const).map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className="flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all"
              style={{
                background: typeFilter === f ? '#ff6b35' : 'rgba(255,255,255,0.06)',
                color: typeFilter === f ? '#fff' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${typeFilter === f ? '#ff6b35' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Summary strip */}
        {!loading && transactions.length > 0 && (
          <div className="flex gap-2 mb-4">
            <div className="flex-1 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Spent</p>
              <p className="text-sm font-bold text-red-400 tabular-nums">{fmt(totalExpense)}</p>
            </div>
            <div className="flex-1 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Income</p>
              <p className="text-sm font-bold text-emerald-400 tabular-nums">{fmt(totalIncome)}</p>
            </div>
            <div className="flex-1 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Daily avg</p>
              <p className="text-sm font-bold text-white/70 tabular-nums">{fmt(dailyAvg)}</p>
            </div>
          </div>
        )}

        {/* Result count */}
        {!loading && shown.length > 0 && (
          <p className="text-[11px] text-white/25 mb-3">
            {shown.length} transaction{shown.length !== 1 ? 's' : ''} · {fmt(shownTotal)}
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : (
          <TransactionList transactions={shown} onDelete={handleDelete} />
        )}
      </div>

      <BottomNav />
    </main>
  )
}
