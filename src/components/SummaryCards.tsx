function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SummaryCards({ income, expenses }: { income: number; expenses: number }) {
  const balance = income - expenses
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white rounded-xl p-4 border-l-4 border-green-500 shadow-sm">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Income</p>
        <p className="text-lg font-bold text-green-600">{fmt(income)}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border-l-4 border-red-500 shadow-sm">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Expenses</p>
        <p className="text-lg font-bold text-red-500">{fmt(expenses)}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border-l-4 border-blue-500 shadow-sm">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Balance</p>
        <p className={`text-lg font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmt(balance)}</p>
      </div>
    </div>
  )
}
