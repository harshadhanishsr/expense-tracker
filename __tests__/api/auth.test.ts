/**
 * @jest-environment node
 */
import { POST } from '@/app/api/auth/route'
import { NextRequest } from 'next/server'

jest.mock('iron-session', () => ({ getIronSession: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({}) }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: jest.fn() }))
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }))
jest.mock('@/lib/session', () => ({
  getSessionConfig: jest.fn().mockReturnValue({ cookieName: 'et_session', password: 'a'.repeat(32) }),
  SESSION_COOKIE_NAME: 'et_session',
}))

import { getIronSession } from 'iron-session'
import { getSupabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const mockGetIronSession = getIronSession as jest.Mock
const mockGetSupabaseAdmin = getSupabaseAdmin as jest.Mock
const mockBcryptCompare = bcrypt.compare as jest.Mock

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/auth', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if pin is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 if pin is not 4 digits', async () => {
    const res = await POST(makeRequest({ pin: '123' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 if no PIN has been configured yet', async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: 'PGRST116' } }) }) }),
    })
    const res = await POST(makeRequest({ pin: '1234' }))
    expect(res.status).toBe(404)
  })

  it('returns 401 if pin is wrong', async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({ select: () => ({ single: async () => ({ data: { pin_hash: 'hash' }, error: null }) }) }),
    })
    mockBcryptCompare.mockResolvedValue(false)
    mockGetIronSession.mockResolvedValue({ save: jest.fn() })
    const res = await POST(makeRequest({ pin: '9999' }))
    expect(res.status).toBe(401)
  })

  it('returns 200 and sets session if pin is correct', async () => {
    const mockSave = jest.fn()
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({ select: () => ({ single: async () => ({ data: { pin_hash: 'hash' }, error: null }) }) }),
    })
    mockBcryptCompare.mockResolvedValue(true)
    mockGetIronSession.mockResolvedValue({ authenticated: false, save: mockSave })
    const res = await POST(makeRequest({ pin: '1234' }))
    expect(res.status).toBe(200)
    expect(mockSave).toHaveBeenCalled()
  })
})
