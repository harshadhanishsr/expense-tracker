// src/components/CategoryBars.tsx
import { getCategoryById, CATEGORY_COLORS } from '@/lib/categories'

interface Transaction { type: string; amount: number; category: string }

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default function CategoryBars({ transactions }: { transactions: Transaction[] }) {
  const totals: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === 'expense')) {
    totals[t.category] = (totals[t.category] ?? 0) + Number(t.amount)
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const max = sorted[0]?.[1] ?? 1

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <span className="text-3xl opacity-30">📊</span>
        <p className="text-slate-500 text-sm">No expenses this month</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sorted.map(([id, total]) => {
        const cat = getCategoryById(id)
        const colors = CATEGORY_COLORS[id] ?? CATEGORY_COLORS['other_expense']
        const pct = Math.round((total / max) * 100)
        return (
          <div key={id} className="group">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl ${colors.bg} flex items-center justify-center text-sm`}>
                  {cat?.emoji ?? '📦'}
                </div>
                <span className="text-slate-300 text-sm font-medium">{cat?.label ?? id}</span>
              </div>
              <span className={`text-sm font-bold ${colors.text}`}>{fmt(total)}</span>
            </div>
            <div className="relative h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ease-out ${colors.bar}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
