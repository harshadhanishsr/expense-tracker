// src/components/RecurringSection.tsx
import { getCategoryById } from '@/lib/categories'
import type { Transaction } from '@/lib/types'

function fmt(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN')
}

export default function RecurringSection({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) return null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Recurring</h2>
      <div className="space-y-2">
        {transactions.map(t => {
          const cat = getCategoryById(t.category)
          return (
            <div key={t.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat?.emoji ?? '📦'}</span>
                <div>
                  <p className="text-white text-sm font-medium">{t.description || cat?.label || t.category}</p>
                  <span className="text-xs text-slate-500 capitalize">{t.recurrence_interval}</span>
                </div>
              </div>
              <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
