// src/components/InsightCategoryCard.tsx
import { getCategoryById } from '@/lib/categories'

interface Props {
  title: 'Most Spent' | 'Least Spent'
  categoryId: string
  amount: number
  pct: number
}

export default function InsightCategoryCard({ title, categoryId, amount, pct }: Props) {
  const cat = getCategoryById(categoryId)
  const isMost = title === 'Most Spent'

  return (
    <div className={`bg-slate-800 border rounded-xl p-4 text-center ${isMost ? 'border-red-500/30' : 'border-green-500/30'}`}>
      <p className={`text-xs uppercase tracking-wide mb-2 ${isMost ? 'text-red-400' : 'text-green-400'}`}>{title}</p>
      <div className="text-2xl mb-1">{cat?.emoji ?? '📦'}</div>
      <p className="text-white text-sm font-semibold">{cat?.label ?? categoryId}</p>
      <p className={`text-lg font-bold mt-1 ${isMost ? 'text-red-400' : 'text-green-400'}`}>
        ₹{amount.toLocaleString('en-IN')}
      </p>
      <p className="text-slate-500 text-xs mt-1">{pct}% of spend</p>
    </div>
  )
}
