'use client'

interface Bar {
  label: string
  current: number
  previous: number
}

export default function BarChart({ bars, maxValue }: { bars: Bar[]; maxValue: number }) {
  const max = Math.max(maxValue, 1)

  return (
    <div className="flex items-end gap-2 h-32">
      {bars.map((bar, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end gap-1 h-24">
            {bar.previous > 0 && (
              <div className="flex-1 bg-slate-700/80 rounded-t-lg transition-all duration-500"
                style={{ height: `${Math.round((bar.previous / max) * 100)}%`, minHeight: '4px' }} />
            )}
            {bar.current > 0 && (
              <div className="flex-1 bg-gradient-to-t from-teal-700 to-emerald-400 rounded-t-lg transition-all duration-500 shadow-lg shadow-teal-500/20"
                style={{ height: `${Math.round((bar.current / max) * 100)}%`, minHeight: '4px' }} />
            )}
            {bar.previous === 0 && bar.current === 0 && (
              <div className="flex-1 bg-slate-800/50 rounded-t-lg" style={{ height: '4px' }} />
            )}
          </div>
          <span className="text-slate-500 text-[10px] text-center leading-tight font-medium">{bar.label}</span>
        </div>
      ))}
    </div>
  )
}
