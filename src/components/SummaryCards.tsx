// src/components/SummaryCards.tsx
function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SummaryCards({ income, expenses }: { income: number; expenses: number }) {
  const balance = income - expenses
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 border-l-4 border-l-green-500">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Income</p>
        <p className="text-base font-bold text-green-400">{fmt(income)}</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 border-l-4 border-l-red-500">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Spent</p>
        <p className="text-base font-bold text-red-400">{fmt(expenses)}</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 border-l-4 border-l-blue-500">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Balance</p>
        <p className={`text-base font-bold ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(balance)}</p>
      </div>
    </div>
  )
}
