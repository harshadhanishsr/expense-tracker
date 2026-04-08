// src/components/SummaryCards.tsx
function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SummaryCards({ income, expenses }: { income: number; expenses: number }) {
  const balance = income - expenses
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-base">↑</span>
          <p className="text-xs text-emerald-400/70 font-semibold uppercase tracking-wider">Income</p>
        </div>
        <p className="text-emerald-400 font-bold text-sm tabular-nums">{fmt(income)}</p>
      </div>
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-base">↓</span>
          <p className="text-xs text-red-400/70 font-semibold uppercase tracking-wider">Spent</p>
        </div>
        <p className="text-red-400 font-bold text-sm tabular-nums">{fmt(expenses)}</p>
      </div>
      <div className={`${balance >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'} border rounded-2xl p-4`}>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-base">◎</span>
          <p className={`text-xs font-semibold uppercase tracking-wider ${balance >= 0 ? 'text-blue-400/70' : 'text-red-400/70'}`}>Left</p>
        </div>
        <p className={`font-bold text-sm tabular-nums ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(balance)}</p>
      </div>
    </div>
  )
}
