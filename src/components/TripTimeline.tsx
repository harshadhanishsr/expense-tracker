import { Transaction } from '@/lib/types'
import { getCategoryById } from '@/lib/categories'

interface Props { transactions: Transaction[] }

export default function TripTimeline({ transactions }: Props) {
  const byDate: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (!byDate[t.date]) byDate[t.date] = []
    byDate[t.date].push(t)
  }
  const days = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  if (!days.length) return <p className="text-slate-500 text-sm px-4 mt-4">No entries yet.</p>

  return (
    <div className="px-4 mt-4">
      {days.map((date, i) => {
        const dayTransactions = byDate[date]
        const dayTotal = dayTransactions
          .filter(t => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0)
        return (
          <div key={date} className={i > 0 ? 'mt-4' : ''}>
            <div className="flex justify-between text-[11px] text-slate-500 mb-2">
              <span>📅 {date}</span>
              <span className="text-rose-400">₹{dayTotal.toLocaleString()}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {dayTransactions.map(t => {
                const cat = getCategoryById(t.category)
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06]
                    bg-white/[0.03] px-3 py-2.5">
                    <span className="text-base">{cat?.emoji ?? '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-300 truncate">{t.description || cat?.label}</div>
                      <div className="text-[10px] text-slate-600">{cat?.label}</div>
                    </div>
                    <span className="text-sm font-bold text-rose-400">
                      ₹{t.amount.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
