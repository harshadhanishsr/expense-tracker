// src/app/dashboard/page.tsx
export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '@/lib/supabase'
import TransactionList from '@/components/TransactionList'
import BentoCategoryGrid from '@/components/BentoCategoryGrid'
import ActiveTripBanner from '@/components/ActiveTripBanner'
import AIInsightCard from '@/components/AIInsightCard'
import Link from 'next/link'
import type { Transaction } from '@/lib/types'

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

  const [transactions, prevMonthTransactions] = await Promise.all([
    getTransactions(month),
    getTransactions(prevMonth),
  ])

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const balance = income - expenses
  const todayStr = now.toISOString().slice(0, 10)
  const todaySpend = transactions
    .filter(t => t.type === 'expense' && t.date === todayStr)
    .reduce((s, t) => s + Number(t.amount), 0)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <main className="min-h-screen pb-32" style={{ background: '#0b0c15' }}>
      {/* Gradient blobs */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 0% 0%, rgba(255,107,53,0.12), transparent 50%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 100% 40%, rgba(139,92,246,0.10), transparent 50%)' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4">
        {/* Month nav */}
        <div className="flex items-center justify-between pt-14 pb-2">
          <Link
            href={`/dashboard?month=${prevMonth}`}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white text-lg transition-all"
          >
            ‹
          </Link>
          <p className="text-white/40 text-xs font-semibold tracking-wide">{monthLabel}</p>
          <Link
            href={`/dashboard?month=${nextMonth}`}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${isCurrentMonth ? 'text-white/10 pointer-events-none' : 'text-white/40 hover:text-white'}`}
          >
            ›
          </Link>
        </div>

        {/* Greeting + Balance */}
        <div className="pb-5">
          <p className="text-white/40 text-sm mb-1">{greeting} 👋</p>
          <p
            className="font-extrabold tracking-tight"
            style={{
              fontSize: 'clamp(2rem, 9vw, 3rem)',
              background: 'linear-gradient(90deg, #fff 55%, #ff9f00)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {fmt(balance)}
          </p>
        </div>

        {/* Stats pills */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {([
            { label: 'Income', value: fmt(income), color: 'text-emerald-400' },
            { label: 'Spent', value: fmt(expenses), color: 'text-red-400' },
            { label: 'Today', value: fmt(todaySpend), color: 'text-white' },
          ] as const).map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl p-3 backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 text-white/40">{label}</p>
              <p className={`font-bold text-sm tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Active trip banner */}
        <div className="mb-4">
          <ActiveTripBanner />
        </div>

        {/* AI Insight Card + Heatmap */}
        <div className="mb-5">
          <AIInsightCard />
        </div>

        {/* Category bento grid */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Categories</p>
          <BentoCategoryGrid transactions={transactions} prevMonthTransactions={prevMonthTransactions} />
        </div>

        {/* Recent transactions */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Recent</p>
            <Link href="/history" className="text-orange-400 text-xs font-medium hover:text-orange-300 transition-colors">
              See all →
            </Link>
          </div>
          <TransactionList transactions={transactions} limit={5} showRepeat />
        </div>
      </div>
    </main>
  )
}
