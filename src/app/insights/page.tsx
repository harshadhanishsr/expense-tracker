// src/app/insights/page.tsx
export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '@/lib/supabase'
import BarChart from '@/components/BarChart'
import InsightsPeriodToggle from '@/components/InsightsPeriodToggle'
import InsightCategoryCard from '@/components/InsightCategoryCard'
import CategoryBars from '@/components/CategoryBars'
import BottomNav from '@/components/BottomNav'
import type { Transaction } from '@/lib/types'

type Period = 'week' | 'month' | 'year'

function getPeriodBounds(period: Period) {
  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth()
  const today = now.toISOString().slice(0, 10)

  if (period === 'week') {
    const day = now.getDay()
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7))
    const prevMonday = new Date(monday); prevMonday.setDate(monday.getDate() - 7)
    const prevSunday = new Date(monday); prevSunday.setDate(monday.getDate() - 1)
    return {
      current: { start: monday.toISOString().slice(0,10), end: today, label: 'This Week' },
      previous: { start: prevMonday.toISOString().slice(0,10), end: prevSunday.toISOString().slice(0,10), label: 'Last Week' },
    }
  }
  if (period === 'month') {
    const firstOfMonth = `${y}-${String(mo+1).padStart(2,'0')}-01`
    const firstOfPrev = new Date(y, mo-1, 1)
    const lastOfPrev = new Date(y, mo, 0)
    return {
      current: { start: firstOfMonth, end: today, label: 'This Month' },
      previous: { start: firstOfPrev.toISOString().slice(0,10), end: lastOfPrev.toISOString().slice(0,10), label: 'Last Month' },
    }
  }
  return {
    current: { start: `${y}-01-01`, end: today, label: 'This Year' },
    previous: { start: `${y-1}-01-01`, end: `${y-1}-12-31`, label: 'Last Year' },
  }
}

function totalExpense(txs: Transaction[]) {
  return txs.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
}

function categoryTotals(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of txs.filter(t => t.type === 'expense')) {
    out[t.category] = (out[t.category] ?? 0) + Number(t.amount)
  }
  return out
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams
  const period = (['week','month','year'].includes(params.period ?? '') ? params.period : 'month') as Period

  const bounds = getPeriodBounds(period)

  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const { data } = await getSupabaseAdmin()
    .from('transactions').select('*')
    .gte('date', sixMonthsAgo.toISOString().slice(0, 10))
    .lte('date', new Date().toISOString().slice(0, 10))
    .order('date', { ascending: false })

  const allTxs = (data ?? []) as Transaction[]
  const currentTxs = allTxs.filter(t => t.date >= bounds.current.start && t.date <= bounds.current.end)
  const previousTxs = allTxs.filter(t => t.date >= bounds.previous.start && t.date <= bounds.previous.end)

  const currentTotal = totalExpense(currentTxs)
  const previousTotal = totalExpense(previousTxs)

  const monthlyBars = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    return {
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      current: totalExpense(allTxs.filter(t => t.date.startsWith(key))),
      previous: 0,
    }
  })

  const catTotals = categoryTotals(currentTxs)
  const catEntries = Object.entries(catTotals).sort((a,b) => b[1]-a[1])
  const mostSpent = catEntries[0]
  const leastSpent = catEntries.filter(([,v]) => v > 0).at(-1)

  const maxMonthly = Math.max(...monthlyBars.map(b => b.current), 1)
  const maxPeriod = Math.max(currentTotal, previousTotal, 1)
  const pctChange = previousTotal > 0 ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100) : null

  function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

  return (
    <main className="min-h-screen bg-slate-950 pb-28">
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 pt-14 pb-6 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 blur-xl" />
        <div className="max-w-lg mx-auto relative">
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">Analytics</p>
          <h1 className="text-white text-2xl font-bold mb-4">Insights</h1>
          <InsightsPeriodToggle period={period} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Period comparison */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {bounds.current.label} vs {bounds.previous.label}
            </h2>
            {pctChange !== null && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pctChange > 0 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                {pctChange > 0 ? '↑' : '↓'} {Math.abs(pctChange)}%
              </span>
            )}
          </div>
          <div className="flex gap-4 mb-4 text-xs">
            <span className="text-slate-500">{bounds.previous.label}: <span className="text-slate-300 font-semibold">{fmt(previousTotal)}</span></span>
            <span className="text-slate-500">{bounds.current.label}: <span className="text-blue-300 font-semibold">{fmt(currentTotal)}</span></span>
          </div>
          <BarChart
            bars={[
              { label: bounds.previous.label, current: 0, previous: previousTotal },
              { label: bounds.current.label, current: currentTotal, previous: 0 },
            ]}
            maxValue={maxPeriod}
          />
        </div>

        {/* 6-month trend */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">6-Month Trend</h2>
          <BarChart bars={monthlyBars} maxValue={maxMonthly} />
        </div>

        {/* Most / Least */}
        {mostSpent && leastSpent && (
          <div className="grid grid-cols-2 gap-3">
            <InsightCategoryCard title="Most Spent" categoryId={mostSpent[0]} amount={mostSpent[1]}
              pct={currentTotal > 0 ? Math.round((mostSpent[1]/currentTotal)*100) : 0} />
            <InsightCategoryCard title="Least Spent" categoryId={leastSpent[0]} amount={leastSpent[1]}
              pct={currentTotal > 0 ? Math.round((leastSpent[1]/currentTotal)*100) : 0} />
          </div>
        )}

        {/* Category breakdown */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Category Breakdown</h2>
          <CategoryBars transactions={currentTxs} />
        </div>

      </div>
      <BottomNav />
    </main>
  )
}
