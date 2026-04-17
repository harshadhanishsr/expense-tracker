// src/app/api/ai/digest/route.ts
import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'gemma3:4b'

export async function POST(req: NextRequest) {
  const { weekTotal, topCategory, topCategoryAmount, prevWeekTotal } = await req.json()

  const fallback = `Last week: ₹${weekTotal} spent. ${topCategory} was biggest (₹${topCategoryAmount}).`

  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8000)
    const prompt = `Write a friendly 1-2 sentence weekly spending summary in Tanglish (Tamil + English mix).
Be casual and encouraging. Use ₹ for amounts.

This week: ₹${weekTotal} total. Top category: ${topCategory} ₹${topCategoryAmount}.
Previous week: ₹${prevWeekTotal}.

Respond with ONLY the summary text.`

    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
      signal: ctrl.signal,
    })
    if (!res.ok) return NextResponse.json({ text: fallback })
    const data = await res.json()
    return NextResponse.json({ text: data.response?.trim() || fallback })
  } catch {
    return NextResponse.json({ text: fallback })
  }
}
