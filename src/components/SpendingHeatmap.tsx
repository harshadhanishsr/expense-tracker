// src/components/SpendingHeatmap.tsx
import type { Transaction } from '@/lib/types'

interface Props { transactions: Transaction[] }

export default function SpendingHeatmap({ transactions }: Props) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // Build 21-day array ending today
  const days: string[] = []
  for (let i = 20; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  // Sum daily expense spend
  const dailySpend = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    dailySpend.set(t.date, (dailySpend.get(t.date) ?? 0) + Number(t.amount))
  }

  const amounts = days.map(d => dailySpend.get(d) ?? 0)
  const nonZero = amounts.filter(a => a > 0)
  const avg = nonZero.length > 0 ? nonZero.reduce((s, a) => s + a, 0) / nonZero.length : 0

  function cellColor(amount: number): string {
    if (amount === 0) return 'rgba(255,255,255,0.04)'
    if (avg === 0) return 'rgba(99,102,241,0.25)'
    if (amount < avg * 0.8) return 'rgba(99,102,241,0.25)'
    if (amount < avg * 1.2) return 'rgba(99,102,241,0.50)'
    if (amount < avg * 1.5) return 'rgba(139,92,246,0.70)'
    return 'rgba(167,139,250,0.90)'
  }

  return (
    <div className="px-1 py-2">
      <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-2">Last 21 days</p>
      <div className="grid grid-cols-7 gap-1">
        {days.map(ds => {
          const amt = dailySpend.get(ds) ?? 0
          const isToday = ds === todayStr
          return (
            <div
              key={ds}
              title={`${ds}: ₹${amt.toLocaleString('en-IN')}`}
              style={{
                background: cellColor(amt),
                borderRadius: 5,
                height: 18,
                boxShadow: isToday ? '0 0 0 2px #818cf8' : undefined,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
