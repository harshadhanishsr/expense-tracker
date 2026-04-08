// src/app/dashboard/page.tsx
export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '@/lib/supabase'
import SummaryCards from '@/components/SummaryCards'
import CategoryBars from '@/components/CategoryBars'
import TransactionList from '@/components/TransactionList'
import RecurringSection from '@/components/RecurringSection'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'
import type { Transaction } from '@/lib/types'

async function getTransactions(month: string): Promise<Transaction[]> {
  const [year, m] = month.split('-')
  const start = `${year}-${m.padStart(2,'0')}-01`
  const end = new Date(Number(year), Number(m), 0).toISOString().slice(0, 10)
  const { data } = await getSupabaseAdmin()
    .from('transactions').select('*')
    .gte('date', start).lte('date', end)
    .order('date', { ascending: false })
  return (data ?? []) as Transaction[]
}

async function getRecurring(): Promise<Transaction[]> {
  const { data } = await getSupabaseAdmin()
    .from('transactions').select('*')
    .eq('is_recurring', true)
    .order('created_at', { ascending: false })
  return (data ?? []) as Transaction[]
}

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const month = params.month ?? currentMonth
  const [year, m] = month.split('-').map(Number)

  const [transactions, recurring] = await Promise.all([getTransactions(month), getRecurring()])

  const income = transactions.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
  const balance = income - expenses
  const todayStr = now.toISOString().slice(0,10)
  const todaySpend = transactions
    .filter(t => t.type === 'expense' && t.date === todayStr)
    .reduce((s,t) => s + Number(t.amount), 0)

  const prevDate = new Date(year, m-2, 1)
  const nextDate = new Date(year, m, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`
  const isCurrentMonth = month === currentMonth
  const monthLabel = new Date(year, m-1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <main className="min-h-screen bg-slate-950 pb-28">

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 pt-14 pb-10 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5 blur-xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-indigo-500/20 blur-xl" />

        <div className="max-w-lg mx-auto relative">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-6">
            <Link href={`/dashboard?month=${prevMonth}`}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-all active:scale-95">
              ‹
            </Link>
            <p className="text-blue-100 text-sm font-semibold tracking-wide">{monthLabel}</p>
            <Link href={`/dashboard?month=${nextMonth}`}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all active:scale-95
                ${isCurrentMonth ? 'bg-white/5 text-blue-900 pointer-events-none' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
              ›
            </Link>
          </div>

          {/* Balance */}
          <div className="mb-6">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">Net Balance</p>
            <p className="text-white font-extrabold tracking-tight" style={{ fontSize: 'clamp(2rem, 8vw, 3rem)' }}>
              {fmt(balance)}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <p className="text-blue-200 text-[10px] font-semibold uppercase tracking-wider mb-1">Income</p>
              <p className="text-emerald-300 font-bold text-sm tabular-nums">{fmt(income)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <p className="text-blue-200 text-[10px] font-semibold uppercase tracking-wider mb-1">Spent</p>
              <p className="text-red-300 font-bold text-sm tabular-nums">{fmt(expenses)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <p className="text-blue-200 text-[10px] font-semibold uppercase tracking-wider mb-1">Today</p>
              <p className="text-white font-bold text-sm tabular-nums">{fmt(todaySpend)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* Summary cards */}
        <SummaryCards income={income} expenses={expenses} />

        {/* Top spending */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">📊</div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Top Spending</h2>
          </div>
          <CategoryBars transactions={transactions} />
        </div>

        {/* Recurring */}
        <RecurringSection transactions={recurring} />

        {/* Recent transactions */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-xs">🕐</div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent</h2>
            </div>
            <Link href="/history" className="text-blue-400 text-xs font-medium hover:text-blue-300 transition-colors">
              See all →
            </Link>
          </div>
          <TransactionList transactions={transactions} limit={5} showRepeat />
        </div>

      </div>
      <BottomNav />
    </main>
  )
}
