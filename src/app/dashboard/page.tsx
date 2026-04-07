// src/app/dashboard/page.tsx
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

  function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

  return (
    <main className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-12 pb-8 rounded-b-3xl shadow-xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link href={`/dashboard?month=${prevMonth}`} className="text-blue-200 hover:text-white p-2 -ml-2 text-xl">‹</Link>
            <h1 className="text-white font-semibold">{monthLabel}</h1>
            <Link href={`/dashboard?month=${nextMonth}`} className={`p-2 -mr-2 text-xl ${isCurrentMonth ? 'text-blue-800 pointer-events-none' : 'text-blue-200 hover:text-white'}`}>›</Link>
          </div>
          <div className="mb-4">
            <p className="text-blue-200 text-xs uppercase tracking-widest mb-1">Net Balance</p>
            <p className="text-white text-4xl font-extrabold">{fmt(balance)}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20">
            <div>
              <p className="text-blue-200 text-xs mb-1">↑ Income</p>
              <p className="text-green-300 font-bold text-sm">{fmt(income)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs mb-1">↓ Spent</p>
              <p className="text-red-300 font-bold text-sm">{fmt(expenses)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs mb-1">📅 Today</p>
              <p className="text-white font-bold text-sm">{fmt(todaySpend)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <SummaryCards income={income} expenses={expenses} />
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Top Spending</h2>
          <CategoryBars transactions={transactions} />
        </div>
        <RecurringSection transactions={recurring} />
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recent</h2>
            <Link href="/history" className="text-blue-400 text-xs hover:underline">See all</Link>
          </div>
          <TransactionList transactions={transactions} limit={5} />
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
