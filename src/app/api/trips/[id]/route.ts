import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data: trip, error } = await supabase
    .from('trips').select('*').eq('id', id).single()
  if (error || !trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const { data: transactions } = await supabase
    .from('transactions').select('*').eq('trip_id', id).order('date', { ascending: false })

  const startDate = new Date(trip.start_date)
  const endDate = new Date(trip.end_date)
  const today = new Date()
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  const daysElapsed = Math.min(
    Math.max(Math.round((today.getTime() - startDate.getTime()) / 86400000) + 1, 1),
    totalDays
  )
  const expenses = (transactions ?? []).filter((t: any) => t.type === 'expense')
  const totalSpent = expenses.reduce((s: number, t: any) => s + t.amount, 0)

  return NextResponse.json({
    trip: {
      ...trip,
      total_spent: totalSpent,
      expense_count: expenses.length,
      days_elapsed: daysElapsed,
      total_days: totalDays,
      transactions: transactions ?? [],
    },
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  // start_date is immutable — silently ignore if present
  const { name, end_date, budget } = body
  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (end_date !== undefined) updates.end_date = end_date
  if (budget !== undefined) updates.budget = budget

  // Fix 3: Input validation
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
  }
  if (budget !== undefined && budget !== null && (typeof budget !== 'number' || budget <= 0)) {
    return NextResponse.json({ error: 'budget must be a positive number' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Fix 2: Validate end_date >= start_date by fetching current trip
  if (end_date !== undefined) {
    const { data: currentTrip, error: fetchErr } = await supabase
      .from('trips').select('start_date').eq('id', id).single()
    if (fetchErr) {
      if (fetchErr.code === 'PGRST116') return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (new Date(end_date) < new Date(currentTrip.start_date)) {
      return NextResponse.json({ error: 'end_date must be >= start_date' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('trips').update(updates).eq('id', id).select().single()
  // Fix 5: Return 404 for unknown trip ID
  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ trip: data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
