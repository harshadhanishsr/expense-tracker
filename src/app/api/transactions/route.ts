import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  const supabase = getSupabaseAdmin()
  let query = supabase.from('transactions').select('*')

  if (month) {
    const [year, m] = month.split('-')
    const start = `${year}-${m.padStart(2,'0')}-01`
    const end = new Date(Number(year), Number(m), 0).toISOString().slice(0, 10)
    query = query.gte('date', start).lte('date', end)
  }

  if (type === 'income' || type === 'expense') {
    query = query.eq('type', type)
  }

  if (search) {
    query = query.or(`description.ilike.%${search}%,category.ilike.%${search}%`)
  }

  const { data, error } = await query.order('date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ transactions: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { type, amount, category, date, description, is_recurring, recurrence_interval, trip_id } = body

  if (!type || !amount || !category || !date) {
    return NextResponse.json({ error: 'type, amount, category, and date are required' }, { status: 400 })
  }
  if (!['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type must be income or expense' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (is_recurring && !['daily', 'weekly', 'monthly'].includes(recurrence_interval)) {
    return NextResponse.json({ error: 'recurrence_interval must be weekly or monthly' }, { status: 400 })
  }
  if (trip_id !== undefined && trip_id !== null && typeof trip_id !== 'string') {
    return NextResponse.json({ error: 'trip_id must be a string or null' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      type, amount, category, date,
      description: description ?? null,
      is_recurring: is_recurring ?? false,
      recurrence_interval: is_recurring ? recurrence_interval : null,
      trip_id: trip_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction: data }, { status: 201 })
}
