// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { getSessionConfig, type SessionData } from '@/lib/session'

const PROTECTED = ['/dashboard', '/add', '/history', '/daily', '/insights']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const res = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, getSessionConfig())

  if (!session.authenticated) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/add/:path*', '/history/:path*', '/daily/:path*', '/insights/:path*'],
}
