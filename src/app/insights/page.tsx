// src/app/insights/page.tsx
export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '@/lib/supabase'
import BarChart from '@/components/BarChart'
import InsightsPeriodToggle from '@/components/InsightsPeriodToggle'
import CategoryBars from '@/components/CategoryBars'
import { getCategoryById } from '@/lib/categories'
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
function totalIncome(txs: Transaction[]) {
  return txs.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
}
function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

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

  const currentExpense = totalExpense(currentTxs)
  const previousExpense = totalExpense(previousTxs)
  const currentIncome = totalIncome(currentTxs)
  const savings = currentIncome - currentExpense
  const savingsRate = currentIncome > 0 ? Math.round((savings / currentIncome) * 100) : null

  const pctChange = previousExpense > 0
    ? Math.round(((currentExpense - previousExpense) / previousExpense) * 100)
    : null

  const catMap = new Map<string, number>()
  for (const t of currentTxs.filter(t => t.type === 'expense')) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount))
  }
  const catEntries = [...catMap.entries()].sort((a,b) => b[1]-a[1])
  const topCat = catEntries[0]
  const bottomCat = catEntries.filter(([,v]) => v > 0).at(-1)

  const monthlyBars = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    return {
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      current: totalExpense(allTxs.filter(t => t.date.startsWith(key))),
      previous: 0,
    }
  })
  const maxMonthly = Math.max(...monthlyBars.map(b => b.current), 1)
  const maxPeriod = Math.max(currentExpense, previousExpense, 1)

  const txDates = new Set(allTxs.map(t => t.date))
  let streak = 0
  const d = new Date()
  while (txDates.has(d.toISOString().slice(0, 10))) {
    streak++
    d.setDate(d.getDate() - 1)
  }

  const periodDays = Math.max(1, Math.ceil(
    (new Date(bounds.current.end).getTime() - new Date(bounds.current.start).getTime()) / 86400000
  ) + 1)
  const dailyAvg = Math.round(currentExpense / periodDays)

  return (
    <main className="min-h-screen pb-32" style={{ background: '#020d0a' }}>
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 100% 0%, rgba(52,211,153,0.09), transparent 50%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 0% 80%, rgba(13,148,136,0.07), transparent 50%)' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="pt-14 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(45,212,191,0.5)' }}>Analytics</p>
          <h1 className="text-white text-2xl font-bold mb-4">Insights</h1>
          <InsightsPeriodToggle period={period} />
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Spent</p>
            <p className="text-sm font-bold text-red-400 tabular-nums">{fmt(currentExpense)}</p>
            {pctChange !== null && (
              <p className={`text-[10px] mt-0.5 font-semibold ${pctChange > 0 ? 'text-red-400/70' : 'text-emerald-400/70'}`}>
                {pctChange > 0 ? '↑' : '↓'}{Math.abs(pctChange)}% vs prior
              </p>
            )}
          </div>
          <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Daily avg</p>
            <p className="text-sm font-bold text-white/80 tabular-nums">{fmt(dailyAvg)}</p>
            <p className="text-[10px] mt-0.5 text-white/25">{periodDays} days</p>
          </div>
          <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Streak</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: '#2dd4bf' }}>{streak}d 🔥</p>
            <p className="text-[10px] mt-0.5 text-white/25">consecutive</p>
          </div>
        </div>

        {/* Savings rate */}
        {currentIncome > 0 && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Savings rate</p>
              <span className={`text-sm font-bold tabular-nums ${(savingsRate ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {savingsRate !== null ? `${savingsRate}%` : '—'}
              </span>
            </div>
            <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, savingsRate ?? 0))}%`,
                  background: (savingsRate ?? 0) >= 20
                    ? 'linear-gradient(90deg,#10b981,#34d399)'
                    : (savingsRate ?? 0) >= 0
                    ? 'linear-gradient(90deg,#0d9488,#2dd4bf)'
                    : 'linear-gradient(90deg,#ef4444,#f87171)',
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-white/25">
              <span>Income {fmt(currentIncome)}</span>
              <span>Saved {fmt(Math.max(0, savings))}</span>
            </div>
          </div>
        )}

        {/* Top / bottom categories */}
        {topCat && bottomCat && topCat[0] !== bottomCat[0] && (
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {[
              { title: 'Top spend', entry: topCat, accent: '#ef4444' },
              { title: 'Lowest spend', entry: bottomCat, accent: '#10b981' },
            ].map(({ title, entry, accent }) => {
              const cat = getCategoryById(entry[0])
              return (
                <div key={title} className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.06)` }}>
                  <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: `${accent}99` }}>{title}</p>
                  <div className="text-2xl mb-1">{cat?.emoji ?? '📦'}</div>
                  <p className="text-white text-xs font-semibold">{cat?.label ?? entry[0]}</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5" style={{ color: accent }}>
                    {fmt(entry[1])}
                  </p>
                  <p className="text-[10px] text-white/25 mt-0.5">
                    {currentExpense > 0 ? Math.round((entry[1]/currentExpense)*100) : 0}% of spend
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Period comparison */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-3">
            {bounds.current.label} vs {bounds.previous.label}
          </p>
          <BarChart
            bars={[
              { label: bounds.previous.label, current: 0, previous: previousExpense },
              { label: bounds.current.label, current: currentExpense, previous: 0 },
            ]}
            maxValue={maxPeriod}
          />
        </div>

        {/* 6-month trend */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-3">6-Month Trend</p>
          <BarChart bars={monthlyBars} maxValue={maxMonthly} />
        </div>

        {/* Category breakdown */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-3">Category Breakdown</p>
          <CategoryBars transactions={currentTxs} />
        </div>
      </div>
    </main>
  )
}
