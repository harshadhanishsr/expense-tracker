// src/components/RecurringSection.tsx
import { getCategoryById, CATEGORY_COLORS } from '@/lib/categories'
import type { Transaction } from '@/lib/types'

function fmt(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default function RecurringSection({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) return null

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-xs">🔁</div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recurring</h2>
      </div>
      <div className="space-y-2">
        {transactions.map(t => {
          const cat = getCategoryById(t.category)
          const colors = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS['other_expense']
          return (
            <div key={t.id} className="flex items-center justify-between bg-slate-800/40 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center text-base`}>
                  {cat?.emoji ?? '📦'}
                </div>
                <div>
                  <p className="text-white text-sm font-medium leading-tight">{t.description || cat?.label || t.category}</p>
                  <span className="text-xs text-slate-500 capitalize">{t.recurrence_interval}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold tabular-nums ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </span>
                <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-medium capitalize">
                  {t.recurrence_interval}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
