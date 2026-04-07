// src/components/BarChart.tsx
'use client'

interface Bar {
  label: string
  current: number
  previous: number
}

export default function BarChart({ bars, maxValue }: { bars: Bar[]; maxValue: number }) {
  const max = Math.max(maxValue, 1)

  return (
    <div className="flex items-end gap-2 h-28">
      {bars.map((bar, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end gap-0.5 h-20">
            <div className="flex-1 bg-slate-700 rounded-t-sm transition-all"
              style={{ height: `${Math.round((bar.previous / max) * 100)}%`, minHeight: bar.previous > 0 ? '4px' : '0' }} />
            <div className="flex-1 bg-blue-500 rounded-t-sm transition-all"
              style={{ height: `${Math.round((bar.current / max) * 100)}%`, minHeight: bar.current > 0 ? '4px' : '0' }} />
          </div>
          <span className="text-slate-500 text-[10px] text-center leading-tight">{bar.label}</span>
        </div>
      ))}
    </div>
  )
}
