// src/components/BentoCategoryGrid.tsx
import type { Transaction } from '@/lib/types'
import { getCategoryById } from '@/lib/categories'

interface Props {
  transactions: Transaction[]
  prevMonthTransactions: Transaction[]
}

function catTotals(txns: Transaction[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of txns) {
    if (t.type !== 'expense') continue
    m.set(t.category, (m.get(t.category) ?? 0) + Number(t.amount))
  }
  return m
}

export default function BentoCategoryGrid({ transactions, prevMonthTransactions }: Props) {
  const cur = catTotals(transactions)
  const prev = catTotals(prevMonthTransactions)
  const top4 = [...cur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const max = top4[0]?.[1] ?? 1

  if (top4.length === 0) {
    return (
      <div className="text-center py-6 text-white/20 text-sm">No expenses this month</div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {top4.map(([id, amount]) => {
        const cat = getCategoryById(id)
        const prevAmt = prev.get(id) ?? 0
        const delta = amount - prevAmt
        const pct = Math.round((amount / max) * 100)
        return (
          <div
            key={id}
            className="rounded-2xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-xl mb-1">{cat?.emoji ?? '📦'}</div>
            <div className="text-[11px] text-white/40 mb-0.5">{cat?.label ?? id}</div>
            <div className="text-sm font-bold text-white">
              ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            {prevAmt > 0 && (
              <div className={`text-[10px] mt-0.5 font-medium ${delta > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                {delta > 0 ? '+' : ''}₹{Math.abs(delta).toLocaleString('en-IN', { maximumFractionDigits: 0 })} vs last month
              </div>
            )}
            <div className="h-[3px] rounded-full mt-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-[3px] rounded-full"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#ff6b35,#ff9f00)' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
