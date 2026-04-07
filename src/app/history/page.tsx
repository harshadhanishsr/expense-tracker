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
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-800 text-white px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold mb-4">Transaction History</h1>
          <input type="text" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-700 text-white placeholder:text-slate-400 rounded-xl px-4 py-2.5 text-sm outline-none mb-3" />
          <div className="flex gap-2">
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none flex-1">
              {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
            {(['all','income','expense'] as const).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${typeFilter===f?'bg-blue-500 text-white':'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >{f}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-4">
        {loading ? <p className="text-slate-400 text-sm text-center py-8">Loading...</p> :
          <div className="bg-white rounded-xl shadow-sm px-4">
            <TransactionList transactions={transactions} onDelete={handleDelete} />
          </div>
        }
      </div>
      <BottomNav />
    </main>
  )
}
