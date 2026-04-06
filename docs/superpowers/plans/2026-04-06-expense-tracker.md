# Expense Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal expense + income tracker accessible from anywhere via a Vercel URL, protected by a 4-digit PIN, with data stored in Supabase PostgreSQL.

**Architecture:** Next.js 14 App Router handles both frontend and API routes. All database calls happen server-side via API routes using the Supabase service role key — the browser never touches Supabase directly. Sessions are managed with `iron-session` (signed encrypted cookie, httpOnly).

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgreSQL), iron-session, bcryptjs, Vercel

---

## File Map

```
expense-tracker/
├── src/
│   ├── app/
│   │   ├── layout.tsx                        # Root layout
│   │   ├── globals.css                       # Tailwind base styles
│   │   ├── page.tsx                          # PIN lock / first-time setup
│   │   ├── dashboard/page.tsx                # Dashboard
│   │   ├── add/page.tsx                      # Add transaction
│   │   ├── history/page.tsx                  # Transaction history
│   │   └── api/
│   │       ├── auth/route.ts                 # POST (verify PIN), DELETE (logout)
│   │       └── transactions/
│   │           ├── route.ts                  # GET (list), POST (create)
│   │           └── [id]/route.ts             # DELETE (remove one)
│   ├── components/
│   │   ├── PinInput.tsx                      # PIN keypad (client component)
│   │   ├── BottomNav.tsx                     # Dashboard / Add / History nav
│   │   ├── SummaryCards.tsx                  # Income / Expenses / Balance cards
│   │   ├── CategoryBars.tsx                  # Top spending category bars
│   │   ├── TransactionList.tsx               # Reusable transaction rows
│   │   └── TransactionForm.tsx               # Add transaction form (client)
│   ├── lib/
│   │   ├── supabase.ts                       # Supabase server client factory
│   │   ├── session.ts                        # iron-session config + helpers
│   │   └── categories.ts                     # Category definitions (emoji, label, type)
│   └── middleware.ts                         # Route protection (redirect → / if no session)
│       ├── api/
│       │   ├── auth/
│       │   │   ├── route.ts                  # POST (verify PIN), DELETE (logout)
│       │   │   └── setup/route.ts            # POST (first-time PIN setup)
├── supabase/
│   └── migrations/001_init.sql               # DB schema
├── __tests__/
│   ├── lib/session.test.ts
│   ├── api/auth.test.ts
│   ├── api/transactions.test.ts
│   └── components/PinInput.test.tsx
├── .env.local.example
├── jest.config.ts
├── jest.setup.ts
├── next.config.ts
└── tailwind.config.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via npx)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Create: `.env.local.example`
- Create: `src/lib/categories.ts`

- [ ] **Step 1: Bootstrap Next.js project**

Run in `C:/Users/harsh/projects/`:
```bash
npx create-next-app@latest expense-tracker \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-eslint \
  --import-alias "@/*"
cd expense-tracker
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js iron-session bcryptjs
npm install --save-dev @types/bcryptjs jest @types/jest ts-jest \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  jest-environment-jsdom
```

- [ ] **Step 3: Create jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  testPathPattern: ['__tests__/**/*.test.(ts|tsx)'],
}

export default config
```

- [ ] **Step 4: Create jest.setup.ts**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create .env.local.example**

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=at-least-32-random-characters-here
```

- [ ] **Step 6: Create src/lib/categories.ts**

```typescript
// src/lib/categories.ts
export type TransactionType = 'income' | 'expense'

export interface Category {
  id: string
  label: string
  emoji: string
  type: TransactionType
}

export const CATEGORIES: Category[] = [
  // Expense categories
  { id: 'food',          label: 'Food',          emoji: '🍔', type: 'expense' },
  { id: 'transport',     label: 'Transport',     emoji: '🚗', type: 'expense' },
  { id: 'rent',          label: 'Rent',          emoji: '🏠', type: 'expense' },
  { id: 'utilities',     label: 'Utilities',     emoji: '⚡', type: 'expense' },
  { id: 'health',        label: 'Health',        emoji: '🏥', type: 'expense' },
  { id: 'shopping',      label: 'Shopping',      emoji: '🛍️', type: 'expense' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬', type: 'expense' },
  { id: 'other_expense', label: 'Other',         emoji: '📦', type: 'expense' },
  // Income categories
  { id: 'salary',        label: 'Salary',        emoji: '💰', type: 'income' },
  { id: 'freelance',     label: 'Freelance',     emoji: '💼', type: 'income' },
  { id: 'investment',    label: 'Investment',    emoji: '📈', type: 'income' },
  { id: 'other_income',  label: 'Other',         emoji: '💵', type: 'income' },
]

export function getCategoriesForType(type: TransactionType): Category[] {
  return CATEGORIES.filter(c => c.type === type)
}

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id)
}
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with dependencies and categories"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/migrations/001_init.sql`

- [ ] **Step 1: Create Supabase project**

1. Go to https://supabase.com → New Project (free tier)
2. Note your **Project URL** and **API keys** (Settings → API)
3. Copy `.env.local.example` → `.env.local` and fill in the values

- [ ] **Step 2: Create migration file**

```sql
-- supabase/migrations/001_init.sql

-- Settings table (single-row: stores PIN hash)
create table if not exists settings (
  id int primary key default 1,
  pin_hash text not null,
  created_at timestamptz default now()
);

-- Enforce single row
create unique index if not exists settings_singleton on settings (id);

-- Transactions table
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  description text,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- Index for fast monthly queries
create index if not exists transactions_date_idx on transactions (date desc);

-- Deny all by default (API routes use service_role_key which bypasses RLS)
alter table settings enable row level security;
alter table transactions enable row level security;
```

- [ ] **Step 3: Run migration in Supabase**

In Supabase dashboard → SQL Editor → paste and run `001_init.sql`.

Expected: "Success. No rows returned."

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema for settings and transactions"
```

---

## Task 3: Core Libraries (Supabase client + Session)

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/session.ts`
- Create: `__tests__/lib/session.test.ts`

- [ ] **Step 1: Write failing session test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/session.test.ts --no-coverage
```
Expected: FAIL — "Cannot find module '@/lib/session'"

- [ ] **Step 3: Create src/lib/supabase.ts**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-only client — never import this in client components
export function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 4: Create src/lib/session.ts**

```typescript
// src/lib/session.ts
import type { IronSessionOptions } from 'iron-session'

export const SESSION_COOKIE_NAME = 'et_session'

export interface SessionData {
  authenticated: boolean
}

export function getSessionConfig(): IronSessionOptions {
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/lib/session.test.ts --no-coverage
```
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/ __tests__/lib/
git commit -m "feat: add supabase client and session config"
```

---

## Task 4: Auth API Route

**Files:**
- Create: `src/app/api/auth/route.ts`
- Create: `__tests__/api/auth.test.ts`

- [ ] **Step 1: Write failing auth tests**

```typescript
// __tests__/api/auth.test.ts
// Note: These are unit tests for the auth logic, not integration tests.
// They mock Supabase and iron-session to test the route handler behaviour.
import { POST } from '@/app/api/auth/route'
import { NextRequest } from 'next/server'

// Mock iron-session
jest.mock('iron-session', () => ({
  getIronSession: jest.fn(),
}))

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: jest.fn(),
}))

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
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
    expect(res.status).toBe(404) // no PIN set yet
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/auth.test.ts --no-coverage
```
Expected: FAIL — "Cannot find module '@/app/api/auth/route'"

- [ ] **Step 3: Create src/app/api/auth/route.ts**

```typescript
// src/app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSessionConfig, type SessionData } from '@/lib/session'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const pin: string = body.pin ?? ''

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('settings')
    .select('pin_hash')
    .single()

  // No PIN set yet — handle first-time setup via separate endpoint logic
  if (error?.code === 'PGRST116' || !data) {
    return NextResponse.json({ error: 'No PIN configured' }, { status: 404 })
  }

  const match = await bcrypt.compare(pin, data.pin_hash)
  if (!match) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  const session = await getIronSession<SessionData>(await cookies(), getSessionConfig())
  session.authenticated = true
  await session.save()

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await getIronSession<SessionData>(await cookies(), getSessionConfig())
  session.destroy()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Create src/app/api/auth/setup/route.ts** (first-time PIN setup)

```typescript
// src/app/api/auth/setup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const pin: string = body.pin ?? ''

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Only allow setup if no PIN exists yet
  const { data } = await supabase.from('settings').select('id').single()
  if (data) {
    return NextResponse.json({ error: 'PIN already configured' }, { status: 409 })
  }

  const pin_hash = await bcrypt.hash(pin, 12)
  const { error } = await supabase.from('settings').insert({ id: 1, pin_hash })

  if (error) {
    return NextResponse.json({ error: 'Failed to save PIN' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/api/auth.test.ts --no-coverage
```
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/ __tests__/api/auth.test.ts
git commit -m "feat: add PIN auth API route with setup and verify endpoints"
```

---

## Task 5: Transactions API Route

**Files:**
- Create: `src/app/api/transactions/route.ts`
- Create: `src/app/api/transactions/[id]/route.ts`
- Create: `__tests__/api/transactions.test.ts`

- [ ] **Step 1: Write failing transactions tests**

```typescript
// __tests__/api/transactions.test.ts
import { GET, POST } from '@/app/api/transactions/route'
import { NextRequest } from 'next/server'

jest.mock('iron-session', () => ({ getIronSession: jest.fn() }))
jest.mock('@/lib/supabase', () => ({ getSupabaseAdmin: jest.fn() }))

import { getIronSession } from 'iron-session'
import { getSupabaseAdmin } from '@/lib/supabase'

const mockGetIronSession = getIronSession as jest.Mock
const mockGetSupabaseAdmin = getSupabaseAdmin as jest.Mock

function authedSession() {
  mockGetIronSession.mockResolvedValue({ authenticated: true })
}

function makeRequest(method: string, body?: object, search?: string) {
  const url = `http://localhost/api/transactions${search ? '?' + search : ''}`
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

describe('GET /api/transactions', () => {
  it('returns 401 if not authenticated', async () => {
    mockGetIronSession.mockResolvedValue({ authenticated: false })
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('returns transactions for the given month', async () => {
    authedSession()
    const mockData = [{ id: '1', type: 'expense', amount: 100, category: 'food', date: '2026-04-01' }]
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          gte: () => ({ lte: () => ({ order: async () => ({ data: mockData, error: null }) }) }),
        }),
      }),
    })
    const res = await GET(makeRequest('GET', undefined, 'month=2026-04'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.transactions).toHaveLength(1)
  })
})

describe('POST /api/transactions', () => {
  it('returns 401 if not authenticated', async () => {
    mockGetIronSession.mockResolvedValue({ authenticated: false })
    const res = await POST(makeRequest('POST', { type: 'expense', amount: 100, category: 'food', date: '2026-04-01' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 if required fields are missing', async () => {
    authedSession()
    const res = await POST(makeRequest('POST', { type: 'expense' }))
    expect(res.status).toBe(400)
  })

  it('creates a transaction and returns it', async () => {
    authedSession()
    const newTx = { id: 'abc', type: 'expense', amount: 200, category: 'food', date: '2026-04-01' }
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: newTx, error: null }) }) }),
      }),
    })
    const res = await POST(makeRequest('POST', { type: 'expense', amount: 200, category: 'food', date: '2026-04-01' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.transaction.id).toBe('abc')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/transactions.test.ts --no-coverage
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create auth guard helper in src/lib/session.ts** (add to existing file)

Append to `src/lib/session.ts`:
```typescript
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function requireAuth(): Promise<{ session: SessionData } | NextResponse> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionConfig())
  if (!session.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { session }
}
```

- [ ] **Step 4: Create src/app/api/transactions/route.ts**

```typescript
// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/session'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // format: YYYY-MM
  const type = searchParams.get('type')   // 'income' | 'expense' | null

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('transactions')
    .select('*')

  if (month) {
    const [year, m] = month.split('-')
    const start = `${year}-${m}-01`
    const end = new Date(Number(year), Number(m), 0).toISOString().slice(0, 10)
    query = query.gte('date', start).lte('date', end)
  }

  if (type === 'income' || type === 'expense') {
    query = query.eq('type', type)
  }

  const search = searchParams.get('search')
  if (search) {
    query = query.or(`description.ilike.%${search}%,category.ilike.%${search}%`)
  }

  const { data, error } = await query.order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ transactions: data })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  const { type, amount, category, date, description } = body

  if (!type || !amount || !category || !date) {
    return NextResponse.json({ error: 'type, amount, category, and date are required' }, { status: 400 })
  }

  if (!['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type must be income or expense' }, { status: 400 })
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transactions')
    .insert({ type, amount, category, date, description: description ?? null })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ transaction: data }, { status: 201 })
}
```

- [ ] **Step 5: Create src/app/api/transactions/[id]/route.ts**

```typescript
// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/session'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest __tests__/api/transactions.test.ts --no-coverage
```
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/transactions/ src/lib/session.ts __tests__/api/transactions.test.ts
git commit -m "feat: add transactions CRUD API routes"
```

---

## Task 6: Middleware (Route Protection)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { getSessionConfig, type SessionData } from '@/lib/session'

const PROTECTED = ['/dashboard', '/add', '/history']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  // iron-session needs a Response to set cookies — use a dummy one for reads
  const res = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, getSessionConfig())

  if (!session.authenticated) {
    const loginUrl = new URL('/', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/add/:path*', '/history/:path*'],
}
```

- [ ] **Step 2: Verify middleware compiles**

```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add middleware to protect dashboard, add, and history routes"
```

---

## Task 7: PIN Lock Page (UI)

**Files:**
- Create: `src/components/PinInput.tsx`
- Create: `src/app/page.tsx`
- Create: `__tests__/components/PinInput.test.tsx`

- [ ] **Step 1: Write failing PinInput test**

```typescript
// __tests__/components/PinInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import PinInput from '@/components/PinInput'

describe('PinInput', () => {
  it('renders 4 dot indicators', () => {
    render(<PinInput onComplete={jest.fn()} />)
    const dots = screen.getAllByTestId('pin-dot')
    expect(dots).toHaveLength(4)
  })

  it('fills dots as digits are entered', () => {
    render(<PinInput onComplete={jest.fn()} />)
    fireEvent.click(screen.getByText('1'))
    fireEvent.click(screen.getByText('2'))
    // First two dots should be filled
    const dots = screen.getAllByTestId('pin-dot')
    expect(dots[0]).toHaveClass('bg-blue-500')
    expect(dots[1]).toHaveClass('bg-blue-500')
    expect(dots[2]).not.toHaveClass('bg-blue-500')
  })

  it('calls onComplete with 4-digit string when full', () => {
    const onComplete = jest.fn()
    render(<PinInput onComplete={onComplete} />)
    ;['1','2','3','4'].forEach(d => fireEvent.click(screen.getByText(d)))
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('backspace removes last digit', () => {
    render(<PinInput onComplete={jest.fn()} />)
    fireEvent.click(screen.getByText('5'))
    fireEvent.click(screen.getByText('⌫'))
    const dots = screen.getAllByTestId('pin-dot')
    expect(dots[0]).not.toHaveClass('bg-blue-500')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/PinInput.test.tsx --no-coverage
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create src/components/PinInput.tsx**

```tsx
// src/components/PinInput.tsx
'use client'
import { useState } from 'react'

interface Props {
  onComplete: (pin: string) => void
  error?: string
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export default function PinInput({ onComplete, error }: Props) {
  const [digits, setDigits] = useState<string[]>([])

  function handleKey(key: string) {
    if (key === '⌫') {
      setDigits(d => d.slice(0, -1))
      return
    }
    if (key === '') return
    if (digits.length >= 4) return

    const next = [...digits, key]
    setDigits(next)
    if (next.length === 4) {
      onComplete(next.join(''))
      setDigits([])
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Dots */}
      <div className="flex gap-4">
        {[0,1,2,3].map(i => (
          <div
            key={i}
            data-testid="pin-dot"
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              digits.length > i
                ? 'bg-blue-500 border-blue-500'
                : 'border-slate-500 bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) => (
          <button
            key={i}
            onClick={() => handleKey(key)}
            disabled={key === ''}
            className={`w-14 h-14 rounded-xl text-lg font-semibold transition-colors ${
              key === ''
                ? 'invisible'
                : key === '⌫'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-slate-700 text-white hover:bg-slate-600 active:bg-slate-500'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/PinInput.test.tsx --no-coverage
```
Expected: PASS (4 tests)

- [ ] **Step 5: Create src/app/page.tsx**

```tsx
// src/app/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PinInput from '@/components/PinInput'

export default function PinPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isSetup, setIsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupPin, setSetupPin] = useState('')

  useEffect(() => {
    // Check if PIN is configured yet
    fetch('/api/auth', { method: 'POST', body: JSON.stringify({ pin: '0000' }), headers: { 'Content-Type': 'application/json' } })
      .then(r => {
        if (r.status === 404) setIsSetup(true)  // no PIN set
        setLoading(false)
      })
  }, [])

  async function handlePin(pin: string) {
    setError('')
    if (isSetup) {
      if (!setupPin) {
        setSetupPin(pin)
        return
      }
      // Confirm step
      if (pin !== setupPin) {
        setError('PINs do not match, try again')
        setSetupPin('')
        return
      }
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ pin }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        // Now authenticate
        await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ pin }), headers: { 'Content-Type': 'application/json' } })
        router.push('/dashboard')
      }
      return
    }

    const res = await fetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ pin }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      router.push('/dashboard')
    } else {
      setError('Incorrect PIN')
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400">Loading...</div>
    </main>
  )

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <p className="text-slate-400 text-sm tracking-widest uppercase mb-2">Expense Tracker</p>
        <h1 className="text-white text-2xl font-bold">
          {isSetup
            ? setupPin ? 'Confirm PIN' : 'Set your PIN'
            : 'Enter PIN'}
        </h1>
        {isSetup && !setupPin && (
          <p className="text-slate-400 text-sm mt-2">You'll enter it twice to confirm</p>
        )}
      </div>
      <PinInput onComplete={handlePin} error={error} />
    </main>
  )
}
```

- [ ] **Step 6: Update src/app/layout.tsx**

Replace default content with:
```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Personal income and expense tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50`}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: Run all tests**

```bash
npx jest --no-coverage
```
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/components/PinInput.tsx __tests__/components/
git commit -m "feat: add PIN lock page with first-time setup flow"
```

---

## Task 8: Shared Components

**Files:**
- Create: `src/components/BottomNav.tsx`
- Create: `src/components/SummaryCards.tsx`
- Create: `src/components/CategoryBars.tsx`
- Create: `src/components/TransactionList.tsx`

- [ ] **Step 1: Create src/components/BottomNav.tsx**

```tsx
// src/components/BottomNav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex items-center justify-around px-6 pb-safe">
      <Link
        href="/dashboard"
        className={`flex flex-col items-center py-3 gap-1 text-xs transition-colors ${
          pathname === '/dashboard' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <span className="text-xl">🏠</span>
        Dashboard
      </Link>

      <Link
        href="/add"
        className="flex flex-col items-center -mt-5"
      >
        <div className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors flex items-center justify-center text-white text-3xl shadow-lg shadow-blue-500/30">
          +
        </div>
      </Link>

      <Link
        href="/history"
        className={`flex flex-col items-center py-3 gap-1 text-xs transition-colors ${
          pathname === '/history' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <span className="text-xl">📋</span>
        History
      </Link>
    </nav>
  )
}
```

- [ ] **Step 2: Create src/components/SummaryCards.tsx**

```tsx
// src/components/SummaryCards.tsx
interface Props {
  income: number
  expenses: number
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SummaryCards({ income, expenses }: Props) {
  const balance = income - expenses

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white rounded-xl p-4 border-l-4 border-green-500 shadow-sm">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Income</p>
        <p className="text-lg font-bold text-green-600">{fmt(income)}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border-l-4 border-red-500 shadow-sm">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Expenses</p>
        <p className="text-lg font-bold text-red-500">{fmt(expenses)}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border-l-4 border-blue-500 shadow-sm">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Balance</p>
        <p className={`text-lg font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmt(balance)}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create src/components/CategoryBars.tsx**

```tsx
// src/components/CategoryBars.tsx
import { getCategoryById } from '@/lib/categories'

interface Transaction {
  type: string
  amount: number
  category: string
}

interface Props {
  transactions: Transaction[]
}

export default function CategoryBars({ transactions }: Props) {
  const expenses = transactions.filter(t => t.type === 'expense')

  const totals: Record<string, number> = {}
  for (const t of expenses) {
    totals[t.category] = (totals[t.category] ?? 0) + t.amount
  }

  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const max = sorted[0]?.[1] ?? 1

  if (sorted.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-4">No expenses this month</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map(([id, total]) => {
        const cat = getCategoryById(id)
        const pct = Math.round((total / max) * 100)
        return (
          <div key={id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-700">{cat?.emoji} {cat?.label ?? id}</span>
              <span className="text-slate-500">₹{total.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-red-100 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Create src/components/TransactionList.tsx**

```tsx
// src/components/TransactionList.tsx
'use client'
import { getCategoryById } from '@/lib/categories'

interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description?: string
  date: string
}

interface Props {
  transactions: Transaction[]
  onDelete?: (id: string) => void
  limit?: number
}

function fmt(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN')
}

export default function TransactionList({ transactions, onDelete, limit }: Props) {
  const rows = limit ? transactions.slice(0, limit) : transactions

  if (rows.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-6">No transactions yet</p>
  }

  return (
    <div className="divide-y divide-slate-100">
      {rows.map(t => {
        const cat = getCategoryById(t.category)
        return (
          <div key={t.id} className="flex items-center justify-between py-3 px-1">
            <div className="flex-1 min-w-0">
              <p className="text-slate-800 font-medium text-sm truncate">
                {t.description || cat?.label || t.category}
              </p>
              <p className="text-slate-400 text-xs">
                {cat?.emoji} {cat?.label ?? t.category} · {t.date}
              </p>
            </div>
            <div className="flex items-center gap-3 ml-3">
              <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </span>
              {onDelete && (
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none"
                  aria-label="Delete transaction"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add BottomNav, SummaryCards, CategoryBars, and TransactionList components"
```

---

## Task 9: Dashboard Page

**Files:**
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard page**

```tsx
// src/app/dashboard/page.tsx
import { getSupabaseAdmin } from '@/lib/supabase'
import SummaryCards from '@/components/SummaryCards'
import CategoryBars from '@/components/CategoryBars'
import TransactionList from '@/components/TransactionList'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

interface SearchParams { month?: string }

async function getTransactions(month: string) {
  const [year, m] = month.split('-')
  const start = `${year}-${m.padStart(2,'0')}-01`
  const end = new Date(Number(year), Number(m), 0).toISOString().slice(0, 10)

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })

  return data ?? []
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = searchParams.month ?? currentMonth

  const [year, m] = month.split('-').map(Number)
  const transactions = await getTransactions(month)

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  // Month navigation
  const prevDate = new Date(year, m - 2, 1)
  const nextDate = new Date(year, m, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2,'0')}`
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2,'0')}`
  const isCurrentMonth = month === currentMonth

  const monthLabel = new Date(year, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 pt-10 pb-6">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href={`/dashboard?month=${prevMonth}`} className="text-slate-400 hover:text-white p-2">‹</Link>
          <h1 className="text-lg font-semibold">{monthLabel}</h1>
          <Link
            href={`/dashboard?month=${nextMonth}`}
            className={`p-2 ${isCurrentMonth ? 'text-slate-600 pointer-events-none' : 'text-slate-400 hover:text-white'}`}
          >›</Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-2 space-y-4">
        {/* Summary */}
        <SummaryCards income={income} expenses={expenses} />

        {/* Category breakdown */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Top Spending</h2>
          <CategoryBars transactions={transactions} />
        </div>

        {/* Recent */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Recent</h2>
            <Link href="/history" className="text-blue-500 text-xs hover:underline">See all</Link>
          </div>
          <TransactionList transactions={transactions} limit={5} />
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
```

- [ ] **Step 2: Run dev server and verify dashboard loads**

```bash
npm run dev
```
Open http://localhost:3000 → enter PIN → should land on dashboard.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/
git commit -m "feat: add dashboard page with summary, category bars, and recent transactions"
```

---

## Task 10: Add Transaction Page

**Files:**
- Create: `src/components/TransactionForm.tsx`
- Create: `src/app/add/page.tsx`

- [ ] **Step 1: Create src/components/TransactionForm.tsx**

```tsx
// src/components/TransactionForm.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCategoriesForType, type TransactionType } from '@/lib/categories'

export default function TransactionForm() {
  const router = useRouter()
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const categories = getCategoriesForType(type)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!amount || !category) { setError('Amount and category are required'); return }
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) { setError('Enter a valid amount'); return }

    setSubmitting(true)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount: numAmount, category, description, date }),
    })
    setSubmitting(false)

    if (res.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError('Failed to save. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type toggle */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        {(['expense', 'income'] as TransactionType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setCategory('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors capitalize ${
              type === t
                ? t === 'expense' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                : 'text-slate-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div className="bg-white rounded-xl p-5 text-center shadow-sm">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Amount (₹)</p>
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="text-4xl font-bold text-slate-800 text-center w-full outline-none bg-transparent placeholder:text-slate-200"
        />
      </div>

      {/* Category */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Category</p>
        <div className="grid grid-cols-4 gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-colors ${
                category === cat.id
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                  : 'bg-white text-slate-600 border-2 border-transparent shadow-sm hover:border-slate-200'
              }`}
            >
              <span className="text-xl">{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-slate-800 text-sm w-full outline-none bg-transparent"
        />
      </div>

      {/* Note */}
      <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Note (optional)</label>
        <input
          type="text"
          placeholder="What was this for?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="text-slate-800 text-sm w-full outline-none bg-transparent placeholder:text-slate-300"
        />
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className={`w-full py-4 rounded-xl font-semibold text-white transition-colors ${
          type === 'expense' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
        } disabled:opacity-60`}
      >
        {submitting ? 'Saving...' : `Add ${type === 'expense' ? 'Expense' : 'Income'}`}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create src/app/add/page.tsx**

```tsx
// src/app/add/page.tsx
import TransactionForm from '@/components/TransactionForm'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function AddPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-800 text-white px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/dashboard" className="text-slate-400 hover:text-white">‹</Link>
          <h1 className="text-lg font-semibold">Add Transaction</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4">
        <TransactionForm />
      </div>

      <BottomNav />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/add/ src/components/TransactionForm.tsx
git commit -m "feat: add transaction form page (income and expense)"
```

---

## Task 11: History Page

**Files:**
- Create: `src/app/history/page.tsx`

- [ ] **Step 1: Create history page**

```tsx
// src/app/history/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import TransactionList from '@/components/TransactionList'
import BottomNav from '@/components/BottomNav'

interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description?: string
  date: string
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ month })
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (search) params.set('search', search)
    const res = await fetch(`/api/transactions?${params}`)
    const json = await res.json()
    setTransactions(json.transactions ?? [])
    setLoading(false)
  }, [month, typeFilter, search])

  useEffect(() => {
    const timer = setTimeout(fetchTransactions, 300) // debounce search
    return () => clearTimeout(timer)
  }, [fetchTransactions])

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setTransactions(tx => tx.filter(t => t.id !== id))
  }

  // Generate last 12 months for dropdown
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    return { val, label }
  })

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-800 text-white px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold mb-4">Transaction History</h1>

          {/* Search */}
          <input
            type="text"
            placeholder="🔍 Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-700 text-white placeholder:text-slate-400 rounded-xl px-4 py-2.5 text-sm outline-none mb-3"
          />

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none flex-1"
            >
              {monthOptions.map(o => (
                <option key={o.val} value={o.val}>{o.label}</option>
              ))}
            </select>

            {(['all', 'income', 'expense'] as const).map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                  typeFilter === f ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4">
        {loading ? (
          <p className="text-slate-400 text-sm text-center py-8">Loading...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm px-4">
            <TransactionList
              transactions={transactions}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/history/
git commit -m "feat: add history page with search, filter by month and type, and delete"
```

---

## Task 12: Final Polish + Deploy

**Files:**
- Modify: `next.config.ts`
- Create: `src/app/globals.css` (update)

- [ ] **Step 1: Add safe-area padding to globals.css**

In `src/app/globals.css`, ensure you have:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```
Expected: All tests pass

- [ ] **Step 3: Run dev and smoke-test the full flow**

```bash
npm run dev
```

Manual checklist:
- [ ] Visit http://localhost:3000 → Set your 4-digit PIN (confirm step)
- [ ] Land on Dashboard (shows empty state)
- [ ] Add an expense (e.g. ₹320 · Food)
- [ ] Add an income (e.g. ₹45,000 · Salary)
- [ ] Dashboard shows correct income, expenses, balance
- [ ] Category bar appears for the expense
- [ ] History page shows both transactions
- [ ] Search works (type "Salary" → only salary shows)
- [ ] Delete a transaction → disappears from list

- [ ] **Step 4: Push to GitHub**

```bash
git add .
git commit -m "feat: complete expense tracker with PIN auth, dashboard, add, and history"
git remote add origin https://github.com/<your-username>/expense-tracker.git
git push -u origin main
```

- [ ] **Step 5: Deploy to Vercel**

1. Go to https://vercel.com → New Project → Import your GitHub repo
2. Framework preset: **Next.js** (auto-detected)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase project URL
   - `SUPABASE_ANON_KEY` → your anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → your service role key
   - `SESSION_SECRET` → run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate
4. Click **Deploy**
5. Vercel provides a URL like `https://expense-tracker-abc123.vercel.app`

- [ ] **Step 6: First-time setup on production**

Visit your Vercel URL → set your PIN → start tracking!

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: add deploy notes and final polish"
```

---

## Summary

| Task | What it builds |
|------|----------------|
| 1 | Project scaffold, dependencies, categories |
| 2 | Supabase database schema |
| 3 | Supabase client + session config |
| 4 | PIN auth API (verify + first-time setup) |
| 5 | Transactions CRUD API |
| 6 | Middleware (route protection) |
| 7 | PIN lock / setup page |
| 8 | Shared components (nav, cards, bars, list) |
| 9 | Dashboard page |
| 10 | Add transaction page |
| 11 | History page |
| 12 | Polish + Vercel deploy |
