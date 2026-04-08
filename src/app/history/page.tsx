// src/app/history/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import TransactionList from '@/components/TransactionList'
import BottomNav from '@/components/BottomNav'

interface Transaction { id: string; type: 'income'|'expense'; amount: number; category: string; description?: string; date: string }

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

  return (
    <main className="min-h-screen bg-slate-950 pb-28">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 pt-14 pb-6 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 blur-xl" />
        <div className="max-w-lg mx-auto relative">
          <h1 className="text-white text-xl font-bold mb-4">History</h1>
          <input type="text" placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/10 text-white placeholder:text-blue-300/60 rounded-xl px-4 py-3 text-sm outline-none mb-3 border border-white/15 focus:border-white/30 focus:bg-white/15 transition-all" />
          <div className="flex gap-2">
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="bg-white/10 text-white rounded-xl px-3 py-2.5 text-sm outline-none flex-1 border border-white/15 focus:border-white/30 transition-all">
              {monthOptions.map(o => <option key={o.val} value={o.val} className="bg-slate-900 text-white">{o.label}</option>)}
            </select>
            {(['all','income','expense'] as const).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all active:scale-95
                  ${typeFilter===f ? 'bg-white text-blue-700 shadow-lg' : 'bg-white/10 text-blue-100 hover:bg-white/20'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-900/60 rounded-2xl" />
            ))}
          </div>
        ) : (
          <TransactionList transactions={transactions} onDelete={handleDelete} />
        )}
      </div>
      <BottomNav />
    </main>
  )
}
