'use client'
import Link from 'next/link'
import { getCategoryById, CATEGORY_COLORS } from '@/lib/categories'

interface Transaction { id: string; type: 'income'|'expense'; amount: number; category: string; description?: string | null; date: string }

function fmt(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function formatDate(d: string) {
  const date = new Date(d + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d === today.toISOString().slice(0,10)) return 'Today'
  if (d === yesterday.toISOString().slice(0,10)) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function TransactionList({ transactions, onDelete, limit, showRepeat }: {
  transactions: Transaction[]
  onDelete?: (id: string) => void
  limit?: number
  showRepeat?: boolean
}) {
  const rows = limit ? transactions.slice(0, limit) : transactions
  if (!rows.length) return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <span className="text-4xl opacity-30">💸</span>
      <p className="text-slate-500 text-sm">No transactions yet</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {rows.map(t => {
        const cat = getCategoryById(t.category)
        const colors = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS['other_expense']
        return (
          <div key={t.id}
            className="group flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-11 h-11 rounded-2xl ${colors.bg} flex items-center justify-center flex-shrink-0 text-xl`}>
                {cat?.emoji ?? '📦'}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate leading-tight">
                  {t.description || cat?.label || t.category}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {cat?.label ?? t.category} · {formatDate(t.date)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <span className={`text-sm font-bold tabular-nums ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </span>
              {showRepeat && (
                <Link
                  href={`/add?type=${t.type}&amount=${t.amount}&category=${t.category}&description=${encodeURIComponent(t.description || '')}`}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200 text-sm"
                  title="Repeat this transaction">↺</Link>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(t.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200 text-lg leading-none"
                  aria-label="Delete">×</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
