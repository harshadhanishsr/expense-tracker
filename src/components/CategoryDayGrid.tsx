// src/components/CategoryDayGrid.tsx
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/categories'
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
        const colors = CATEGORY_COLORS[cat.id] ?? CATEGORY_COLORS['other_expense']
        return (
          <div key={cat.id}
            className={`rounded-xl p-2.5 text-center transition-all duration-200
              ${hasSpend ? `${colors.bg} border border-current/10` : 'bg-slate-800/30 opacity-35'}`}>
            <div className="text-xl leading-none">{cat.emoji}</div>
            <div className="text-slate-400 text-[9px] mt-1.5 leading-tight font-medium">{cat.label}</div>
            <div className={`text-[10px] font-bold mt-1 tabular-nums ${hasSpend ? colors.text : 'text-slate-600'}`}>
              {hasSpend ? `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
