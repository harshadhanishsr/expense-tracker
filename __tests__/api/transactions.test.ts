/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/transactions/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: jest.fn() }))

import { getSupabaseAdmin } from '@/lib/supabase'

const mockGetSupabaseAdmin = getSupabaseAdmin as jest.Mock

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/transactions')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString(), { method: 'GET' })
}

function makePostRequest(body: object) {
  return new NextRequest('http://localhost/api/transactions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/transactions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns transactions', async () => {
    const mockTransactions = [
      { id: '1', type: 'expense', amount: 500, category: 'food', date: '2025-01-01' },
    ]
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          order: async () => ({ data: mockTransactions, error: null }),
        }),
      }),
    })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.transactions).toEqual(mockTransactions)
  })
})

describe('POST /api/transactions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if required fields are missing', async () => {
    const res = await POST(makePostRequest({ type: 'expense' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 if type is invalid', async () => {
    const res = await POST(makePostRequest({ type: 'invalid', amount: 100, category: 'food', date: '2025-01-01' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 if amount is not a positive number', async () => {
    const res = await POST(makePostRequest({ type: 'expense', amount: -10, category: 'food', date: '2025-01-01' }))
    expect(res.status).toBe(400)
  })

  it('creates transaction and returns 201', async () => {
    const newTransaction = { id: '2', type: 'expense', amount: 200, category: 'food', date: '2025-01-01', description: null }
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: newTransaction, error: null }),
          }),
        }),
      }),
    })
    const res = await POST(makePostRequest({ type: 'expense', amount: 200, category: 'food', date: '2025-01-01' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.transaction).toEqual(newTransaction)
  })

  it('accepts and persists trip_id', async () => {
    const newTransaction = { id: '3', type: 'expense', amount: 100, category: 'food', date: '2025-01-01', trip_id: 'trip-uuid' }
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: newTransaction, error: null }),
          }),
        }),
      }),
    })
    const res = await POST(makePostRequest({
      type: 'expense', amount: 100, category: 'food', date: '2025-01-01', trip_id: 'trip-uuid',
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.transaction.trip_id).toBe('trip-uuid')
  })

  it('accepts null trip_id', async () => {
    const newTransaction = { id: '4', type: 'expense', amount: 100, category: 'food', date: '2025-01-01', trip_id: null }
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: newTransaction, error: null }),
          }),
        }),
      }),
    })
    const res = await POST(makePostRequest({
      type: 'expense', amount: 100, category: 'food', date: '2025-01-01', trip_id: null,
    }))
    expect(res.status).toBe(201)
  })
})
