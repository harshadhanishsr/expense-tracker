// src/app/api/ai/parse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ollamaParse } from '@/lib/ollamaParser'

export async function POST(req: NextRequest) {
  const { input, examples = [] } = await req.json()
  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'input required' }, { status: 400 })
  }
  const result = await ollamaParse(input, examples)
  if (!result) return NextResponse.json({ error: 'ollama unavailable' }, { status: 503 })
  return NextResponse.json(result)
}
