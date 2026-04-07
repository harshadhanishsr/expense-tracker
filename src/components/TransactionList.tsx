'use client'
import { getCategoryById } from '@/lib/categories'

interface Transaction { id: string; type: 'income'|'expense'; amount: number; category: string; description?: string; date: string }

export default function TransactionList({ transactions, onDelete, limit }: { transactions: Transaction[]; onDelete?: (id: string) => void; limit?: number }) {
  const rows = limit ? transactions.slice(0, limit) : transactions
  if (!rows.length) return <p className="text-slate-400 text-sm text-center py-6">No transactions yet</p>
  return (
    <div className="divide-y divide-slate-100">
      {rows.map(t => {
        const cat = getCategoryById(t.category)
        return (
          <div key={t.id} className="flex items-center justify-between py-3 px-1">
            <div className="flex-1 min-w-0">
              <p className="text-slate-800 font-medium text-sm truncate">{t.description || cat?.label || t.category}</p>
              <p className="text-slate-400 text-xs">{cat?.emoji} {cat?.label ?? t.category} · {t.date}</p>
            </div>
            <div className="flex items-center gap-3 ml-3">
              <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                {t.type === 'income' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
              </span>
              {onDelete && (
                <button onClick={() => onDelete(t.id)} className="text-slate-300 hover:text-red-400 text-lg leading-none" aria-label="Delete">×</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
