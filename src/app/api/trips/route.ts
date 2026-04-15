import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { Trip } from '@/lib/types'

function computeTripFields(trip: any, transactions: any[]): Trip {
  const startDate = new Date(trip.start_date)
  const endDate = new Date(trip.end_date)
  const today = new Date()
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  const daysElapsed = Math.min(
    Math.max(Math.round((today.getTime() - startDate.getTime()) / 86400000) + 1, 1),
    totalDays
  )
  const expenses = transactions.filter((t: any) => t.trip_id === trip.id && t.type === 'expense')
  const totalSpent = expenses.reduce((sum: number, t: any) => sum + t.amount, 0)
  return { ...trip, total_spent: totalSpent, expense_count: expenses.length, days_elapsed: daysElapsed, total_days: totalDays }
}

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { data: trips, error: tripsErr } = await supabase
    .from('trips').select('*').order('start_date', { ascending: false })
  if (tripsErr) return NextResponse.json({ error: tripsErr.message }, { status: 500 })

  if (!trips?.length) return NextResponse.json({ trips: [] })

  const { data: transactions, error: txErr } = await supabase
    .from('transactions').select('trip_id, amount, type').order('date', { ascending: false })
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  const enriched = trips.map(t => computeTripFields(t, transactions ?? []))
  return NextResponse.json({ trips: enriched })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { name, start_date, end_date, budget } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!start_date || !end_date) {
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
  }
  if (new Date(end_date) < new Date(start_date)) {
    return NextResponse.json({ error: 'end_date must be >= start_date' }, { status: 400 })
  }
  if (budget !== undefined && budget !== null && (typeof budget !== 'number' || budget <= 0)) {
    return NextResponse.json({ error: 'budget must be a positive number' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Check for overlapping trips
  const { data: overlapping } = await supabase
    .from('trips').select('id')
    .gte('end_date', start_date)
    .lte('start_date', end_date)
  if (overlapping && overlapping.length > 0) {
    return NextResponse.json({ error: 'A trip already exists for those dates' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({ name: name.trim(), start_date, end_date, budget: budget ?? null })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const trip: Trip = computeTripFields(data, [])
  return NextResponse.json({ trip }, { status: 201 })
}
