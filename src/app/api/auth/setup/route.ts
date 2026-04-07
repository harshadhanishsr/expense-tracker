import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const pin: string = body.pin ?? ''

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from('settings').select('id').single()
  if (data) {
    return NextResponse.json({ error: 'PIN already configured' }, { status: 409 })
  }

  const pin_hash = await bcrypt.hash(pin, 12)
  const { error } = await supabase.from('settings').insert({ id: 1, pin_hash })

  if (error) {
    return NextResponse.json({ error: 'Failed to save PIN' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
