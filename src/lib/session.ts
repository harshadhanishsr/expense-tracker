// src/lib/session.ts
import type { SessionOptions } from 'iron-session'

export const SESSION_COOKIE_NAME = 'et_session'

export interface SessionData {
  authenticated: boolean
}

export function getSessionConfig(): SessionOptions {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters')
  }
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: secret,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: undefined, // expires when browser closes
    },
  }
}

import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function requireAuth(): Promise<{ ok: true } | NextResponse> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionConfig())
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { ok: true }
}
