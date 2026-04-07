// src/components/CategoryDayGrid.tsx
import { CATEGORIES } from '@/lib/categories'
import type { Transaction } from '@/lib/types'

export default function CategoryDayGrid({ transactions }: { transactions: Transaction[] }) {
  const expenseCategories = CATEGORIES.filter(c => c.type === 'expense')
  const totals: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === 'expense')) {
    totals[t.category] = (totals[t.category] ?? 0) + Number(t.amount)
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {expenseCategories.map(cat => {
        const amount = totals[cat.id] ?? 0
        const hasSpend = amount > 0
        return (
          <div key={cat.id} className={`rounded-xl p-2 text-center transition-opacity ${hasSpend ? 'opacity-100' : 'opacity-30'}`}>
            <div className="text-lg">{cat.emoji}</div>
            <div className="text-slate-500 text-[10px] mt-1 leading-tight">{cat.label}</div>
            <div className={`text-[11px] font-semibold mt-1 ${hasSpend ? 'text-red-400' : 'text-slate-600'}`}>
              {hasSpend ? `₹${amount.toLocaleString('en-IN')}` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
