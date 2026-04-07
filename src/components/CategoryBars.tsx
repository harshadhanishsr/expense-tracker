import { getCategoryById } from '@/lib/categories'

interface Transaction { type: string; amount: number; category: string }

export default function CategoryBars({ transactions }: { transactions: Transaction[] }) {
  const totals: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === 'expense')) {
    totals[t.category] = (totals[t.category] ?? 0) + Number(t.amount)
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const max = sorted[0]?.[1] ?? 1
  if (!sorted.length) return <p className="text-slate-400 text-sm text-center py-4">No expenses this month</p>
  return (
    <div className="space-y-3">
      {sorted.map(([id, total]) => {
        const cat = getCategoryById(id)
        return (
          <div key={id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-700">{cat?.emoji} {cat?.label ?? id}</span>
              <span className="text-slate-500">₹{total.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-red-100 rounded-full h-2">
              <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.round((total/max)*100)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
