import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSessionConfig, type SessionData } from '@/lib/session'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const pin: string = body.pin ?? ''

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('settings')
    .select('pin_hash')
    .single()

  if (error?.code === 'PGRST116' || !data) {
    return NextResponse.json({ error: 'No PIN configured' }, { status: 404 })
  }

  const match = await bcrypt.compare(pin, data.pin_hash)
  if (!match) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  const session = await getIronSession<SessionData>(await cookies(), getSessionConfig())
  session.authenticated = true
  await session.save()

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await getIronSession<SessionData>(await cookies(), getSessionConfig())
  session.destroy()
  return NextResponse.json({ ok: true })
}
