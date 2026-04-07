import { getSupabaseAdmin } from '@/lib/supabase'
import SummaryCards from '@/components/SummaryCards'
import CategoryBars from '@/components/CategoryBars'
import TransactionList from '@/components/TransactionList'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

async function getTransactions(month: string) {
  const [year, m] = month.split('-')
  const start = `${year}-${m.padStart(2,'0')}-01`
  const end = new Date(Number(year), Number(m), 0).toISOString().slice(0, 10)
  const { data } = await getSupabaseAdmin()
    .from('transactions').select('*')
    .gte('date', start).lte('date', end)
    .order('date', { ascending: false })
  return data ?? []
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const month = params.month ?? currentMonth
  const [year, m] = month.split('-').map(Number)
  const transactions = await getTransactions(month)
  const income = transactions.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)

  const prevDate = new Date(year, m-2, 1)
  const nextDate = new Date(year, m, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`
  const monthLabel = new Date(year, m-1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-800 text-white px-4 pt-10 pb-6">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href={`/dashboard?month=${prevMonth}`} className="text-slate-400 hover:text-white p-2">‹</Link>
          <h1 className="text-lg font-semibold">{monthLabel}</h1>
          <Link href={`/dashboard?month=${nextMonth}`} className={`p-2 ${month === currentMonth ? 'text-slate-600 pointer-events-none' : 'text-slate-400 hover:text-white'}`}>›</Link>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <SummaryCards income={income} expenses={expenses} />
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Top Spending</h2>
          <CategoryBars transactions={transactions} />
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Recent</h2>
            <Link href="/history" className="text-blue-500 text-xs hover:underline">See all</Link>
          </div>
          <TransactionList transactions={transactions} limit={5} />
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
