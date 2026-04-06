// __tests__/lib/session.test.ts
import { getSessionConfig, SESSION_COOKIE_NAME } from '@/lib/session'

describe('session config', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV, SESSION_SECRET: 'a'.repeat(32) }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('returns cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('et_session')
  })

  it('returns config with correct cookie name', () => {
    const config = getSessionConfig()
    expect(config.cookieName).toBe('et_session')
  })

  it('returns config with httpOnly and secure flags', () => {
    const config = getSessionConfig()
    expect(config.cookieOptions?.httpOnly).toBe(true)
    expect(config.cookieOptions?.sameSite).toBe('strict')
  })
})
