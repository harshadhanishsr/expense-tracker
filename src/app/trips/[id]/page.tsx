'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { TripWithTransactions } from '@/lib/types'
import TripCategoryGrid from '@/components/TripCategoryGrid'
import TripTimeline from '@/components/TripTimeline'
import Link from 'next/link'

function BudgetRing({ pct }: { pct: number }) {
  const r = 28, circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width="70" height="70" viewBox="0 0 70 70" className="-rotate-90">
      <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle cx="35" cy="35" r={r} fill="none" stroke="url(#ring-g)" strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <defs>
        <linearGradient id="ring-g" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff6b35" />
          <stop offset="100%" stopColor="#ff9f00" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [trip, setTrip] = useState<TripWithTransactions | null>(null)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then(r => r.json())
      .then(d => { setTrip(d.trip); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-slate-500">
      Loading…
    </div>
  )
  if (!trip) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-slate-500">
      Trip not found
    </div>
  )

  const isActive = trip.start_date <= today && trip.end_date >= today
  const spentPct = trip.budget ? Math.min(Math.round((trip.total_spent / trip.budget) * 100), 100) : 0
  const perDay = trip.days_elapsed > 0 ? Math.round(trip.total_spent / trip.days_elapsed) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-40">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="px-4 pt-14 pb-4">
          <Link href="/trips" className="text-[12px] text-orange-400 mb-3 block">‹ My Trips</Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">{trip.name}</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">{trip.start_date} – {trip.end_date}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border flex items-center gap-1
              ${isActive
                ? 'bg-orange-500/20 border-orange-500/35 text-orange-400'
                : 'bg-slate-700/40 border-slate-600/30 text-slate-400'}`}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
              {isActive ? 'Active' : 'Closed'}
            </span>
          </div>
        </div>

        {/* Budget ring + stats */}
        <div className="mx-4 mb-4 flex items-center gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
          {trip.budget ? (
            <div className="relative flex-shrink-0">
              <BudgetRing pct={spentPct} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-black text-orange-400">{spentPct}%</span>
                <span className="text-[8px] text-slate-500">used</span>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <div>
              <div className="text-[10px] text-slate-500">Total Spent</div>
              <div className="text-lg font-black text-orange-400">₹{trip.total_spent.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Budget Left</div>
              <div className="text-base font-black text-emerald-400">
                {trip.budget ? `₹${(trip.budget - trip.total_spent).toLocaleString()}` : 'No budget set'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Per Day Avg</div>
              <div className="text-sm font-bold text-white">₹{perDay.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Category grid */}
        <div className="text-[11px] text-slate-500 uppercase tracking-widest px-4 mb-2">By Category</div>
        <TripCategoryGrid transactions={trip.transactions} />

        {/* Timeline */}
        <div className="text-[11px] text-slate-500 uppercase tracking-widest px-4 mt-5 mb-1">Day by Day</div>
        <TripTimeline transactions={trip.transactions} />
      </div>
    </div>
  )
}
