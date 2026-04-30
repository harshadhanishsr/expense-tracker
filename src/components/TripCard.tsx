import Link from 'next/link'
import { Trip } from '@/lib/types'

interface TripCardProps {
  trip: Trip
  variant: 'active' | 'past'
}

function pct(trip: Trip) {
  if (!trip.budget) return 0
  return Math.min(Math.round((trip.total_spent / trip.budget) * 100), 100)
}

export default function TripCard({ trip, variant }: TripCardProps) {
  if (variant === 'active') {
    return (
      <Link href={`/trips/${trip.id}`} className="block">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/40 p-5
          bg-gradient-to-br from-indigo-500/15 to-violet-500/8">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full
            bg-[radial-gradient(circle,rgba(99,102,241,0.2),transparent)]" />
          <div className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-lg text-[9px]
            uppercase tracking-widest bg-indigo-500/20 border border-indigo-500/35 text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Live
          </div>
          <div className="text-xl font-black text-white">{trip.name}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 mb-3">
            {trip.start_date} – {trip.end_date} · {trip.total_days} days
          </div>
          <div className="flex gap-5">
            <div>
              <div className="text-[10px] text-slate-500">Spent</div>
              <div className="text-lg font-black text-indigo-400">₹{trip.total_spent.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Remaining</div>
              <div className="text-lg font-black text-emerald-400">
                {trip.budget ? `₹${(trip.budget - trip.total_spent).toLocaleString()}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Expenses</div>
              <div className="text-lg font-black text-white">{trip.expense_count}</div>
            </div>
          </div>
          {trip.budget ? (
            <>
              <div className="mt-3 h-1 rounded-full bg-white/[0.08]">
                <div className="h-1 rounded-full bg-gradient-to-r from-[#6366f1] to-[#a78bfa]"
                  style={{ width: `${pct(trip)}%` }} />
              </div>
              <div className="text-right text-[10px] text-slate-500 mt-1">{pct(trip)}% of budget used</div>
            </>
          ) : null}
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/trips/${trip.id}`} className="block">
      <div className="flex items-center justify-between rounded-2xl border border-white/[0.07]
        bg-white/[0.04] p-4">
        <div>
          <div className="font-bold text-white">{trip.name}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{trip.start_date} – {trip.end_date}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-white">₹{trip.total_spent.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500">{trip.total_days} days</div>
          <div className="text-slate-600 text-base">›</div>
        </div>
      </div>
    </Link>
  )
}
