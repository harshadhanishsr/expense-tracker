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

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trips').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trip: data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
