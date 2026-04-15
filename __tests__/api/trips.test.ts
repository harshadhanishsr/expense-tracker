/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/trips/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: jest.fn() }))
import { getSupabaseAdmin } from '@/lib/supabase'
const mockSupabase = getSupabaseAdmin as jest.Mock

function makeGet() {
  return new NextRequest('http://localhost/api/trips', { method: 'GET' })
}
function makePost(body: object) {
  return new NextRequest('http://localhost/api/trips', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/trips', () => {
  it('returns trips array', async () => {
    mockSupabase.mockReturnValue({
      from: (table: string) => {
        if (table === 'transactions') {
          return {
            select: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }
        }
        // trips table
        return {
          select: () => ({
            order: async () => ({
              data: [{ id: '1', name: 'Test', start_date: '2026-04-12', end_date: '2026-04-17', budget: null, created_at: '' }],
              error: null,
            }),
          }),
        }
      },
    })
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.trips)).toBe(true)
  })
})

describe('POST /api/trips', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if name is missing', async () => {
    const res = await POST(makePost({ start_date: '2026-04-12', end_date: '2026-04-17' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 if end_date < start_date', async () => {
    const res = await POST(makePost({ name: 'Trip', start_date: '2026-04-17', end_date: '2026-04-12' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/end_date/)
  })

  it('creates trip and returns 201', async () => {
    const trip = { id: 'uuid', name: 'Goa', start_date: '2026-04-12', end_date: '2026-04-17', budget: null }
    mockSupabase.mockReturnValue({
      from: (table: string) => {
        if (table === 'trips') return {
          select: () => ({
            gte: () => ({ lte: async () => ({ data: [], error: null }) }),
          }),
          insert: () => ({ select: () => ({ single: async () => ({ data: trip, error: null }) }) }),
        }
        return {}
      },
    })
    const res = await POST(makePost({ name: 'Goa', start_date: '2026-04-12', end_date: '2026-04-17' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.trip.name).toBe('Goa')
  })

  it('returns 409 if dates overlap existing trip', async () => {
    mockSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          gte: () => ({
            lte: async () => ({ data: [{ id: 'existing' }], error: null }),
          }),
        }),
      }),
    })
    const res = await POST(makePost({ name: 'Trip2', start_date: '2026-04-12', end_date: '2026-04-14' }))
    expect(res.status).toBe(409)
  })
})
