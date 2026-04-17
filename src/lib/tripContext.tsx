// src/lib/tripContext.tsx
'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { Trip } from './types'

type PrefillData = { category: string; amount: number; description: string; type: 'expense' | 'income' }

interface TripContextValue {
  activeTrip: Trip | null
  setActiveTrip: (t: Trip | null) => void
  refreshActiveTrip: () => Promise<void>
  pendingPrefill: PrefillData | null
  setPendingPrefill: (v: PrefillData | null) => void
}

const TripContext = createContext<TripContextValue>({
  activeTrip: null,
  setActiveTrip: () => {},
  refreshActiveTrip: async () => {},
  pendingPrefill: null,
  setPendingPrefill: () => {},
})

export function TripProvider({ children }: { children: ReactNode }) {
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null)
  const [pendingPrefill, setPendingPrefill] = useState<PrefillData | null>(null)

  const refreshActiveTrip = useCallback(async () => {
    try {
      const res = await fetch('/api/trips')
      if (!res.ok) return
      const { trips } = await res.json()
      const today = new Date().toISOString().slice(0, 10)
      // Find trips active today; pick most recent start_date if overlap
      const active = (trips as Trip[])
        .filter(t => t.start_date <= today && t.end_date >= today)
        .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
      setActiveTrip(active)
    } catch {
      // Network error — leave activeTrip unchanged
    }
  }, [])

  useEffect(() => { refreshActiveTrip() }, [refreshActiveTrip])

  return (
    <TripContext.Provider value={{ activeTrip, setActiveTrip, refreshActiveTrip, pendingPrefill, setPendingPrefill }}>
      {children}
    </TripContext.Provider>
  )
}

export function useTripContext() {
  return useContext(TripContext)
}
