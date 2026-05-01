'use client'
import { useState, useEffect, useCallback } from 'react'
import { Trip } from '@/lib/types'
import TripCard from '@/components/TripCard'
import { useTripContext } from '@/lib/tripContext'

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', budget: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { activeTrip, refreshActiveTrip } = useTripContext()
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const res = await fetch('/api/trips')
    const json = await res.json()
    setTrips(json.trips ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createTrip() {
    setFormError('')
    if (!form.name.trim() || !form.start_date || !form.end_date) {
      setFormError('Name, start date and end date are required')
      return
    }
    if (form.end_date < form.start_date) {
      setFormError('End date must be after start date')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        budget: form.budget ? Number(form.budget) : null,
      }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) { setFormError(json.error); return }
    setShowSheet(false)
    setForm({ name: '', start_date: '', end_date: '', budget: '' })
    await load()
    await refreshActiveTrip()
  }

  const pastTrips = trips.filter(t => t.end_date < today && t.id !== activeTrip?.id)

  return (
    <div className="min-h-screen bg-[#020d0a] pb-40">
      <div className="max-w-lg mx-auto px-4 pt-14">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-black text-white">My Trips ✈️</h1>
          <button onClick={() => setShowSheet(true)}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white
              bg-gradient-to-r from-[#6366f1] to-[#a78bfa]">
            ＋ New
          </button>
        </div>

        {loading && <div className="text-slate-500 text-sm">Loading…</div>}

        {activeTrip && (
          <div className="mb-4">
            <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-2">🔵 Active</div>
            <TripCard trip={activeTrip} variant="active" />
          </div>
        )}

        {pastTrips.length > 0 && (
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-2 mt-2">Past</div>
            <div className="flex flex-col gap-2">
              {pastTrips.map(t => <TripCard key={t.id} trip={t} variant="past" />)}
            </div>
          </div>
        )}

        {!loading && trips.length === 0 && (
          <div className="text-center mt-20 text-slate-500">
            <div className="text-4xl mb-3">✈️</div>
            <p>No trips yet. Tap ＋ New to create one.</p>
          </div>
        )}
      </div>

      {/* New Trip Sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="w-full max-w-lg mx-auto bg-[#14141f] rounded-t-3xl border-t border-white/[0.08] p-6 pb-10">
            <div className="w-9 h-1 rounded-full bg-white/20 mx-auto mb-5" />
            <h2 className="text-lg font-bold text-white mb-5">New Trip</h2>

            {formError && <p className="text-red-400 text-sm mb-3">{formError}</p>}

            {([
              { label: 'Trip Name', key: 'name', type: 'text', placeholder: 'e.g. Goa Trip' },
              { label: 'From', key: 'start_date', type: 'date', placeholder: '' },
              { label: 'To', key: 'end_date', type: 'date', placeholder: '' },
              { label: 'Budget (optional)', key: 'budget', type: 'number', placeholder: 'e.g. 12000' },
            ] as const).map(f => (
              <div key={f.key} className="mb-3">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                />
              </div>
            ))}

            <button onClick={createTrip} disabled={submitting}
              className="w-full mt-4 py-3.5 rounded-2xl font-bold text-white text-base
                bg-gradient-to-r from-[#6366f1] to-[#a78bfa] shadow-lg shadow-indigo-500/30">
              {submitting ? 'Creating…' : 'Create Trip'}
            </button>
            <button onClick={() => setShowSheet(false)}
              className="w-full mt-2 py-2 text-slate-500 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
