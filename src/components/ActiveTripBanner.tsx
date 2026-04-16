'use client'
import Link from 'next/link'
import { useTripContext } from '@/lib/tripContext'

export default function ActiveTripBanner() {
  const { activeTrip } = useTripContext()
  if (!activeTrip) return null

  return (
    <Link href={`/trips/${activeTrip.id}`}
      className="block mx-4 mb-4 rounded-2xl border border-orange-500/40 p-4
        bg-gradient-to-br from-orange-500/12 to-amber-500/6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Live Trip
          </div>
          <div className="font-black text-white text-base">{activeTrip.name}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Day {activeTrip.days_elapsed} of {activeTrip.total_days}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-white">₹{activeTrip.total_spent.toLocaleString()}</div>
          {activeTrip.budget && (
            <div className="text-[10px] text-slate-500">of ₹{activeTrip.budget.toLocaleString()}</div>
          )}
        </div>
      </div>
    </Link>
  )
}
