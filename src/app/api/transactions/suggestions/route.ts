// src/app/api/transactions/suggestions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { Suggestion } from '@/lib/types'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5'), 10)

  if (q.length < 2) return NextResponse.json({ suggestions: [] })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('transactions')
    .select('description, category, amount')
    .ilike('description', `${q}%`)
    .eq('type', 'expense')
    .not('description', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const seen = new Set<string>()
  const suggestions: Suggestion[] = []
  for (const row of data ?? []) {
    const key = (row.description as string).toLowerCase()
    if (!seen.has(key) && suggestions.length < limit) {
      seen.add(key)
      suggestions.push({
        description: row.description as string,
        category: row.category,
        amount: Number(row.amount),
      })
    }
  }

  return NextResponse.json({ suggestions })
}
