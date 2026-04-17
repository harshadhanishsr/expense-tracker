// src/lib/trainingStore.ts
import { ParseResult } from './types'

const KEY = 'expense-tracker:training-examples'
const MAX = 200

interface TrainingExample {
  input: string
  result: ParseResult
  corrected: boolean
  timestamp: number
}

function load(): TrainingExample[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(examples: TrainingExample[]) {
  localStorage.setItem(KEY, JSON.stringify(examples))
}

export function saveExample(input: string, result: ParseResult, corrected: boolean): void {
  const examples = load()
  examples.push({ input, result, corrected, timestamp: Date.now() })
  if (examples.length > MAX) {
    const idx = examples.findLastIndex(e => !e.corrected)
    if (idx !== -1) {
      examples.splice(idx, 1)
    } else {
      // All corrected — drop oldest corrected to keep cap hard at 200
      examples.shift()
    }
  }
  save(examples)
}

export function getTopExamples(n: number): TrainingExample[] {
  const all = load()
  const corrected = all.filter(e => e.corrected).sort((a, b) => b.timestamp - a.timestamp)
  const normal = all.filter(e => !e.corrected).sort((a, b) => b.timestamp - a.timestamp)
  return [...corrected, ...normal].slice(0, n)
}

export function clearExamples(): void {
  localStorage.removeItem(KEY)
}
