// src/components/InsightsPeriodToggle.tsx
'use client'
import { useRouter, usePathname } from 'next/navigation'

type Period = 'week' | 'month' | 'year'

export default function InsightsPeriodToggle({ period }: { period: Period }) {
  const router = useRouter()
  const pathname = usePathname()
  const periods: Period[] = ['week', 'month', 'year']

  return (
    <div className="flex bg-white/10 rounded-xl p-1 mt-3">
      {periods.map(p => (
        <button key={p} onClick={() => router.push(`${pathname}?period=${p}`)}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${p === period ? 'bg-white text-blue-700' : 'text-blue-100 hover:text-white'}`}
        >{p}</button>
      ))}
    </div>
  )
}
