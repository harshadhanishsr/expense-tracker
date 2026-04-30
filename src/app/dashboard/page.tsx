// src/app/dashboard/page.tsx
export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '@/lib/supabase'
import ActiveTripBanner from '@/components/ActiveTripBanner'
import Link from 'next/link'
import type { Transaction } from '@/lib/types'
import { getCategoryById } from '@/lib/categories'

async function getTransactions(month: string): Promise<Transaction[]> {
  const [year, m] = month.split('-')
  const start = `${year}-${m.padStart(2, '0')}-01`
  const end = new Date(Number(year), Number(m), 0).toISOString().slice(0, 10)
  const { data } = await getSupabaseAdmin()
    .from('transactions').select('*')
    .gte('date', start).lte('date', end)
    .order('date', { ascending: false })
  return (data ?? []) as Transaction[]
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

const CIRC = 2 * Math.PI * 45

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = params.month ?? currentMonth
  const [year, m] = month.split('-').map(Number)

  const prevDate = new Date(year, m - 2, 1)
  const nextDate = new Date(year, m, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonth = month === currentMonth
  const monthLabel = new Date(year, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const transactions = await getTransactions(month)

  const income   = transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const balance  = income - expenses
  const todayStr = now.toISOString().slice(0, 10)
  const todaySpend = transactions
    .filter(t => t.type === 'expense' && t.date === todayStr)
    .reduce((s, t) => s + Number(t.amount), 0)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ── Ring ──
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0
  const ringPct    = Math.min(100, Math.max(0, savingsRate))
  const ringOffset = CIRC * (1 - ringPct / 100)
  const ringColor  = ringPct >= 20
    ? { from: '#10b981', to: '#34d399', glow: 'rgba(16,185,129,0.30)' }
    : ringPct >= 0
    ? { from: '#2dd4bf', to: '#34d399', glow: 'rgba(45,212,191,0.30)' }
    : { from: '#ef4444', to: '#f87171', glow: 'rgba(239,68,68,0.25)' }

  // ── 7-day sparkline ──
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    const spent = transactions
      .filter(t => t.type === 'expense' && t.date === key)
      .reduce((s, t) => s + Number(t.amount), 0)
    return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2), spent, isToday: key === todayStr }
  })
  const maxDay = Math.max(...days7.map(d => d.spent), 1)

  // ── Month pace ──
  const daysInMonth    = new Date(year, m, 0).getDate()
  const dayOfMonth     = isCurrentMonth ? now.getDate() : daysInMonth
  const daysRemaining  = isCurrentMonth ? Math.max(1, daysInMonth - dayOfMonth) : 0
  const dailyAvg       = dayOfMonth > 0 ? Math.round(expenses / dayOfMonth) : 0
  const dailyBudgetLeft = income > 0 && daysRemaining > 0
    ? Math.round((income - expenses) / daysRemaining) : null

  // ── Month progress ──
  const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100)

  // ── Top categories ──
  const catMap = new Map<string, number>()
  for (const t of transactions.filter(t => t.type === 'expense')) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount))
  }
  const topCats = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <main className="min-h-screen" style={{ background: '#020d0a', paddingBottom: 'calc(180px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Mesh background ── */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div style={{ position:'absolute', top:'-15%', left:'25%', width:'70vw', height:'70vw', maxWidth:520, maxHeight:520, borderRadius:'50%', background:'radial-gradient(circle, rgba(13,148,136,0.16), transparent 65%)', filter:'blur(50px)' }} />
        <div style={{ position:'absolute', top:'45%', left:'-15%', width:'55vw', height:'55vw', maxWidth:380, maxHeight:380, borderRadius:'50%', background:'radial-gradient(circle, rgba(52,211,153,0.10), transparent 65%)', filter:'blur(50px)' }} />
        <div style={{ position:'absolute', bottom:'-5%', right:'-10%', width:'50vw', height:'50vw', maxWidth:340, maxHeight:340, borderRadius:'50%', background:'radial-gradient(circle, rgba(13,148,136,0.07), transparent 65%)', filter:'blur(50px)' }} />
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.013) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.013) 1px, transparent 1px)', backgroundSize:'44px 44px', maskImage:'radial-gradient(ellipse 80% 70% at 50% 0%, black 40%, transparent 100%)' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4">

        {/* ── Month nav ── */}
        <div className="fade-up pt-10 pb-3">
          <div className="flex items-center justify-between mb-2">
            <Link href={`/dashboard?month=${prevMonth}`}
              className="w-9 h-9 glass rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 text-lg transition-all duration-200">‹</Link>

            <div className="text-center">
              <p className="text-white font-bold text-base tracking-tight">{monthLabel}</p>
              {isCurrentMonth && (
                <p className="text-xs mt-0.5" style={{ color: '#2dd4bf', opacity: 0.75 }}>
                  Day {dayOfMonth} of {daysInMonth}
                </p>
              )}
            </div>

            <Link href={`/dashboard?month=${nextMonth}`}
              className={`w-9 h-9 glass rounded-xl flex items-center justify-center text-lg transition-all duration-200 ${isCurrentMonth ? 'text-white/10 pointer-events-none' : 'text-white/40 hover:text-white/80'}`}>›</Link>
          </div>

          {/* Month progress bar */}
          {isCurrentMonth && (
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-1 rounded-full transition-all duration-700"
                style={{ width: `${monthProgress}%`, background: 'linear-gradient(90deg,#0d9488,#2dd4bf)' }} />
            </div>
          )}
        </div>

        {/* ── Hero: Ring + Balance ── */}
        <div className="flex items-center gap-6 py-5 fade-up-1">
          {/* Ring */}
          <div className="relative flex-shrink-0" style={{ width: 118, height: 118 }}>
            <div className="glow-breathe absolute rounded-full pointer-events-none"
              style={{ inset: 10, background: `radial-gradient(circle, ${ringColor.glow}, transparent 70%)`, filter: 'blur(14px)' }} />
            <svg width="118" height="118" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor={ringColor.from} />
                  <stop offset="100%" stopColor={ringColor.to} />
                </linearGradient>
                <filter id="ringGlow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <circle cx="55" cy="55" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="55" cy="55" r="45" fill="none" stroke="url(#ringGrad)" strokeWidth="8"
                strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={ringOffset}
                filter="url(#ringGlow)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 2 }}>
              <p className="font-black leading-none number-pop"
                style={{ fontSize: 'clamp(1rem,1.8vw,1.2rem)', background: `linear-gradient(135deg,${ringColor.from},${ringColor.to})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                {income > 0 ? `${ringPct}%` : '–'}
              </p>
              <p className="text-white/25 mt-0.5" style={{ fontSize: '0.58rem', letterSpacing: '0.06em' }}>
                {income > 0 ? 'SAVED' : 'NO DATA'}
              </p>
            </div>
          </div>

          {/* Balance */}
          <div className="flex-1 min-w-0">
            <p className="text-white/30 text-sm mb-1.5">{greeting} 👋</p>
            <p className="font-black tabular-nums leading-none number-pop text-gradient-white"
              style={{ fontSize: 'clamp(2rem, 6vw, 3rem)' }}>
              {fmt(balance)}
            </p>
            <p className="text-white/20 text-xs mt-1 font-medium tracking-wide">net balance</p>
            {income > 0 && (
              <div className="flex items-center gap-2 mt-2.5">
                <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-1 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, (expenses / income) * 100))}%`, background: 'linear-gradient(90deg,#0d9488,#34d399)' }} />
                </div>
                <span className="text-xs text-white/25 tabular-nums flex-shrink-0">
                  {Math.round((expenses / income) * 100)}% spent
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-2 mb-3 fade-up-2">
          {[
            { label: 'Income', value: fmt(income),     color: '#34d399' },
            { label: 'Spent',  value: fmt(expenses),   color: '#f87171' },
            { label: 'Today',  value: fmt(todaySpend), color: 'rgba(255,255,255,0.8)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass rounded-2xl p-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-white/25">{label}</p>
              <p className="font-bold text-sm tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Active trip */}
        <div className="mb-3 fade-up-2">
          <ActiveTripBanner />
        </div>

        {/* ── Pace + Sparkline ── */}
        {isCurrentMonth && (
          <div className="glass-accent rounded-2xl p-4 mb-3 fade-up-3">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-1.5">Daily Pace</p>
              <p className={`font-black tabular-nums leading-none text-xl ${dailyBudgetLeft !== null && dailyBudgetLeft < 0 ? 'text-red-400' : 'text-white'}`}>
                {dailyBudgetLeft !== null ? fmt(Math.abs(dailyBudgetLeft)) : fmt(dailyAvg)}
              </p>
              <p className="text-xs text-white/30 mt-1">
                {dailyBudgetLeft !== null
                  ? (dailyBudgetLeft >= 0 ? `left/day · ${daysRemaining}d remaining` : `over budget`)
                  : `avg/day · ${daysRemaining}d remaining`}
              </p>
            </div>

            {/* Sparkline */}
            <div className="flex items-end gap-1.5" style={{ height: 44 }}>
              {days7.map((d, i) => {
                const barH = Math.max(4, Math.round((d.spent / maxDay) * 34))
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-md transition-all duration-500"
                      style={{
                        height: barH,
                        background: d.isToday
                          ? 'linear-gradient(180deg,#34d399,#0d9488)'
                          : d.spent > 0
                          ? 'rgba(13,148,136,0.35)'
                          : 'rgba(255,255,255,0.04)',
                        boxShadow: d.isToday ? '0 2px 12px rgba(13,148,136,0.5)' : 'none',
                      }} />
                    <span className="text-white/20 font-medium" style={{ fontSize: '0.55rem' }}>{d.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Top categories ── */}
        {topCats.length > 0 && (
          <div className="mb-3 fade-up-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-white/25">Top Spend</p>
              <Link href="/insights" className="text-xs font-semibold transition-colors"
                style={{ color: 'rgba(45,212,191,0.6)' }}>Details →</Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {topCats.map(([id, total]) => {
                const cat = getCategoryById(id)
                return (
                  <div key={id} className="glass rounded-2xl px-3 py-2 flex-shrink-0 flex items-center gap-2">
                    <span className="text-lg leading-none">{cat?.emoji ?? '📦'}</span>
                    <div>
                      <p className="text-xs font-bold text-white/70 tabular-nums">{fmt(total)}</p>
                      <p className="text-white/25" style={{ fontSize: '0.6rem', marginTop: 1 }}>{cat?.label ?? id}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
