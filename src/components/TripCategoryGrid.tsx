import { Transaction } from '@/lib/types'
import { getCategoryById } from '@/lib/categories'

interface Props { transactions: Transaction[] }

export default function TripCategoryGrid({ transactions }: Props) {
  const expenses = transactions.filter(t => t.type === 'expense')
  const byCategory: Record<string, number> = {}
  for (const t of expenses) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount
  }
  const top4 = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
  const max = top4[0]?.[1] ?? 1

  if (!top4.length) return <p className="text-slate-500 text-sm px-4">No expenses yet.</p>

  return (
    <div className="grid grid-cols-2 gap-2 mx-4">
      {top4.map(([catId, total]) => {
        const cat = getCategoryById(catId)
        const count = expenses.filter(t => t.category === catId).length
        const barPct = Math.round((total / max) * 100)
        return (
          <div key={catId} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
            <div className="text-2xl">{cat?.emoji ?? '📦'}</div>
            <div className="text-[11px] text-slate-500 mt-1.5">{cat?.label ?? catId}</div>
            <div className="text-lg font-black text-white mt-0.5">₹{total.toLocaleString()}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{count} expense{count !== 1 ? 's' : ''}</div>
            <div className="mt-2 h-0.5 rounded-full bg-white/[0.08]">
              <div className="h-0.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#a78bfa]"
                style={{ width: `${barPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
