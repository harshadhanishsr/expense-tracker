// src/lib/smartParser.ts
import { ParseResult } from './types'

const KEYWORD_MAP: Record<string, string> = {
  // food
  food: 'food', lunch: 'food', dinner: 'food', breakfast: 'food',
  coffee: 'food', tea: 'food', snack: 'food', restaurant: 'food',
  cafe: 'food', drink: 'food', water: 'food', meal: 'food', eating: 'food',
  // transport
  auto: 'transport', cab: 'transport', uber: 'transport', ola: 'transport',
  bus: 'transport', train: 'transport', flight: 'transport', taxi: 'transport',
  transport: 'transport', travel: 'transport', petrol: 'transport',
  fuel: 'transport', metro: 'transport', rickshaw: 'transport',
  // other_expense (hotel/stay — no dedicated category)
  hotel: 'other_expense', stay: 'other_expense', hostel: 'other_expense',
  lodge: 'other_expense', room: 'other_expense', resort: 'other_expense',
  accommodation: 'other_expense', bnb: 'other_expense', airbnb: 'other_expense',
  // shopping
  shop: 'shopping', shopping: 'shopping', clothes: 'shopping',
  market: 'shopping', buy: 'shopping', purchase: 'shopping',
  // health
  medical: 'health', medicine: 'health', doctor: 'health',
  pharmacy: 'health', hospital: 'health', health: 'health', clinic: 'health',
  // entertainment
  movie: 'entertainment', show: 'entertainment', event: 'entertainment',
  ticket: 'entertainment', fun: 'entertainment', game: 'entertainment',
  party: 'entertainment', outing: 'entertainment',
}

function findCategory(words: string[]): string {
  for (const word of words) {
    const cat = KEYWORD_MAP[word.toLowerCase()]
    if (cat) return cat
  }
  return 'other_expense'
}

function extractAmount(input: string): number | null {
  const match = input.match(/\d+(\.\d+)?/)
  if (!match) return null
  return parseFloat(match[0])
}

export function parse(input: string): ParseResult {
  const trimmed = input.trim()
  const lower = trimmed.toLowerCase()
  const words = lower.split(/\s+/)
  const amount = extractAmount(trimmed)

  if (!amount) {
    return {
      amount: 0, category: 'other_expense',
      description: trimmed, type: 'expense', confidence: 'low',
    }
  }

  // Pattern: "spent <amount> on <desc>"
  const spentOnMatch = lower.match(/^spent\s+(\d+(?:\.\d+)?)\s+on\s+(.+)$/)
  if (spentOnMatch) {
    const desc = spentOnMatch[2]
    const cat = findCategory(desc.split(/\s+/))
    return { amount, category: cat, description: desc, type: 'expense', confidence: 'high' }
  }

  // Pattern: "<desc> <amount> for <note>"
  const forMatch = lower.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+for\s+(.+)$/)
  if (forMatch) {
    const desc = forMatch[1]
    const note = forMatch[3]
    const cat = findCategory([...desc.split(/\s+/), ...note.split(/\s+/)])
    return {
      amount, category: cat,
      description: `${desc} (${note})`, type: 'expense', confidence: 'high',
    }
  }

  // Pattern: "<desc> to <place> <amount>"
  const toPlaceMatch = lower.match(/^(.+?)\s+to\s+(.+?)\s+(\d+(?:\.\d+)?)$/)
  if (toPlaceMatch) {
    const desc = toPlaceMatch[1]
    const place = toPlaceMatch[2]
    const cat = findCategory(desc.split(/\s+/))
    return {
      amount, category: cat,
      description: `${desc} to ${place}`, type: 'expense', confidence: 'high',
    }
  }

  // Pattern: "<keyword> <amount>" or "<amount> <keyword>"
  const knownCat = findCategory(words)
  if (knownCat !== 'other_expense') {
    const desc = words.filter(w => isNaN(parseFloat(w))).join(' ')
    return { amount, category: knownCat, description: desc || trimmed, type: 'expense', confidence: 'high' }
  }

  // Check if ANY word matches a keyword
  const hasKeyword = words.some(w => KEYWORD_MAP[w.toLowerCase()])
  if (hasKeyword) {
    const desc = words.filter(w => isNaN(parseFloat(w))).join(' ')
    return { amount, category: findCategory(words), description: desc || trimmed, type: 'expense', confidence: 'high' }
  }

  // Fallback: number only or unrecognised text
  const desc = words.filter(w => isNaN(parseFloat(w))).join(' ')
  return {
    amount, category: 'other_expense',
    description: desc || trimmed, type: 'expense', confidence: 'low',
  }
}
