// src/components/DayGroup.tsx
import CategoryDayGrid from '@/components/CategoryDayGrid'
import type { Transaction } from '@/lib/types'

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN') }

export default function DayGroup({ label, transactions }: { label: string; transactions: Transaction[] }) {
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <span className="text-white font-semibold text-sm">{label}</span>
        <div className="flex items-center gap-3">
          {totalIncome > 0 && <span className="text-green-400 text-sm font-semibold">+{fmt(totalIncome)}</span>}
          {totalExpense > 0 && <span className="text-red-400 text-sm font-semibold">-{fmt(totalExpense)}</span>}
        </div>
      </div>
      <div className="p-3">
        <CategoryDayGrid transactions={transactions} />
      </div>
    </div>
  )
}
