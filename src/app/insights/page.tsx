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
  const startDate = sixMonthsAgo.toISOString().slice(0, 10)
  const endDate = new Date().toISOString().slice(0, 10)

  const { data } = await getSupabaseAdmin()
    .from('transactions')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  const allTxs = (data ?? []) as Transaction[]

  const currentTxs = allTxs.filter(t => t.date >= bounds.current.start && t.date <= bounds.current.end)
  const previousTxs = allTxs.filter(t => t.date >= bounds.previous.start && t.date <= bounds.previous.end)

  const currentTotal = totalExpense(currentTxs)
  const previousTotal = totalExpense(previousTxs)

  const monthlyBars = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const monthTxs = allTxs.filter(t => t.date.startsWith(key))
    return {
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      current: totalExpense(monthTxs),
      previous: 0,
    }
  })

  const catTotals = categoryTotals(currentTxs)
  const catEntries = Object.entries(catTotals).sort((a,b) => b[1]-a[1])
  const mostSpent = catEntries[0]
  const leastSpent = catEntries.filter(([,v]) => v > 0).at(-1)

  const maxMonthly = Math.max(...monthlyBars.map(b => b.current), 1)
  const maxPeriod = Math.max(currentTotal, previousTotal, 1)

  function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

  const pctChange = previousTotal > 0
    ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
    : null

  return (
    <main className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-12 pb-6 rounded-b-3xl shadow-xl">
        <div className="max-w-lg mx-auto">
          <h1 className="text-white text-lg font-semibold">Insights</h1>
          <InsightsPeriodToggle period={period} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {bounds.current.label} vs {bounds.previous.label}
            </h2>
            {pctChange !== null && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${pctChange > 0 ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                {pctChange > 0 ? '↑' : '↓'} {Math.abs(pctChange)}%
              </span>
            )}
          </div>
          <BarChart
            bars={[
              { label: bounds.previous.label, current: 0, previous: previousTotal },
              { label: bounds.current.label, current: currentTotal, previous: 0 },
            ]}
            maxValue={maxPeriod}
          />
          <div className="flex gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-600" /><span className="text-slate-400">{bounds.previous.label}: {fmt(previousTotal)}</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-500" /><span className="text-slate-300">{bounds.current.label}: {fmt(currentTotal)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Last 6 Months</h2>
          <BarChart bars={monthlyBars} maxValue={maxMonthly} />
        </div>

        {mostSpent && leastSpent && (
          <div className="grid grid-cols-2 gap-3">
            <InsightCategoryCard title="Most Spent" categoryId={mostSpent[0]} amount={mostSpent[1]}
              pct={currentTotal > 0 ? Math.round((mostSpent[1]/currentTotal)*100) : 0} />
            <InsightCategoryCard title="Least Spent" categoryId={leastSpent[0]} amount={leastSpent[1]}
              pct={currentTotal > 0 ? Math.round((leastSpent[1]/currentTotal)*100) : 0} />
          </div>
        )}

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Breakdown by Category</h2>
          <CategoryBars transactions={currentTxs} />
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
