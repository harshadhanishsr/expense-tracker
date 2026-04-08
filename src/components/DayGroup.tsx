// src/components/DayGroup.tsx
import CategoryDayGrid from '@/components/CategoryDayGrid'
import type { Transaction } from '@/lib/types'

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default function DayGroup({ label, transactions }: { label: string; transactions: Transaction[] }) {
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
  const isToday = label === 'Today'

  return (
    <div className={`rounded-2xl overflow-hidden border transition-all
      ${isToday
        ? 'bg-blue-950/40 border-blue-800/50'
        : 'bg-slate-900/60 border-slate-800'}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {isToday && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
          <span className={`font-bold text-sm ${isToday ? 'text-blue-300' : 'text-slate-300'}`}>{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {totalIncome > 0 && <span className="text-emerald-400 text-xs font-bold tabular-nums">+{fmt(totalIncome)}</span>}
          {totalExpense > 0 && <span className="text-red-400 text-xs font-bold tabular-nums">-{fmt(totalExpense)}</span>}
        </div>
      </div>
      <div className="px-3 pb-3">
        <CategoryDayGrid transactions={transactions} />
      </div>
    </div>
  )
}
