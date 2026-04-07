// src/app/daily/page.tsx
import { getSupabaseAdmin } from '@/lib/supabase'
import DayGroup from '@/components/DayGroup'
import BottomNav from '@/components/BottomNav'
import type { Transaction } from '@/lib/types'

function dayLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default async function DailyPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await getSupabaseAdmin()
    .from('transactions')
    .select('*')
    .gte('date', thirtyDaysAgo)
    .lte('date', today)
    .order('date', { ascending: false })

  const transactions = (data ?? []) as Transaction[]

  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (!groups.has(t.date)) groups.set(t.date, [])
    groups.get(t.date)!.push(t)
  }

  return (
    <main className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-12 pb-6 rounded-b-3xl shadow-xl">
        <div className="max-w-lg mx-auto">
          <h1 className="text-white text-lg font-semibold">Daily View</h1>
          <p className="text-blue-200 text-sm mt-1">Last 30 days</p>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {groups.size === 0 && (
          <p className="text-slate-500 text-sm text-center py-12">No transactions yet</p>
        )}
        {Array.from(groups.entries()).map(([date, txs]) => (
          <DayGroup key={date} label={dayLabel(date)} transactions={txs} />
        ))}
      </div>
      <BottomNav />
    </main>
  )
}
