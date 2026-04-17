// src/app/api/transactions/recent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const daysParam = searchParams.get('days')

  if (daysParam && isNaN(Number(daysParam))) {
    return NextResponse.json({ error: 'days must be a number' }, { status: 400 })
  }

  const days = Math.min(90, Math.max(1, daysParam ? Number(daysParam) : 30))

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const { data, error } = await getSupabaseAdmin()
    .from('transactions')
    .select('*')
    .gte('date', cutoffStr)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data ?? [] })
}
