// src/app/daily/page.tsx
export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '@/lib/supabase'
import DayGroup from '@/components/DayGroup'
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
    <main className="min-h-screen" style={{ background: '#020d0a', paddingBottom: 'calc(180px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="relative bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 px-4 pt-14 pb-6 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 blur-xl" />
        <div className="max-w-lg mx-auto relative">
          <p className="text-teal-200 text-xs font-semibold uppercase tracking-widest mb-1">Daily Breakdown</p>
          <h1 className="text-white text-2xl font-bold">Last 30 Days</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {groups.size === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl opacity-20">📅</span>
            <p className="text-slate-500 text-sm">No transactions yet</p>
          </div>
        )}
        {Array.from(groups.entries()).map(([date, txs]) => (
          <DayGroup key={date} label={dayLabel(date)} transactions={txs} />
        ))}
      </div>
    </main>
  )
}
