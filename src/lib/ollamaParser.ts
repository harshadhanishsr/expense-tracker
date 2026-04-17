// src/lib/ollamaParser.ts
import { ParseResult } from './types'
import { CATEGORIES, getCategoryById } from './categories'

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'gemma3:4b'
const TIMEOUT_MS = 8000

export async function ollamaParse(
  userText: string,
  examples: Array<{ input: string; result: ParseResult }>
): Promise<ParseResult | null> {
  const expenseCats = CATEGORIES.filter(c => c.type === 'expense').map(c => c.id).join(', ')
  const incomeCats = CATEGORIES.filter(c => c.type === 'income').map(c => c.id).join(', ')

  const fewShotExamples = examples
    .map(e => `Input: "${e.input}"\nOutput: ${JSON.stringify({
      amount: e.result.amount,
      category: e.result.category,
      description: e.result.description,
      type: e.result.type,
      confidence: e.result.confidence,
    })}`)
    .join('\n\n')

  const prompt = `You are an expense parser for a personal finance app. Extract the transaction details from the user's input.
The user speaks Tamil and English (Tanglish). Understand both.

For expenses, valid category IDs are: ${expenseCats}
For income, valid category IDs are: ${incomeCats}

Examples from this user's history:
${fewShotExamples || '(none yet)'}

Input: "${userText}"

Respond ONLY with valid JSON, no explanation:
{"amount": number, "category": string, "description": string, "type": "expense" or "income", "confidence": "high" or "low"}`

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    const raw = JSON.parse(data.response.trim())

    // Validate and sanitise output
    const type: 'expense' | 'income' = raw.type === 'income' ? 'income' : 'expense'
    const fallbackCat = type === 'income' ? 'other_income' : 'other_expense'
    const category = getCategoryById(raw.category) ? raw.category : fallbackCat
    const amount = typeof raw.amount === 'number' && raw.amount > 0 ? raw.amount : 0
    const description = typeof raw.description === 'string' && raw.description.trim()
      ? raw.description.trim()
      : userText
    const confidence: 'high' | 'low' = amount > 0 ? (raw.confidence === 'high' ? 'high' : 'low') : 'low'

    return { amount, category, description, type, confidence }
  } catch {
    return null
  }
}
