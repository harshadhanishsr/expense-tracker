# Trip Mode, Smart Input, Voice Entry & PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Trip Mode (grouped expenses per trip), a smart text/voice input bar (regex parser, app-wide), and PWA support (iOS installable) to the existing expense tracker.

**Architecture:** A React Context (`TripContext`) provides the active trip app-wide. A floating `AIInputBar` (above the bottom nav in root layout) handles all quick expense entry via text or voice, auto-tagging to the active trip. Trips are stored in a new Supabase `trips` table with a `trip_id` FK added to `transactions`.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching routes/layouts), Supabase (PostgreSQL), TypeScript, Tailwind CSS, Web Speech API (browser-built-in, free), Jest + React Testing Library.

> ⚠️ **Before writing any Next.js route handler, layout, or metadata API code:** read `node_modules/next/dist/docs/` — this project uses a version with breaking changes from common training data.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/003_trips.sql` | DB schema: trips table + trip_id FK on transactions |
| Modify | `src/lib/types.ts` | Add `trip_id` to Transaction; add Trip, TripWithTransactions, ParseResult |
| Create | `src/lib/smartParser.ts` | Regex text → ParseResult (category ID, amount, description, confidence) |
| Create | `src/lib/tripContext.tsx` | React Context: activeTrip state, refreshActiveTrip, provider |
| Create | `src/app/api/trips/route.ts` | GET list + POST create |
| Create | `src/app/api/trips/[id]/route.ts` | GET detail + PATCH update + DELETE |
| Modify | `src/app/api/transactions/route.ts` | Accept + persist optional `trip_id` |
| Create | `src/components/VoiceInput.tsx` | Mic button using Web Speech API |
| Create | `src/components/AIInputBar.tsx` | Floating input bar (text + voice), uses TripContext |
| Modify | `src/components/BottomNav.tsx` | Replace Daily with Trips tab; amber/coral accent; active trip badge |
| Modify | `src/app/layout.tsx` | Wrap with TripContext provider; render AIInputBar; add PWA metadata + SW registration |
| Create | `src/app/trips/page.tsx` | Trip list: active card + past trips + new trip sheet |
| Create | `src/app/trips/[id]/page.tsx` | Trip detail: budget ring + category grid + timeline |
| Create | `src/components/TripCard.tsx` | Reusable active trip card (used in dashboard + trips list) |
| Create | `src/components/TripCategoryGrid.tsx` | 2×2 bento category tiles |
| Create | `src/components/TripTimeline.tsx` | Day-by-day expense groups |
| Modify | `src/app/dashboard/page.tsx` | Add active trip banner (TripCard) at top |
| Create | `src/components/SWRegistrar.tsx` | Client component that registers the service worker |
| Create | `src/app/offline/page.tsx` | Offline fallback page |
| Create | `public/manifest.json` | PWA manifest |
| Create | `public/sw.js` | Service worker: cache-first static, network-first API, offline fallback |
| Create | `public/icon-192.png` | PWA icon (generated via script) |
| Create | `public/icon-512.png` | PWA icon (generated via script) |
| Create | `__tests__/lib/smartParser.test.ts` | Parser unit tests |
| Create | `__tests__/api/trips.test.ts` | Trips API route tests |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/003_trips.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/003_trips.sql

-- 1. New trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

-- 2. Add trip_id FK to transactions
ALTER TABLE transactions
  ADD COLUMN trip_id UUID REFERENCES trips(id) ON DELETE SET NULL;

CREATE INDEX ON transactions(trip_id);
```

- [ ] **Step 2: Apply migration**

```bash
# Via Supabase dashboard SQL editor, or:
npx supabase db push
# Verify: trips table exists and transactions has trip_id column
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_trips.sql
git commit -m "feat: add trips table and trip_id FK on transactions"
```

---

## Task 2: Type Definitions

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update the file**

Replace the full contents of `src/lib/types.ts`:

```typescript
// src/lib/types.ts

export interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description?: string | null
  date: string
  created_at: string
  is_recurring: boolean
  recurrence_interval: 'daily' | 'weekly' | 'monthly' | null
  trip_id?: string | null   // nullable FK to trips.id
}

export interface Suggestion {
  description: string
  category: string
  amount: number
}

export interface Trip {
  id: string
  name: string
  start_date: string      // ISO date YYYY-MM-DD
  end_date: string        // ISO date YYYY-MM-DD
  budget: number | null
  created_at: string
  // Computed fields (returned by API)
  total_spent: number
  expense_count: number
  days_elapsed: number    // days since start_date, capped at total_days
  total_days: number      // end_date - start_date + 1
}

export interface TripWithTransactions extends Trip {
  transactions: Transaction[]
}

export interface ParseResult {
  amount: number
  category: string        // valid category ID: 'food', 'transport', etc.
  description: string
  type: 'expense' | 'income'
  confidence: 'high' | 'low'
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add Trip, TripWithTransactions, ParseResult types; add trip_id to Transaction"
```

---

## Task 3: Smart Parser

**Files:**
- Create: `src/lib/smartParser.ts`
- Create: `__tests__/lib/smartParser.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx jest __tests__/lib/smartParser.test.ts
# Expected: FAIL — "Cannot find module '@/lib/smartParser'"
```

- [ ] **Step 3: Implement the parser**

```typescript
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

  // Check if ANY word matches a keyword (confidence=high even if unrecognised words present)
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx jest __tests__/lib/smartParser.test.ts
# Expected: All tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/smartParser.ts __tests__/lib/smartParser.test.ts
git commit -m "feat: add regex-based smart expense parser with tests"
```

---

## Task 4: Trips API Routes

**Files:**
- Create: `src/app/api/trips/route.ts`
- Create: `src/app/api/trips/[id]/route.ts`
- Create: `__tests__/api/trips.test.ts`

> Read `node_modules/next/dist/docs/` for current route handler API before writing.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/api/trips.test.ts
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
      from: () => ({
        select: () => ({
          order: async () => ({ data: [{ id: '1', name: 'Test', start_date: '2026-04-12', end_date: '2026-04-17' }], error: null }),
        }),
      }),
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
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
npx jest __tests__/api/trips.test.ts
# Expected: FAIL — module not found
```

- [ ] **Step 3: Implement GET + POST `/api/trips`**

> Check `node_modules/next/dist/docs/` for NextRequest/NextResponse API.

```typescript
// src/app/api/trips/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { Trip } from '@/lib/types'

function computeTripFields(trip: any, transactions: any[]): Trip {
  const startDate = new Date(trip.start_date)
  const endDate = new Date(trip.end_date)
  const today = new Date()
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  const daysElapsed = Math.min(
    Math.max(Math.round((today.getTime() - startDate.getTime()) / 86400000) + 1, 1),
    totalDays
  )
  const expenses = transactions.filter((t: any) => t.trip_id === trip.id && t.type === 'expense')
  const totalSpent = expenses.reduce((sum: number, t: any) => sum + t.amount, 0)
  return { ...trip, total_spent: totalSpent, expense_count: expenses.length, days_elapsed: daysElapsed, total_days: totalDays }
}

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { data: trips, error: tripsErr } = await supabase
    .from('trips').select('*').order('start_date', { ascending: false })
  if (tripsErr) return NextResponse.json({ error: tripsErr.message }, { status: 500 })

  if (!trips?.length) return NextResponse.json({ trips: [] })

  const { data: transactions, error: txErr } = await supabase
    .from('transactions').select('trip_id, amount, type').not('trip_id', 'is', null)
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  const enriched = trips.map(t => computeTripFields(t, transactions ?? []))
  return NextResponse.json({ trips: enriched })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { name, start_date, end_date, budget } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!start_date || !end_date) {
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
  }
  if (new Date(end_date) < new Date(start_date)) {
    return NextResponse.json({ error: 'end_date must be >= start_date' }, { status: 400 })
  }
  if (budget !== undefined && budget !== null && (typeof budget !== 'number' || budget <= 0)) {
    return NextResponse.json({ error: 'budget must be a positive number' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Check for overlapping trips
  const { data: overlapping } = await supabase
    .from('trips').select('id')
    .gte('end_date', start_date)
    .lte('start_date', end_date)
  if (overlapping && overlapping.length > 0) {
    return NextResponse.json({ error: 'A trip already exists for those dates' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({ name: name.trim(), start_date, end_date, budget: budget ?? null })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const trip: Trip = { ...data, total_spent: 0, expense_count: 0, days_elapsed: 1, total_days: 1 }
  return NextResponse.json({ trip }, { status: 201 })
}
```

- [ ] **Step 4: Implement GET + PATCH + DELETE `/api/trips/[id]`**

```typescript
// src/app/api/trips/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = getSupabaseAdmin()
  const { data: trip, error } = await supabase
    .from('trips').select('*').eq('id', params.id).single()
  if (error || !trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const { data: transactions } = await supabase
    .from('transactions').select('*').eq('trip_id', params.id).order('date', { ascending: false })

  const startDate = new Date(trip.start_date)
  const endDate = new Date(trip.end_date)
  const today = new Date()
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  const daysElapsed = Math.min(
    Math.max(Math.round((today.getTime() - startDate.getTime()) / 86400000) + 1, 1),
    totalDays
  )
  const expenses = (transactions ?? []).filter((t: any) => t.type === 'expense')
  const totalSpent = expenses.reduce((s: number, t: any) => s + t.amount, 0)

  return NextResponse.json({
    trip: {
      ...trip,
      total_spent: totalSpent,
      expense_count: expenses.length,
      days_elapsed: daysElapsed,
      total_days: totalDays,
      transactions: transactions ?? [],
    },
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const body = await req.json().catch(() => ({}))
  // start_date is immutable — silently ignore if present
  const { name, end_date, budget } = body
  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (end_date !== undefined) updates.end_date = end_date
  if (budget !== undefined) updates.budget = budget

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trips').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trip: data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('trips').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
npx jest __tests__/api/trips.test.ts
# Expected: All tests PASS
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/trips/ __tests__/api/trips.test.ts
git commit -m "feat: add trips API routes (GET list, POST create, GET detail, PATCH, DELETE)"
```

---

## Task 5: Update POST /api/transactions to Accept trip_id

**Files:**
- Modify: `src/app/api/transactions/route.ts`
- Modify: `__tests__/api/transactions.test.ts`

- [ ] **Step 1: Add test for trip_id**

In `__tests__/api/transactions.test.ts`, add inside the existing `describe('POST /api/transactions')` block:

```typescript
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
```

- [ ] **Step 2: Run — confirm new tests FAIL**

```bash
npx jest __tests__/api/transactions.test.ts
# Expected: new trip_id tests FAIL
```

- [ ] **Step 3: Update the route**

In `src/app/api/transactions/route.ts`, update the `POST` handler:

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { type, amount, category, date, description, is_recurring, recurrence_interval, trip_id } = body

  if (!type || !amount || !category || !date) {
    return NextResponse.json({ error: 'type, amount, category, and date are required' }, { status: 400 })
  }
  if (!['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type must be income or expense' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (is_recurring && !['daily', 'weekly', 'monthly'].includes(recurrence_interval)) {
    return NextResponse.json({ error: 'recurrence_interval must be weekly or monthly' }, { status: 400 })
  }
  // Validate trip_id if provided
  if (trip_id !== undefined && trip_id !== null && typeof trip_id !== 'string') {
    return NextResponse.json({ error: 'trip_id must be a string or null' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      type, amount, category, date,
      description: description ?? null,
      is_recurring: is_recurring ?? false,
      recurrence_interval: is_recurring ? recurrence_interval : null,
      trip_id: trip_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction: data }, { status: 201 })
}
```

- [ ] **Step 4: Run all transaction tests — confirm they pass**

```bash
npx jest __tests__/api/transactions.test.ts
# Expected: All tests PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/transactions/route.ts __tests__/api/transactions.test.ts
git commit -m "feat: accept optional trip_id in POST /api/transactions"
```

---

## Task 6: Trip Context

**Files:**
- Create: `src/lib/tripContext.tsx`

- [ ] **Step 1: Implement TripContext**

```typescript
// src/lib/tripContext.tsx
'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { Trip } from './types'

interface TripContextValue {
  activeTrip: Trip | null
  setActiveTrip: (t: Trip | null) => void
  refreshActiveTrip: () => Promise<void>
}

const TripContext = createContext<TripContextValue>({
  activeTrip: null,
  setActiveTrip: () => {},
  refreshActiveTrip: async () => {},
})

export function TripProvider({ children }: { children: ReactNode }) {
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null)

  const refreshActiveTrip = useCallback(async () => {
    try {
      const res = await fetch('/api/trips')
      if (!res.ok) return
      const { trips } = await res.json()
      const today = new Date().toISOString().slice(0, 10)
      // Find trips active today; pick most recent start_date if overlap
      const active = (trips as Trip[])
        .filter(t => t.start_date <= today && t.end_date >= today)
        .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
      setActiveTrip(active)
    } catch {
      // Network error — leave activeTrip unchanged
    }
  }, [])

  useEffect(() => { refreshActiveTrip() }, [refreshActiveTrip])

  return (
    <TripContext.Provider value={{ activeTrip, setActiveTrip, refreshActiveTrip }}>
      {children}
    </TripContext.Provider>
  )
}

export function useTripContext() {
  return useContext(TripContext)
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/tripContext.tsx
git commit -m "feat: add TripContext for app-wide active trip state"
```

---

## Task 7: VoiceInput Component

**Files:**
- Create: `src/components/VoiceInput.tsx`

- [ ] **Step 1: Implement VoiceInput**

```typescript
// src/components/VoiceInput.tsx
'use client'
import { useRef, useState } from 'react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  onError?: (msg: string) => void
}

export default function VoiceInput({ onTranscript, onError }: VoiceInputProps) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)

  const SpeechRec =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null

  if (!SpeechRec) return null  // hide mic if not supported

  function startListening() {
    if (listening) return
    const rec = new SpeechRec()
    rec.lang = 'en-IN'
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = (e: any) => {
      setListening(false)
      if (e.error === 'not-allowed') onError?.('Mic permission needed')
    }
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      onTranscript(transcript)
    }

    recRef.current = rec
    rec.start()
  }

  return (
    <button
      onClick={startListening}
      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg
        bg-gradient-to-br from-[#ff6b35] to-[#ff9f00] shadow-lg shadow-orange-500/30
        ${listening ? 'ring-2 ring-orange-400 ring-offset-1 ring-offset-slate-900' : ''}`}
      aria-label={listening ? 'Listening…' : 'Tap to speak'}
      title={listening ? 'Listening…' : 'Tap to speak'}
    >
      🎙️
    </button>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 3: Commit**

```bash
git add src/components/VoiceInput.tsx
git commit -m "feat: add VoiceInput component using Web Speech API"
```

---

## Task 8: AIInputBar Component

**Files:**
- Create: `src/components/AIInputBar.tsx`

- [ ] **Step 1: Implement AIInputBar**

```typescript
// src/components/AIInputBar.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { parse } from '@/lib/smartParser'
import { useTripContext } from '@/lib/tripContext'
import { ParseResult } from '@/lib/types'
import { getCategoryById, getCategoriesForType } from '@/lib/categories'
import VoiceInput from './VoiceInput'

interface Suggestion { description: string; category: string; amount: number }

export default function AIInputBar() {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { activeTrip } = useTripContext()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch suggestions on mount
  useEffect(() => {
    fetch('/api/transactions/suggestions')
      .then(r => r.json())
      .then(d => setSuggestions((d.suggestions ?? []).slice(0, 3)))
      .catch(() => {})
  }, [])

  // Debounced parse
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!input.trim()) { setParsed(null); return }
    debounceRef.current = setTimeout(() => {
      setParsed(parse(input))
    }, 300)
  }, [input])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function submit(overrideCategory?: string) {
    if (!parsed || parsed.amount <= 0 || submitting) return
    setSubmitting(true)
    const category = overrideCategory ?? parsed.category
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: parsed.type,
          amount: parsed.amount,
          category,
          description: parsed.description,
          date: new Date().toISOString().slice(0, 10),
          trip_id: activeTrip?.id ?? null,
        }),
      })
      if (!res.ok) throw new Error()
      setInput('')
      setParsed(null)
      showToast('✓ Logged')
    } catch {
      if ((await fetch('/api/transactions').catch(() => ({ offline: true })) as any).offline) {
        showToast('You are offline')
      } else {
        showToast('Failed to log')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const catForType = getCategoriesForType('expense')

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-40 px-4">
      {/* Toast */}
      {toast && (
        <div className="mb-2 text-center text-xs text-emerald-400 font-semibold">{toast}</div>
      )}

      {/* Parse result tags */}
      {parsed && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {parsed.amount > 0 && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              ₹{parsed.amount}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-lg text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            {getCategoryById(parsed.category)?.emoji} {getCategoryById(parsed.category)?.label}
          </span>
          {activeTrip && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
              🏝️ {activeTrip.name}
            </span>
          )}
          {/* Low confidence: show category selector */}
          {parsed.confidence === 'low' && (
            <div className="w-full flex gap-1.5 mt-1 overflow-x-auto pb-0.5">
              {catForType.map(c => (
                <button key={c.id} onClick={() => submit(c.id)}
                  className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[11px] bg-slate-700/60 text-slate-300 border border-slate-600/40">
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggestion pills */}
      {!parsed && suggestions.length > 0 && (
        <div className="flex gap-1.5 mb-2 overflow-x-hidden">
          {suggestions.map((s, i) => (
            <button key={i}
              onClick={() => { setInput(`${s.description} ${s.amount}`); }}
              className="flex-shrink-0 px-2.5 py-1 rounded-2xl text-[11px] border bg-orange-500/10 border-orange-500/20 text-orange-400">
              {getCategoryById(s.category)?.emoji} {s.description}
            </button>
          ))}
        </div>
      )}

      {/* Main bar */}
      <div className="flex items-center gap-2 bg-[#16161f] border border-orange-500/30 rounded-3xl px-4 py-2.5
        shadow-xl shadow-black/50">
        <VoiceInput
          onTranscript={t => setInput(t)}
          onError={msg => showToast(msg)}
        />
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Type or speak an expense…"
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
        />
        {parsed && parsed.amount > 0 && (
          <button onClick={() => submit()}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30
              flex items-center justify-center text-sm text-orange-400">
            ➤
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AIInputBar.tsx
git commit -m "feat: add AIInputBar with smart parsing, voice input, and trip auto-tagging"
```

---

## Task 9: Update Layout — Providers, AIInputBar, PWA

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/offline/page.tsx`

> Read `node_modules/next/dist/docs/` for the Metadata API before editing layout.

- [ ] **Step 1: Update layout.tsx**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import AIInputBar from '@/components/AIInputBar'
import { TripProvider } from '@/lib/tripContext'
import SWRegistrar from '@/components/SWRegistrar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Personal income and expense tracker',
  manifest: '/manifest.json',
  // Check local Next.js docs for themeColor and appleWebApp API
  themeColor: '#ff6b35',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Expenses',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-slate-100">
        <TripProvider>
          {children}
          <AIInputBar />
          <BottomNav />
          <SWRegistrar />
        </TripProvider>
      </body>
    </html>
  )
}
```

> **Note:** If the metadata API fields (`themeColor`, `appleWebApp`) differ in this Next.js version, read `node_modules/next/dist/docs/` for correct syntax and adjust accordingly.

- [ ] **Step 2: Create SWRegistrar (client component for SW registration)**

```typescript
// src/components/SWRegistrar.tsx
'use client'
import { useEffect } from 'react'

export default function SWRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
```

- [ ] **Step 3: Create offline page**

```typescript
// src/app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#0a0a0f]">
      <div className="text-5xl">📡</div>
      <h1 className="text-xl font-bold text-white">You're offline</h1>
      <p className="text-slate-400 text-sm">Your data will sync when you reconnect.</p>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/components/SWRegistrar.tsx src/app/offline/page.tsx
git commit -m "feat: wrap layout with TripProvider, add AIInputBar, PWA metadata, SW registrar"
```

---

## Task 10: Update BottomNav

**Files:**
- Modify: `src/components/BottomNav.tsx`

- [ ] **Step 1: Rewrite BottomNav**

```typescript
// src/components/BottomNav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTripContext } from '@/lib/tripContext'

const NAV = [
  { href: '/dashboard', icon: '⊞', label: 'Home' },
  { href: '/add',       icon: null, label: 'Add' },
  { href: '/trips',     icon: '✈️',  label: 'Trips' },
  { href: '/history',   icon: '≡',  label: 'History' },
  { href: '/insights',  icon: '◈',  label: 'Insights' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { activeTrip } = useTripContext()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-lg mx-auto px-4 pb-safe pb-3">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 rounded-2xl
          flex items-center justify-around px-2 h-16 shadow-2xl shadow-black/40">
          {NAV.map(item => {
            if (item.href === '/add') {
              return (
                <Link key={item.href} href="/add" className="flex flex-col items-center -mt-6">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-3xl
                    font-light shadow-xl border-4 border-slate-950
                    bg-gradient-to-br from-[#ff6b35] to-[#ff9f00] shadow-orange-500/40">
                    +
                  </div>
                </Link>
              )
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const isTrips = item.href === '/trips'
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl relative
                  ${isActive ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <span className="text-xl">{item.icon}</span>
                {/* Active trip badge on Trips tab */}
                {isTrips && activeTrip && (
                  <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-orange-500" />
                )}
                <span className={`text-[9px] font-semibold tracking-wide`}>{item.label}</span>
                {isActive && <span className="w-1 h-1 rounded-full bg-orange-400 -mt-0.5" />}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 3: Start dev server and visually confirm nav**

```bash
npm run dev
# Open http://localhost:3000
# Verify: 5 tabs (Home, Add, Trips, History, Insights), amber/coral + button, no Daily tab
```

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat: update BottomNav — add Trips tab, remove Daily, amber/coral accent, active trip badge"
```

---

## Task 11: Trips List Page

**Files:**
- Create: `src/app/trips/page.tsx`
- Create: `src/components/TripCard.tsx`

- [ ] **Step 1: Create TripCard component**

```typescript
// src/components/TripCard.tsx
import Link from 'next/link'
import { Trip } from '@/lib/types'

interface TripCardProps {
  trip: Trip
  variant: 'active' | 'past'
}

function pct(trip: Trip) {
  if (!trip.budget) return 0
  return Math.min(Math.round((trip.total_spent / trip.budget) * 100), 100)
}

export default function TripCard({ trip, variant }: TripCardProps) {
  if (variant === 'active') {
    return (
      <Link href={`/trips/${trip.id}`} className="block">
        <div className="relative overflow-hidden rounded-2xl border border-orange-500/40 p-5
          bg-gradient-to-br from-orange-500/15 to-amber-500/8">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full
            bg-gradient-radial from-orange-500/20 to-transparent" />
          <div className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-lg text-[9px]
            uppercase tracking-widest bg-orange-500/20 border border-orange-500/35 text-orange-400">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Live
          </div>
          <div className="text-xl font-black text-white">{trip.name}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 mb-3">
            {trip.start_date} – {trip.end_date} · {trip.total_days} days
          </div>
          <div className="flex gap-5">
            <div>
              <div className="text-[10px] text-slate-500">Spent</div>
              <div className="text-lg font-black text-orange-400">₹{trip.total_spent.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Remaining</div>
              <div className="text-lg font-black text-emerald-400">
                {trip.budget ? `₹${(trip.budget - trip.total_spent).toLocaleString()}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Expenses</div>
              <div className="text-lg font-black text-white">{trip.expense_count}</div>
            </div>
          </div>
          {trip.budget && (
            <>
              <div className="mt-3 h-1 rounded-full bg-white/8">
                <div className="h-1 rounded-full bg-gradient-to-r from-[#ff6b35] to-[#ff9f00]"
                  style={{ width: `${pct(trip)}%` }} />
              </div>
              <div className="text-right text-[10px] text-slate-500 mt-1">{pct(trip)}% of budget used</div>
            </>
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/trips/${trip.id}`} className="block">
      <div className="flex items-center justify-between rounded-2xl border border-white/7
        bg-white/[0.04] p-4">
        <div>
          <div className="font-bold text-white">{trip.name}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{trip.start_date} – {trip.end_date}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-white">₹{trip.total_spent.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500">{trip.total_days} days</div>
          <div className="text-slate-600 text-base">›</div>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Create the Trips list page**

```typescript
// src/app/trips/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Trip } from '@/lib/types'
import TripCard from '@/components/TripCard'
import { useTripContext } from '@/lib/tripContext'

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', budget: '' })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { activeTrip, refreshActiveTrip } = useTripContext()
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const res = await fetch('/api/trips')
    const json = await res.json()
    setTrips(json.trips ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createTrip() {
    setFormError('')
    if (!form.name.trim() || !form.start_date || !form.end_date) {
      setFormError('Name, start date and end date are required')
      return
    }
    if (form.end_date < form.start_date) {
      setFormError('End date must be after start date')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, start_date: form.start_date,
        end_date: form.end_date, budget: form.budget ? Number(form.budget) : null,
      }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) { setFormError(json.error); return }
    setShowSheet(false)
    setForm({ name: '', start_date: '', end_date: '', budget: '' })
    await load()
    await refreshActiveTrip()
  }

  const pastTrips = trips.filter(t => t.end_date < today && t.id !== activeTrip?.id)

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-40">
      <div className="max-w-lg mx-auto px-4 pt-14">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-black text-white">My Trips ✈️</h1>
          <button onClick={() => setShowSheet(true)}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white
              bg-gradient-to-r from-[#ff6b35] to-[#ff9f00]">
            ＋ New
          </button>
        </div>

        {loading && <div className="text-slate-500 text-sm">Loading…</div>}

        {activeTrip && (
          <div className="mb-4">
            <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-2">🟠 Active</div>
            <TripCard trip={activeTrip} variant="active" />
          </div>
        )}

        {pastTrips.length > 0 && (
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-2 mt-2">Past</div>
            <div className="flex flex-col gap-2">
              {pastTrips.map(t => <TripCard key={t.id} trip={t} variant="past" />)}
            </div>
          </div>
        )}

        {!loading && trips.length === 0 && (
          <div className="text-center mt-20 text-slate-500">
            <div className="text-4xl mb-3">✈️</div>
            <p>No trips yet. Tap ＋ New to create one.</p>
          </div>
        )}
      </div>

      {/* New Trip Sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="w-full max-w-lg mx-auto bg-[#14141f] rounded-t-3xl border-t border-white/8 p-6 pb-10">
            <div className="w-9 h-1 rounded-full bg-white/20 mx-auto mb-5" />
            <h2 className="text-lg font-bold text-white mb-5">New Trip</h2>

            {formError && <p className="text-red-400 text-sm mb-3">{formError}</p>}

            {[
              { label: 'Trip Name', key: 'name', type: 'text', placeholder: 'e.g. Goa Trip' },
              { label: 'From', key: 'start_date', type: 'date', placeholder: '' },
              { label: 'To', key: 'end_date', type: 'date', placeholder: '' },
              { label: 'Budget (optional)', key: 'budget', type: 'number', placeholder: 'e.g. 12000' },
            ].map(f => (
              <div key={f.key} className="mb-3">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">{f.label}</label>
                <input
                  type={f.type} placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                />
              </div>
            ))}

            <button onClick={createTrip} disabled={submitting}
              className="w-full mt-4 py-3.5 rounded-2xl font-bold text-white text-base
                bg-gradient-to-r from-[#ff6b35] to-[#ff9f00] shadow-lg shadow-orange-500/30">
              {submitting ? 'Creating…' : 'Create Trip'}
            </button>
            <button onClick={() => setShowSheet(false)}
              className="w-full mt-2 py-2 text-slate-500 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 4: Test in browser**

```bash
npm run dev
# Navigate to /trips
# Verify: + New opens sheet, form validates, trip created and shows in list
```

- [ ] **Step 5: Commit**

```bash
git add src/app/trips/page.tsx src/components/TripCard.tsx
git commit -m "feat: add Trips list page with active/past sections and new trip sheet"
```

---

## Task 12: Trip Detail Page

**Files:**
- Create: `src/app/trips/[id]/page.tsx`
- Create: `src/components/TripCategoryGrid.tsx`
- Create: `src/components/TripTimeline.tsx`

- [ ] **Step 1: Create TripCategoryGrid**

```typescript
// src/components/TripCategoryGrid.tsx
import { Transaction } from '@/lib/types'
import { getCategoryById } from '@/lib/categories'

interface Props { transactions: Transaction[] }

export default function TripCategoryGrid({ transactions }: Props) {
  const expenses = transactions.filter(t => t.type === 'expense')
  const byCategory: Record<string, number> = {}
  for (const t of expenses) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount
  }
  const top4 = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
  const max = top4[0]?.[1] ?? 1

  if (!top4.length) return <p className="text-slate-500 text-sm px-4">No expenses yet.</p>

  return (
    <div className="grid grid-cols-2 gap-2 mx-4">
      {top4.map(([catId, total]) => {
        const cat = getCategoryById(catId)
        const count = expenses.filter(t => t.category === catId).length
        const barPct = Math.round((total / max) * 100)
        return (
          <div key={catId} className="rounded-2xl border border-white/7 bg-white/[0.04] p-4">
            <div className="text-2xl">{cat?.emoji ?? '📦'}</div>
            <div className="text-[11px] text-slate-500 mt-1.5">{cat?.label ?? catId}</div>
            <div className="text-lg font-black text-white mt-0.5">₹{total.toLocaleString()}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{count} expense{count !== 1 ? 's' : ''}</div>
            <div className="mt-2 h-0.5 rounded-full bg-white/8">
              <div className="h-0.5 rounded-full bg-gradient-to-r from-[#ff6b35] to-[#ff9f00]"
                style={{ width: `${barPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create TripTimeline**

```typescript
// src/components/TripTimeline.tsx
import { Transaction } from '@/lib/types'
import { getCategoryById } from '@/lib/categories'

interface Props { transactions: Transaction[] }

export default function TripTimeline({ transactions }: Props) {
  // Group by date DESC
  const byDate: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    if (!byDate[t.date]) byDate[t.date] = []
    byDate[t.date].push(t)
  }
  const days = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  if (!days.length) return <p className="text-slate-500 text-sm px-4 mt-4">No entries yet.</p>

  return (
    <div className="px-4 mt-4">
      {days.map((date, i) => {
        const dayTransactions = byDate[date]
        const dayTotal = dayTransactions
          .filter(t => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0)
        return (
          <div key={date} className={i > 0 ? 'mt-4' : ''}>
            <div className="flex justify-between text-[11px] text-slate-500 mb-2">
              <span>📅 {date}</span>
              <span className="text-rose-400">₹{dayTotal.toLocaleString()}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {dayTransactions.map(t => {
                const cat = getCategoryById(t.category)
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/6
                    bg-white/[0.03] px-3 py-2.5">
                    <span className="text-base">{cat?.emoji ?? '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-300 truncate">{t.description || cat?.label}</div>
                      <div className="text-[10px] text-slate-600">{cat?.label}</div>
                    </div>
                    <span className="text-sm font-bold text-rose-400">
                      ₹{t.amount.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create Trip detail page**

```typescript
// src/app/trips/[id]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TripWithTransactions } from '@/lib/types'
import TripCategoryGrid from '@/components/TripCategoryGrid'
import TripTimeline from '@/components/TripTimeline'
import Link from 'next/link'

function BudgetRing({ pct }: { pct: number }) {
  const r = 28, circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width="70" height="70" viewBox="0 0 70 70" className="-rotate-90">
      <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle cx="35" cy="35" r={r} fill="none" stroke="url(#ring-g)" strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <defs>
        <linearGradient id="ring-g" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff6b35" />
          <stop offset="100%" stopColor="#ff9f00" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [trip, setTrip] = useState<TripWithTransactions | null>(null)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then(r => r.json())
      .then(d => { setTrip(d.trip); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-slate-500">Loading…</div>
  if (!trip) return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-slate-500">Trip not found</div>

  const isActive = trip.start_date <= today && trip.end_date >= today
  const spentPct = trip.budget ? Math.min(Math.round((trip.total_spent / trip.budget) * 100), 100) : 0
  const perDay = trip.days_elapsed > 0 ? Math.round(trip.total_spent / trip.days_elapsed) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-40">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="px-4 pt-14 pb-4">
          <Link href="/trips" className="text-[12px] text-orange-400 mb-3 block">‹ My Trips</Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">{trip.name}</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">{trip.start_date} – {trip.end_date}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border flex items-center gap-1
              ${isActive ? 'bg-orange-500/20 border-orange-500/35 text-orange-400' : 'bg-slate-700/40 border-slate-600/30 text-slate-400'}`}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
              {isActive ? 'Active' : 'Closed'}
            </span>
          </div>
        </div>

        {/* Budget ring */}
        <div className="mx-4 mb-4 flex items-center gap-5 rounded-2xl border border-white/7 bg-white/[0.04] p-5">
          {trip.budget ? (
            <div className="relative flex-shrink-0">
              <BudgetRing pct={spentPct} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-black text-orange-400">{spentPct}%</span>
                <span className="text-[8px] text-slate-500">used</span>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <div>
              <div className="text-[10px] text-slate-500">Total Spent</div>
              <div className="text-lg font-black text-orange-400">₹{trip.total_spent.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Budget Left</div>
              <div className="text-base font-black text-emerald-400">
                {trip.budget ? `₹${(trip.budget - trip.total_spent).toLocaleString()}` : 'No budget set'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Per Day Avg</div>
              <div className="text-sm font-bold text-white">₹{perDay.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Category grid */}
        <div className="text-[11px] text-slate-500 uppercase tracking-widest px-4 mb-2">By Category</div>
        <TripCategoryGrid transactions={trip.transactions} />

        {/* Timeline */}
        <div className="text-[11px] text-slate-500 uppercase tracking-widest px-4 mt-5 mb-1">Day by Day</div>
        <TripTimeline transactions={trip.transactions} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 5: Test in browser**

```bash
npm run dev
# Create a trip, add expenses to it, navigate to /trips/[id]
# Verify: budget ring, category grid, timeline all render correctly
```

- [ ] **Step 6: Commit**

```bash
git add src/app/trips/[id]/page.tsx src/components/TripCategoryGrid.tsx src/components/TripTimeline.tsx
git commit -m "feat: add Trip detail page with budget ring, category grid, and timeline"
```

---

## Task 13: Dashboard — Active Trip Banner + Bento Grid

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Read the current dashboard page**

```bash
# Read src/app/dashboard/page.tsx to understand the existing structure before editing
```

- [ ] **Step 2: Add active trip banner**

Find where the page content starts (after the header/summary cards) and add this above the existing content. The banner uses `useTripContext()`:

```typescript
// Add to imports at top of dashboard/page.tsx:
import { useTripContext } from '@/lib/tripContext'
import Link from 'next/link'

// Add inside the component, after existing hooks:
const { activeTrip } = useTripContext()

// Add to JSX, near the top of the page content area:
{activeTrip && (
  <Link href={`/trips/${activeTrip.id}`}
    className="block mx-4 mb-4 rounded-2xl border border-orange-500/40 p-4
      bg-gradient-to-br from-orange-500/12 to-amber-500/6">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Live Trip
        </div>
        <div className="font-black text-white text-base">{activeTrip.name}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          Day {activeTrip.days_elapsed} of {activeTrip.total_days}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xl font-black text-white">₹{activeTrip.total_spent.toLocaleString()}</div>
        {activeTrip.budget && (
          <div className="text-[10px] text-slate-500">of ₹{activeTrip.budget.toLocaleString()}</div>
        )}
      </div>
    </div>
  </Link>
)}
```

> **Note:** If `dashboard/page.tsx` is a server component, do NOT convert the whole page to a client component — that would break server-side data fetching. Instead, extract just the banner into a new client component `src/components/ActiveTripBanner.tsx` (mark it `'use client'`, import `useTripContext` there), and render `<ActiveTripBanner />` inside the server page. This keeps data fetching server-side while the banner gets client interactivity.

- [ ] **Step 3: Test in browser**

```bash
npm run dev
# With an active trip: verify banner appears on dashboard, tapping navigates to trip detail
# Without active trip: verify banner is absent
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: add active trip banner to dashboard"
```

---

## Task 14: PWA Assets

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Create: `public/icon-192.png` (manual or via script)
- Create: `public/icon-512.png` (manual or via script)

- [ ] **Step 1: Create manifest**

```json
// public/manifest.json
{
  "name": "Expense Tracker",
  "short_name": "Expenses",
  "description": "Personal income and expense tracker",
  "display": "standalone",
  "background_color": "#0a0a0f",
  "theme_color": "#ff6b35",
  "start_url": "/dashboard",
  "scope": "/",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create service worker**

```javascript
// public/sw.js
const CACHE = 'expenses-v1'
const STATIC = ['/', '/dashboard', '/offline', '/manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // API calls: network-first, offline JSON fallback
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', offline: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Navigation: network-first, /offline fallback
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/offline'))
    )
    return
  }

  // Static: cache-first
  e.respondWith(
    caches.match(request).then(cached => cached ?? fetch(request))
  )
})
```

- [ ] **Step 3: Generate icons**

Run this Node script once to create the PNG icons (uses canvas):

```bash
node -e "
const { createCanvas } = require('canvas');
const fs = require('fs');

[192, 512].forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  // Background
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#ff6b35');
  grad.addColorStop(1, '#ff9f00');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();
  // Rupee symbol
  ctx.fillStyle = 'white';
  ctx.font = \`bold \${Math.floor(size * 0.55)}px serif\`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₹', size/2, size/2 + size*0.04);
  fs.writeFileSync(\`public/icon-\${size}.png\`, canvas.toBuffer());
  console.log(\`Created icon-\${size}.png\`);
});
"
```

If `canvas` is not available, create the icons manually (any image editor — solid `#ff6b35` background with white ₹ symbol) and place them in `public/`.

- [ ] **Step 4: Verify PWA in browser**

```bash
npm run dev
# Open Chrome DevTools → Application → Manifest
# Verify: manifest loads, icons show, service worker registers
# Open on iOS Safari → Share → Add to Home Screen → confirm full-screen launch
```

- [ ] **Step 5: Commit**

```bash
git add public/manifest.json public/sw.js public/icon-192.png public/icon-512.png
git commit -m "feat: add PWA manifest, service worker, and app icons"
```

---

## Task 15: Run Full Test Suite + Final Check

- [ ] **Step 1: Run all tests**

```bash
npx jest
# Expected: All tests pass
```

- [ ] **Step 2: TypeScript full check**

```bash
npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 3: Build check**

```bash
npm run build
# Expected: build succeeds with no errors
```

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
# Test checklist:
# ✓ Type "food 120" in AI bar → parse tags appear → submit → "✓ Logged" toast
# ✓ Tap mic → speak "auto to beach 80" → parsed correctly
# ✓ Create a trip with start/end dates → appears in /trips
# ✓ Active trip banner on dashboard
# ✓ Add expense → auto-tagged to active trip
# ✓ Trip detail shows budget ring, category grid, day timeline
# ✓ BottomNav: 5 tabs, orange accent, orange dot badge when trip active
# ✓ Install on iOS via "Add to Home Screen" → full-screen standalone
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete trip mode, smart input, voice entry, and PWA"
```

---

## Summary

| Task | Deliverable |
|------|-------------|
| 1 | DB migration: trips table + trip_id FK |
| 2 | Type definitions: Trip, ParseResult, updated Transaction |
| 3 | Smart parser with full test coverage |
| 4 | Trips API routes (list, create, detail, update, delete) with tests |
| 5 | Updated transactions API accepts trip_id |
| 6 | TripContext: active trip state, app-wide |
| 7 | VoiceInput: Web Speech API mic button |
| 8 | AIInputBar: parse + voice + trip auto-tag + confidence selector |
| 9 | Layout: TripProvider + AIInputBar + PWA metadata + SW registrar |
| 10 | BottomNav: Trips tab, amber/coral, active badge |
| 11 | Trips list page: active card, past cards, new trip sheet |
| 12 | Trip detail: budget ring, category grid, timeline |
| 13 | Dashboard: active trip banner |
| 14 | PWA: manifest, service worker, icons |
| 15 | Full test suite + build verification |
