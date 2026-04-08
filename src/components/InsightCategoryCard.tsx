// src/components/InsightCategoryCard.tsx
import { getCategoryById, CATEGORY_COLORS } from '@/lib/categories'

interface Props {
  title: 'Most Spent' | 'Least Spent'
  categoryId: string
  amount: number
  pct: number
}

export default function InsightCategoryCard({ title, categoryId, amount, pct }: Props) {
  const cat = getCategoryById(categoryId)
  const colors = CATEGORY_COLORS[categoryId] ?? CATEGORY_COLORS['other_expense']
  const isMost = title === 'Most Spent'

  return (
    <div className={`rounded-2xl p-4 text-center border
      ${isMost ? 'bg-red-950/30 border-red-900/50' : 'bg-emerald-950/30 border-emerald-900/50'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isMost ? 'text-red-400' : 'text-emerald-400'}`}>
        {title}
      </p>
      <div className={`w-12 h-12 rounded-2xl ${colors.bg} flex items-center justify-center text-2xl mx-auto mb-2`}>
        {cat?.emoji ?? '📦'}
      </div>
      <p className="text-white text-sm font-bold">{cat?.label ?? categoryId}</p>
      <p className={`text-lg font-extrabold mt-1 tabular-nums ${isMost ? 'text-red-400' : 'text-emerald-400'}`}>
        ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </p>
      <p className="text-slate-500 text-xs mt-1">{pct}% of spend</p>
    </div>
  )
}
