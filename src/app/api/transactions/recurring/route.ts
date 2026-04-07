// src/app/api/transactions/recurring/route.ts
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { data } = await getSupabaseAdmin()
    .from('transactions')
    .select('*')
    .eq('is_recurring', true)
    .order('created_at', { ascending: false })

  return NextResponse.json({ transactions: data ?? [] })
}
