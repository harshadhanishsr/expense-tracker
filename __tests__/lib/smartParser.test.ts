// __tests__/lib/smartParser.test.ts
import { parse } from '@/lib/smartParser'

describe('smartParser.parse', () => {
  // High confidence patterns
  it('parses "food 120" → food, 120, high', () => {
    const r = parse('food 120')
    expect(r.category).toBe('food')
    expect(r.amount).toBe(120)
    expect(r.confidence).toBe('high')
    expect(r.type).toBe('expense')
  })

  it('parses "120 food" → food, 120, high', () => {
    const r = parse('120 food')
    expect(r.category).toBe('food')
    expect(r.amount).toBe(120)
    expect(r.confidence).toBe('high')
  })

  it('parses "spent 80 on coffee" → food, 80, high', () => {
    const r = parse('spent 80 on coffee')
    expect(r.category).toBe('food')
    expect(r.amount).toBe(80)
    expect(r.confidence).toBe('high')
  })

  it('parses "hotel 2000 for 2 nights" → other_expense, 2000, high', () => {
    const r = parse('hotel 2000 for 2 nights')
    expect(r.category).toBe('other_expense')
    expect(r.amount).toBe(2000)
    expect(r.confidence).toBe('high')
  })

  it('parses "auto to airport 80" → transport, 80, high', () => {
    const r = parse('auto to airport 80')
    expect(r.category).toBe('transport')
    expect(r.amount).toBe(80)
    expect(r.confidence).toBe('high')
  })

  it('parses "medicine 250" → health, 250, high', () => {
    const r = parse('medicine 250')
    expect(r.category).toBe('health')
    expect(r.amount).toBe(250)
  })

  it('parses "movie 400" → entertainment, 400, high', () => {
    const r = parse('movie 400')
    expect(r.category).toBe('entertainment')
    expect(r.amount).toBe(400)
  })

  // Low confidence fallbacks
  it('parses "120" alone → other_expense, 120, low', () => {
    const r = parse('120')
    expect(r.category).toBe('other_expense')
    expect(r.amount).toBe(120)
    expect(r.confidence).toBe('low')
  })

  it('parses "xyz 120" → other_expense, 120, low', () => {
    const r = parse('xyz 120')
    expect(r.category).toBe('other_expense')
    expect(r.amount).toBe(120)
    expect(r.confidence).toBe('low')
  })

  // Edge cases
  it('is case-insensitive: "FOOD 100"', () => {
    const r = parse('FOOD 100')
    expect(r.category).toBe('food')
    expect(r.amount).toBe(100)
  })

  it('handles decimal amounts: "coffee 45.50"', () => {
    const r = parse('coffee 45.50')
    expect(r.amount).toBe(45.5)
  })

  it('returns description from input', () => {
    const r = parse('dinner at pizza place 350')
    expect(r.description).toBeTruthy()
    expect(typeof r.description).toBe('string')
  })
})
