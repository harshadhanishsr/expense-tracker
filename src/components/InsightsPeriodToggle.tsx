'use client'
import { useRouter, usePathname } from 'next/navigation'

type Period = 'week' | 'month' | 'year'

export default function InsightsPeriodToggle({ period }: { period: Period }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="flex gap-2">
      {(['week', 'month', 'year'] as Period[]).map(p => (
        <button
          key={p}
          onClick={() => router.push(`${pathname}?period=${p}`)}
          className="flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all"
          style={{
            background: p === period ? '#ff6b35' : 'rgba(255,255,255,0.06)',
            color: p === period ? '#fff' : 'rgba(255,255,255,0.4)',
            border: `1px solid ${p === period ? '#ff6b35' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
