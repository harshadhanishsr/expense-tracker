# UI Redesign & Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete dark-theme UI redesign + new Daily View, Insights page, smart autocomplete, and recurring transactions.

**Architecture:** Next.js 14 App Router. Server Components fetch data directly via Supabase. Client Components handle interactivity. New pages (`/daily`, `/insights`) follow the exact same patterns as `dashboard/page.tsx`. No new npm dependencies — bar charts are pure Tailwind divs.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Supabase, iron-session

---

## File Map

```
NEW:
src/lib/types.ts                                  # Shared Transaction + Suggestion interfaces
src/hooks/useDescriptionSuggestions.ts            # Debounced autocomplete hook
src/components/SuggestionDropdown.tsx             # Autocomplete dropdown UI
src/components/RecurringSection.tsx               # Recurring widget for dashboard
src/components/DayGroup.tsx                       # Day header + category grid
src/components/CategoryDayGrid.tsx                # 4-col category tile grid
src/components/BarChart.tsx                       # Pure Tailwind bar chart (client)
src/components/InsightsPeriodToggle.tsx           # Week/Month/Year toggle (client)
src/components/InsightCategoryCard.tsx            # Most/Least spent card
src/app/daily/page.tsx                            # Daily view (server component)
src/app/insights/page.tsx                         # Insights page (server component)
src/app/api/transactions/suggestions/route.ts     # GET autocomplete suggestions
src/app/api/transactions/recurring/route.ts       # GET recurring transactions
supabase/migrations/002_recurring.sql             # Add is_recurring + recurrence_interval

MODIFIED:
src/middleware.ts                                 # Add /daily, /insights to protected routes
src/components/BottomNav.tsx                      # 5 items: Home|Daily|+|Insights|History
src/components/SummaryCards.tsx                   # Dark theme restyle
src/components/CategoryBars.tsx                   # Dark theme restyle
src/components/TransactionList.tsx                # Dark theme restyle
src/components/TransactionForm.tsx                # Dark theme + autocomplete + recurring
src/app/dashboard/page.tsx                        # Dark theme + gradient header + RecurringSection
src/app/add/page.tsx                              # Dark theme header
src/app/history/page.tsx                          # Dark theme
src/app/api/transactions/route.ts                 # POST: accept is_recurring + recurrence_interval
```

---

## Task 1: DB Migration + Shared Types

**Files:**
- Create: `supabase/migrations/002_recurring.sql`
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/002_recurring.sql
alter table transactions
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval text
    check (recurrence_interval in ('weekly', 'monthly') or recurrence_interval is null);

create index if not exists transactions_recurring_idx
  on transactions (is_recurring) where is_recurring = true;
```

- [ ] **Step 2: Run migration in Supabase**

In Supabase dashboard → SQL Editor → paste `002_recurring.sql` → Run.
Expected: "Success. No rows returned."

- [ ] **Step 3: Create src/lib/types.ts**

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
  recurrence_interval: 'weekly' | 'monthly' | null
}

export interface Suggestion {
  description: string
  category: string
  amount: number
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_recurring.sql src/lib/types.ts
git commit -m "feat: add recurring columns to DB and shared types"
```

---

## Task 2: New API Routes

**Files:**
- Create: `src/app/api/transactions/suggestions/route.ts`
- Create: `src/app/api/transactions/recurring/route.ts`
- Modify: `src/app/api/transactions/route.ts`

- [ ] **Step 1: Create suggestions route**

```typescript
// src/app/api/transactions/suggestions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { Suggestion } from '@/lib/types'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5'), 10)

  if (q.length < 2) return NextResponse.json({ suggestions: [] })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('transactions')
    .select('description, category, amount')
    .ilike('description', `${q}%`)
    .eq('type', 'expense')
    .not('description', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const seen = new Set<string>()
  const suggestions: Suggestion[] = []
  for (const row of data ?? []) {
    const key = (row.description as string).toLowerCase()
    if (!seen.has(key) && suggestions.length < limit) {
      seen.add(key)
      suggestions.push({
        description: row.description as string,
        category: row.category,
        amount: Number(row.amount),
      })
    }
  }

  return NextResponse.json({ suggestions })
}
```

- [ ] **Step 2: Create recurring route**

```typescript
// src/app/api/transactions/recurring/route.ts
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { data } = await getSupabaseAdmin()
    .from('transactions')
    .select('*')
    .eq('is_recurring', true)
    .order('created_at', { ascending: false })

  return NextResponse.json({ transactions: data ?? [] })
}
```

- [ ] **Step 3: Extend POST /api/transactions to accept recurring fields**

In `src/app/api/transactions/route.ts`, find the POST handler and replace:

```typescript
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
```

With:

```typescript
  const { type, amount, category, date, description, is_recurring, recurrence_interval } = body

  if (!type || !amount || !category || !date) {
    return NextResponse.json({ error: 'type, amount, category, and date are required' }, { status: 400 })
  }
  if (!['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type must be income or expense' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (is_recurring && !['weekly', 'monthly'].includes(recurrence_interval)) {
    return NextResponse.json({ error: 'recurrence_interval must be weekly or monthly' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      type, amount, category, date,
      description: description ?? null,
      is_recurring: is_recurring ?? false,
      recurrence_interval: is_recurring ? recurrence_interval : null,
    })
    .select()
    .single()
```

- [ ] **Step 4: Run existing tests to confirm they still pass**

```bash
npx jest --no-coverage
```

Expected: All 19 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/transactions/
git commit -m "feat: add suggestions + recurring API routes, extend POST with recurring fields"
```

---

## Task 3: Autocomplete Hook + Dropdown Component

**Files:**
- Create: `src/hooks/useDescriptionSuggestions.ts`
- Create: `src/components/SuggestionDropdown.tsx`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useDescriptionSuggestions.ts
import { useState, useEffect } from 'react'
import type { Suggestion } from '@/lib/types'

export function useDescriptionSuggestions(query: string, enabled: boolean): Suggestion[] {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  useEffect(() => {
    if (!enabled || query.length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/transactions/suggestions?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const json = await res.json()
          setSuggestions(json.suggestions ?? [])
        }
      } catch {
        setSuggestions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, enabled])

  return suggestions
}
```

- [ ] **Step 2: Create SuggestionDropdown component**

```typescript
// src/components/SuggestionDropdown.tsx
'use client'
import { getCategoryById } from '@/lib/categories'
import type { Suggestion } from '@/lib/types'

interface Props {
  suggestions: Suggestion[]
  onSelect: (s: Suggestion) => void
  visible: boolean
}

export default function SuggestionDropdown({ suggestions, onSelect, visible }: Props) {
  if (!visible || suggestions.length === 0) return null

  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-700 border border-slate-600 rounded-xl overflow-hidden z-10 shadow-xl">
      {suggestions.map((s, i) => {
        const cat = getCategoryById(s.category)
        return (
          <button
            key={i}
            type="button"
            onMouseDown={() => onSelect(s)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-600 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">{cat?.emoji ?? '📦'}</span>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{s.description}</p>
                <p className="text-slate-400 text-xs">{cat?.label ?? s.category}</p>
              </div>
            </div>
            <span className="text-slate-300 text-sm font-semibold ml-3 shrink-0">
              ₹{s.amount.toLocaleString('en-IN')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/ src/components/SuggestionDropdown.tsx
git commit -m "feat: add autocomplete hook and suggestion dropdown"
```

---

## Task 4: Recurring Widget Component

**Files:**
- Create: `src/components/RecurringSection.tsx`

- [ ] **Step 1: Create RecurringSection**

```typescript
// src/components/RecurringSection.tsx
import { getCategoryById } from '@/lib/categories'
import type { Transaction } from '@/lib/types'

function fmt(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN')
}

export default function RecurringSection({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) return null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Recurring</h2>
      <div className="space-y-2">
        {transactions.map(t => {
          const cat = getCategoryById(t.category)
          return (
            <div key={t.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat?.emoji ?? '📦'}</span>
                <div>
                  <p className="text-white text-sm font-medium">{t.description || cat?.label || t.category}</p>
                  <span className="text-xs text-slate-500 capitalize">{t.recurrence_interval}</span>
                </div>
              </div>
              <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RecurringSection.tsx
git commit -m "feat: add recurring transactions widget"
```

---

## Task 5: Dark Theme — Restyle Existing Components

**Files:**
- Modify: `src/components/SummaryCards.tsx`
- Modify: `src/components/CategoryBars.tsx`
- Modify: `src/components/TransactionList.tsx`

- [ ] **Step 1: Restyle SummaryCards**

Replace the entire file content:

```typescript
// src/components/SummaryCards.tsx
function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SummaryCards({ income, expenses }: { income: number; expenses: number }) {
  const balance = income - expenses
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 border-l-4 border-l-green-500">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Income</p>
        <p className="text-base font-bold text-green-400">{fmt(income)}</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 border-l-4 border-l-red-500">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Spent</p>
        <p className="text-base font-bold text-red-400">{fmt(expenses)}</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 border-l-4 border-l-blue-500">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Balance</p>
        <p className={`text-base font-bold ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(balance)}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Restyle CategoryBars**

Replace entire file content:

```typescript
// src/components/CategoryBars.tsx
import { getCategoryById } from '@/lib/categories'

interface Transaction { type: string; amount: number; category: string }

export default function CategoryBars({ transactions }: { transactions: Transaction[] }) {
  const totals: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === 'expense')) {
    totals[t.category] = (totals[t.category] ?? 0) + Number(t.amount)
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const max = sorted[0]?.[1] ?? 1

  if (!sorted.length) {
    return <p className="text-slate-500 text-sm text-center py-4">No expenses this month</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map(([id, total]) => {
        const cat = getCategoryById(id)
        const pct = Math.round((total / max) * 100)
        return (
          <div key={id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-300">{cat?.emoji} {cat?.label ?? id}</span>
              <span className="text-slate-400">₹{total.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-slate-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Restyle TransactionList**

Replace entire file content:

```typescript
// src/components/TransactionList.tsx
'use client'
import { getCategoryById } from '@/lib/categories'

interface Transaction { id: string; type: 'income'|'expense'; amount: number; category: string; description?: string | null; date: string }

export default function TransactionList({ transactions, onDelete, limit }: { transactions: Transaction[]; onDelete?: (id: string) => void; limit?: number }) {
  const rows = limit ? transactions.slice(0, limit) : transactions
  if (!rows.length) return <p className="text-slate-500 text-sm text-center py-6">No transactions yet</p>
  return (
    <div className="divide-y divide-slate-700">
      {rows.map(t => {
        const cat = getCategoryById(t.category)
        return (
          <div key={t.id} className="flex items-center justify-between py-3 px-1">
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{t.description || cat?.label || t.category}</p>
              <p className="text-slate-500 text-xs">{cat?.emoji} {cat?.label ?? t.category} · {t.date}</p>
            </div>
            <div className="flex items-center gap-3 ml-3">
              <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                {t.type === 'income' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
              </span>
              {onDelete && (
                <button onClick={() => onDelete(t.id)} className="text-slate-600 hover:text-red-400 transition-colors text-xl leading-none" aria-label="Delete">×</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SummaryCards.tsx src/components/CategoryBars.tsx src/components/TransactionList.tsx
git commit -m "feat: dark theme restyle for SummaryCards, CategoryBars, TransactionList"
```

---

## Task 6: Dark Theme — Restyle Pages

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/add/page.tsx`
- Modify: `src/app/history/page.tsx`

- [ ] **Step 1: Restyle dashboard page**

Replace entire file:

```typescript
// src/app/dashboard/page.tsx
import { getSupabaseAdmin } from '@/lib/supabase'
import SummaryCards from '@/components/SummaryCards'
import CategoryBars from '@/components/CategoryBars'
import TransactionList from '@/components/TransactionList'
import RecurringSection from '@/components/RecurringSection'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'
import type { Transaction } from '@/lib/types'

async function getTransactions(month: string): Promise<Transaction[]> {
  const [year, m] = month.split('-')
  const start = `${year}-${m.padStart(2,'0')}-01`
  const end = new Date(Number(year), Number(m), 0).toISOString().slice(0, 10)
  const { data } = await getSupabaseAdmin()
    .from('transactions').select('*')
    .gte('date', start).lte('date', end)
    .order('date', { ascending: false })
  return (data ?? []) as Transaction[]
}

async function getRecurring(): Promise<Transaction[]> {
  const { data } = await getSupabaseAdmin()
    .from('transactions').select('*')
    .eq('is_recurring', true)
    .order('created_at', { ascending: false })
  return (data ?? []) as Transaction[]
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const month = params.month ?? currentMonth
  const [year, m] = month.split('-').map(Number)

  const [transactions, recurring] = await Promise.all([getTransactions(month), getRecurring()])

  const income = transactions.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
  const balance = income - expenses
  const todayStr = now.toISOString().slice(0,10)
  const todaySpend = transactions
    .filter(t => t.type === 'expense' && t.date === todayStr)
    .reduce((s,t) => s + Number(t.amount), 0)

  const prevDate = new Date(year, m-2, 1)
  const nextDate = new Date(year, m, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`
  const isCurrentMonth = month === currentMonth
  const monthLabel = new Date(year, m-1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

  return (
    <main className="min-h-screen bg-slate-900 pb-24">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-12 pb-8 rounded-b-3xl shadow-xl">
        <div className="max-w-lg mx-auto">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-6">
            <Link href={`/dashboard?month=${prevMonth}`} className="text-blue-200 hover:text-white p-2 -ml-2 text-xl">‹</Link>
            <h1 className="text-white font-semibold">{monthLabel}</h1>
            <Link
              href={`/dashboard?month=${nextMonth}`}
              className={`p-2 -mr-2 text-xl ${isCurrentMonth ? 'text-blue-800 pointer-events-none' : 'text-blue-200 hover:text-white'}`}
            >›</Link>
          </div>
          {/* Balance */}
          <div className="mb-4">
            <p className="text-blue-200 text-xs uppercase tracking-widest mb-1">Net Balance</p>
            <p className="text-white text-4xl font-extrabold">{fmt(balance)}</p>
          </div>
          {/* 3 stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20">
            <div>
              <p className="text-blue-200 text-xs mb-1">↑ Income</p>
              <p className="text-green-300 font-bold text-sm">{fmt(income)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs mb-1">↓ Spent</p>
              <p className="text-red-300 font-bold text-sm">{fmt(expenses)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs mb-1">📅 Today</p>
              <p className="text-white font-bold text-sm">{fmt(todaySpend)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <SummaryCards income={income} expenses={expenses} />

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Top Spending</h2>
          <CategoryBars transactions={transactions} />
        </div>

        <RecurringSection transactions={recurring} />

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recent</h2>
            <Link href="/history" className="text-blue-400 text-xs hover:underline">See all</Link>
          </div>
          <TransactionList transactions={transactions} limit={5} />
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
```

- [ ] **Step 2: Restyle add page**

Replace entire file:

```typescript
// src/app/add/page.tsx
import TransactionForm from '@/components/TransactionForm'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function AddPage() {
  return (
    <main className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-12 pb-6 rounded-b-3xl shadow-xl">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/dashboard" className="text-blue-200 hover:text-white text-xl">‹</Link>
          <h1 className="text-white text-lg font-semibold">Add Transaction</h1>
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

- [ ] **Step 3: Restyle history page**

Replace `className="min-h-screen bg-slate-50 pb-24"` with `className="min-h-screen bg-slate-900 pb-24"` and `className="bg-white rounded-xl shadow-sm px-4"` with `className="bg-slate-800 border border-slate-700 rounded-xl px-4"`.

Full replacement:

```typescript
// src/app/history/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import TransactionList from '@/components/TransactionList'
import BottomNav from '@/components/BottomNav'

interface Transaction { id: string; type: 'income'|'expense'; amount: number; category: string; description?: string; date: string }

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all'|'income'|'expense'>('all')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
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
    const timer = setTimeout(fetchTransactions, 300)
    return () => clearTimeout(timer)
  }, [fetchTransactions])

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setTransactions(tx => tx.filter(t => t.id !== id))
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    return { val, label }
  })

  return (
    <main className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-12 pb-6 rounded-b-3xl shadow-xl">
        <div className="max-w-lg mx-auto">
          <h1 className="text-white text-lg font-semibold mb-4">Transaction History</h1>
          <input type="text" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/10 text-white placeholder:text-blue-200 rounded-xl px-4 py-2.5 text-sm outline-none mb-3 border border-white/20" />
          <div className="flex gap-2">
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="bg-white/10 text-white rounded-lg px-3 py-2 text-sm outline-none flex-1 border border-white/20">
              {monthOptions.map(o => <option key={o.val} value={o.val} className="bg-slate-800">{o.label}</option>)}
            </select>
            {(['all','income','expense'] as const).map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${typeFilter===f?'bg-white text-blue-700':'bg-white/10 text-blue-100 hover:bg-white/20'}`}
              >{f}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-4">
        {loading ? <p className="text-slate-500 text-sm text-center py-8">Loading...</p> :
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4">
            <TransactionList transactions={transactions} onDelete={handleDelete} />
          </div>
        }
      </div>
      <BottomNav />
    </main>
  )
}
```

- [ ] **Step 4: Run tests to make sure nothing broke**

```bash
npx jest --no-coverage
```

Expected: All 19 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/add/page.tsx src/app/history/page.tsx
git commit -m "feat: dark theme + gradient header on all pages, add today's spend + recurring to dashboard"
```

---

## Task 7: Upgrade TransactionForm (Dark Theme + Autocomplete + Recurring)

**Files:**
- Modify: `src/components/TransactionForm.tsx`

- [ ] **Step 1: Replace TransactionForm entirely**

```typescript
// src/components/TransactionForm.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCategoriesForType, type TransactionType } from '@/lib/categories'
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions'
import SuggestionDropdown from '@/components/SuggestionDropdown'
import type { Suggestion } from '@/lib/types'

export default function TransactionForm() {
  const router = useRouter()
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<'weekly'|'monthly'>('monthly')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const suggestions = useDescriptionSuggestions(description, showSuggestions)
  const categories = getCategoriesForType(type)

  function handleSuggestionSelect(s: Suggestion) {
    setDescription(s.description)
    setCategory(s.category)
    setAmount(String(s.amount))
    setShowSuggestions(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const numAmount = parseFloat(amount)
    if (!amount || !category) { setError('Amount and category are required'); return }
    if (isNaN(numAmount) || numAmount <= 0) { setError('Enter a valid amount'); return }
    setSubmitting(true)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type, amount: numAmount, category, description, date,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? recurrenceInterval : null,
      }),
    })
    setSubmitting(false)
    if (res.ok) { router.push('/dashboard'); router.refresh() }
    else setError('Failed to save. Please try again.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type toggle */}
      <div className="flex bg-slate-700 rounded-xl p-1">
        {(['expense','income'] as TransactionType[]).map(t => (
          <button key={t} type="button" onClick={() => { setType(t); setCategory('') }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors capitalize ${type===t ? (t==='expense'?'bg-red-500 text-white':'bg-green-500 text-white') : 'text-slate-400 hover:text-slate-200'}`}
          >{t}</button>
        ))}
      </div>

      {/* Amount */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Amount (₹)</p>
        <input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00"
          value={amount} onChange={e => setAmount(e.target.value)}
          className="text-4xl font-bold text-white text-center w-full outline-none bg-transparent placeholder:text-slate-600"
        />
      </div>

      {/* Description with autocomplete */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 relative">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Note</label>
        <input type="text" placeholder="What was this for?" value={description}
          onChange={e => { setDescription(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          className="text-white text-sm w-full outline-none bg-transparent placeholder:text-slate-600"
        />
        <SuggestionDropdown suggestions={suggestions} onSelect={handleSuggestionSelect} visible={showSuggestions} />
      </div>

      {/* Category */}
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 px-1">Category</p>
        <div className="grid grid-cols-4 gap-2">
          {categories.map(cat => (
            <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-colors ${category===cat.id ? 'bg-blue-900 text-blue-300 border-2 border-blue-500' : 'bg-slate-800 text-slate-400 border-2 border-slate-700 hover:border-slate-500'}`}
            ><span className="text-xl">{cat.emoji}</span>{cat.label}</button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
        <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-white text-sm w-full outline-none bg-transparent [color-scheme:dark]" />
      </div>

      {/* Recurring toggle */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-300">Recurring?</label>
          <button type="button" onClick={() => setIsRecurring(r => !r)}
            className={`w-12 h-6 rounded-full transition-colors relative ${isRecurring ? 'bg-blue-500' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {isRecurring && (
          <div className="mt-3 flex gap-2">
            {(['weekly','monthly'] as const).map(interval => (
              <button key={interval} type="button" onClick={() => setRecurrenceInterval(interval)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${recurrenceInterval===interval ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              >{interval}</button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button type="submit" disabled={submitting}
        className={`w-full py-4 rounded-xl font-semibold text-white transition-colors ${type==='expense'?'bg-red-500 hover:bg-red-600 active:bg-red-700':'bg-green-500 hover:bg-green-600 active:bg-green-700'} disabled:opacity-50`}
      >{submitting ? 'Saving...' : `Add ${type==='expense'?'Expense':'Income'}`}</button>
    </form>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npx jest --no-coverage
```

Expected: All 19 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/TransactionForm.tsx
git commit -m "feat: dark theme + autocomplete + recurring toggle on TransactionForm"
```

---

## Task 8: Daily View Components + Page

**Files:**
- Create: `src/components/CategoryDayGrid.tsx`
- Create: `src/components/DayGroup.tsx`
- Create: `src/app/daily/page.tsx`

- [ ] **Step 1: Create CategoryDayGrid**

```typescript
// src/components/CategoryDayGrid.tsx
import { CATEGORIES, getCategoryById } from '@/lib/categories'
import type { Transaction } from '@/lib/types'

export default function CategoryDayGrid({ transactions }: { transactions: Transaction[] }) {
  const expenseCategories = CATEGORIES.filter(c => c.type === 'expense')
  const totals: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === 'expense')) {
    totals[t.category] = (totals[t.category] ?? 0) + Number(t.amount)
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {expenseCategories.map(cat => {
        const amount = totals[cat.id] ?? 0
        const hasSpend = amount > 0
        return (
          <div key={cat.id} className={`rounded-xl p-2 text-center transition-opacity ${hasSpend ? 'opacity-100' : 'opacity-30'}`}>
            <div className="text-lg">{cat.emoji}</div>
            <div className="text-slate-500 text-[10px] mt-1 leading-tight">{cat.label}</div>
            <div className={`text-[11px] font-semibold mt-1 ${hasSpend ? 'text-red-400' : 'text-slate-600'}`}>
              {hasSpend ? `₹${amount.toLocaleString('en-IN')}` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create DayGroup**

```typescript
// src/components/DayGroup.tsx
import CategoryDayGrid from '@/components/CategoryDayGrid'
import type { Transaction } from '@/lib/types'

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN') }

export default function DayGroup({ label, transactions }: { label: string; transactions: Transaction[] }) {
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Day header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <span className="text-white font-semibold text-sm">{label}</span>
        <div className="flex items-center gap-3">
          {totalIncome > 0 && <span className="text-green-400 text-sm font-semibold">+{fmt(totalIncome)}</span>}
          {totalExpense > 0 && <span className="text-red-400 text-sm font-semibold">-{fmt(totalExpense)}</span>}
        </div>
      </div>
      {/* Category grid */}
      <div className="p-3">
        <CategoryDayGrid transactions={transactions} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create daily page**

```typescript
// src/app/daily/page.tsx
import { getSupabaseAdmin } from '@/lib/supabase'
import DayGroup from '@/components/DayGroup'
import BottomNav from '@/components/BottomNav'
import type { Transaction } from '@/lib/types'

function dayLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default async function DailyPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await getSupabaseAdmin()
    .from('transactions')
    .select('*')
    .gte('date', thirtyDaysAgo)
    .lte('date', today)
    .order('date', { ascending: false })

  const transactions = (data ?? []) as Transaction[]

  // Group by date
  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (!groups.has(t.date)) groups.set(t.date, [])
    groups.get(t.date)!.push(t)
  }

  return (
    <main className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-12 pb-6 rounded-b-3xl shadow-xl">
        <div className="max-w-lg mx-auto">
          <h1 className="text-white text-lg font-semibold">Daily View</h1>
          <p className="text-blue-200 text-sm mt-1">Last 30 days</p>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {groups.size === 0 && (
          <p className="text-slate-500 text-sm text-center py-12">No transactions yet</p>
        )}
        {Array.from(groups.entries()).map(([date, txs]) => (
          <DayGroup key={date} label={dayLabel(date)} transactions={txs} />
        ))}
      </div>
      <BottomNav />
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/CategoryDayGrid.tsx src/components/DayGroup.tsx src/app/daily/
git commit -m "feat: add daily view page with category grid per day"
```

---

## Task 9: Insights Components + Page

**Files:**
- Create: `src/components/BarChart.tsx`
- Create: `src/components/InsightsPeriodToggle.tsx`
- Create: `src/components/InsightCategoryCard.tsx`
- Create: `src/app/insights/page.tsx`

- [ ] **Step 1: Create BarChart**

```typescript
// src/components/BarChart.tsx
'use client'

interface Bar {
  label: string
  current: number
  previous: number
}

export default function BarChart({ bars, maxValue }: { bars: Bar[]; maxValue: number }) {
  const max = Math.max(maxValue, 1)

  return (
    <div className="flex items-end gap-2 h-28">
      {bars.map((bar, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end gap-0.5 h-20">
            {/* Previous bar */}
            <div className="flex-1 bg-slate-700 rounded-t-sm transition-all"
              style={{ height: `${Math.round((bar.previous / max) * 100)}%`, minHeight: bar.previous > 0 ? '4px' : '0' }} />
            {/* Current bar */}
            <div className="flex-1 bg-blue-500 rounded-t-sm transition-all"
              style={{ height: `${Math.round((bar.current / max) * 100)}%`, minHeight: bar.current > 0 ? '4px' : '0' }} />
          </div>
          <span className="text-slate-500 text-[10px] text-center leading-tight">{bar.label}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create InsightsPeriodToggle**

```typescript
// src/components/InsightsPeriodToggle.tsx
'use client'
import { useRouter, usePathname } from 'next/navigation'

type Period = 'week' | 'month' | 'year'

export default function InsightsPeriodToggle({ period }: { period: Period }) {
  const router = useRouter()
  const pathname = usePathname()
  const periods: Period[] = ['week', 'month', 'year']

  return (
    <div className="flex bg-white/10 rounded-xl p-1 mt-3">
      {periods.map(p => (
        <button key={p} onClick={() => router.push(`${pathname}?period=${p}`)}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${p === period ? 'bg-white text-blue-700' : 'text-blue-100 hover:text-white'}`}
        >{p}</button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create InsightCategoryCard**

```typescript
// src/components/InsightCategoryCard.tsx
import { getCategoryById } from '@/lib/categories'

interface Props {
  title: 'Most Spent' | 'Least Spent'
  categoryId: string
  amount: number
  pct: number
}

export default function InsightCategoryCard({ title, categoryId, amount, pct }: Props) {
  const cat = getCategoryById(categoryId)
  const isMost = title === 'Most Spent'

  return (
    <div className={`bg-slate-800 border rounded-xl p-4 text-center ${isMost ? 'border-red-500/30' : 'border-green-500/30'}`}>
      <p className={`text-xs uppercase tracking-wide mb-2 ${isMost ? 'text-red-400' : 'text-green-400'}`}>{title}</p>
      <div className="text-2xl mb-1">{cat?.emoji ?? '📦'}</div>
      <p className="text-white text-sm font-semibold">{cat?.label ?? categoryId}</p>
      <p className={`text-lg font-bold mt-1 ${isMost ? 'text-red-400' : 'text-green-400'}`}>
        ₹{amount.toLocaleString('en-IN')}
      </p>
      <p className="text-slate-500 text-xs mt-1">{pct}% of spend</p>
    </div>
  )
}
```

- [ ] **Step 4: Create insights page**

```typescript
// src/app/insights/page.tsx
import { getSupabaseAdmin } from '@/lib/supabase'
import BarChart from '@/components/BarChart'
import InsightsPeriodToggle from '@/components/InsightsPeriodToggle'
import InsightCategoryCard from '@/components/InsightCategoryCard'
import CategoryBars from '@/components/CategoryBars'
import BottomNav from '@/components/BottomNav'
import type { Transaction } from '@/lib/types'

type Period = 'week' | 'month' | 'year'

function getPeriodBounds(period: Period) {
  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth()
  const today = now.toISOString().slice(0, 10)

  if (period === 'week') {
    const day = now.getDay()
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7))
    const prevMonday = new Date(monday); prevMonday.setDate(monday.getDate() - 7)
    const prevSunday = new Date(monday); prevSunday.setDate(monday.getDate() - 1)
    return {
      current: { start: monday.toISOString().slice(0,10), end: today, label: 'This Week' },
      previous: { start: prevMonday.toISOString().slice(0,10), end: prevSunday.toISOString().slice(0,10), label: 'Last Week' },
    }
  }
  if (period === 'month') {
    const firstOfMonth = `${y}-${String(mo+1).padStart(2,'0')}-01`
    const firstOfPrev = new Date(y, mo-1, 1)
    const lastOfPrev = new Date(y, mo, 0)
    return {
      current: { start: firstOfMonth, end: today, label: 'This Month' },
      previous: { start: firstOfPrev.toISOString().slice(0,10), end: lastOfPrev.toISOString().slice(0,10), label: 'Last Month' },
    }
  }
  return {
    current: { start: `${y}-01-01`, end: today, label: 'This Year' },
    previous: { start: `${y-1}-01-01`, end: `${y-1}-12-31`, label: 'Last Year' },
  }
}

function totalExpense(txs: Transaction[]) {
  return txs.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
}

function categoryTotals(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of txs.filter(t => t.type === 'expense')) {
    out[t.category] = (out[t.category] ?? 0) + Number(t.amount)
  }
  return out
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams
  const period = (['week','month','year'].includes(params.period ?? '') ? params.period : 'month') as Period

  const bounds = getPeriodBounds(period)

  // Fetch 6 months of data + current/previous period in one wide query
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const startDate = sixMonthsAgo.toISOString().slice(0, 10)
  const endDate = new Date().toISOString().slice(0, 10)

  const { data } = await getSupabaseAdmin()
    .from('transactions')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  const allTxs = (data ?? []) as Transaction[]

  // Split into current / previous period
  const currentTxs = allTxs.filter(t => t.date >= bounds.current.start && t.date <= bounds.current.end)
  const previousTxs = allTxs.filter(t => t.date >= bounds.previous.start && t.date <= bounds.previous.end)

  const currentTotal = totalExpense(currentTxs)
  const previousTotal = totalExpense(previousTxs)

  // 6-month bar chart
  const monthlyBars = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const monthTxs = allTxs.filter(t => t.date.startsWith(key))
    return {
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      current: totalExpense(monthTxs),
      previous: 0,
    }
  })

  // Category insights
  const catTotals = categoryTotals(currentTxs)
  const catEntries = Object.entries(catTotals).sort((a,b) => b[1]-a[1])
  const mostSpent = catEntries[0]
  const leastSpent = catEntries.filter(([,v]) => v > 0).at(-1)

  const maxMonthly = Math.max(...monthlyBars.map(b => b.current), 1)
  const maxPeriod = Math.max(currentTotal, previousTotal, 1)

  function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

  const pctChange = previousTotal > 0
    ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
    : null

  return (
    <main className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-12 pb-6 rounded-b-3xl shadow-xl">
        <div className="max-w-lg mx-auto">
          <h1 className="text-white text-lg font-semibold">Insights</h1>
          <InsightsPeriodToggle period={period} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Period comparison */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {bounds.current.label} vs {bounds.previous.label}
            </h2>
            {pctChange !== null && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${pctChange > 0 ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                {pctChange > 0 ? '↑' : '↓'} {Math.abs(pctChange)}%
              </span>
            )}
          </div>
          <BarChart
            bars={[
              { label: bounds.previous.label.replace('Last ','').replace('This ',''), current: 0, previous: previousTotal },
              { label: bounds.current.label.replace('Last ','').replace('This ',''), current: currentTotal, previous: 0 },
            ]}
            maxValue={maxPeriod}
          />
          <div className="flex gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-600" /><span className="text-slate-400">{bounds.previous.label}: {fmt(previousTotal)}</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-500" /><span className="text-slate-300">{bounds.current.label}: {fmt(currentTotal)}</span></div>
          </div>
        </div>

        {/* 6-month chart */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Last 6 Months</h2>
          <BarChart bars={monthlyBars} maxValue={maxMonthly} />
        </div>

        {/* Most / Least spent */}
        {mostSpent && leastSpent && (
          <div className="grid grid-cols-2 gap-3">
            <InsightCategoryCard
              title="Most Spent"
              categoryId={mostSpent[0]}
              amount={mostSpent[1]}
              pct={currentTotal > 0 ? Math.round((mostSpent[1]/currentTotal)*100) : 0}
            />
            <InsightCategoryCard
              title="Least Spent"
              categoryId={leastSpent[0]}
              amount={leastSpent[1]}
              pct={currentTotal > 0 ? Math.round((leastSpent[1]/currentTotal)*100) : 0}
            />
          </div>
        )}

        {/* Category breakdown */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Breakdown by Category</h2>
          <CategoryBars transactions={currentTxs} />
        </div>

      </div>
      <BottomNav />
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/BarChart.tsx src/components/InsightsPeriodToggle.tsx src/components/InsightCategoryCard.tsx src/app/insights/
git commit -m "feat: add insights page with period comparison, monthly bar chart, and category breakdown"
```

---

## Task 10: BottomNav + Middleware

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update BottomNav to 5 items**

Replace entire file:

```typescript
// src/components/BottomNav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  const active = (path: string) =>
    pathname === path ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 pb-safe h-16 z-50">
      <Link href="/dashboard" className={`flex flex-col items-center gap-0.5 text-[10px] py-2 px-3 transition-colors ${active('/dashboard')}`}>
        <span className="text-xl">🏠</span>Home
      </Link>
      <Link href="/daily" className={`flex flex-col items-center gap-0.5 text-[10px] py-2 px-3 transition-colors ${active('/daily')}`}>
        <span className="text-xl">📅</span>Daily
      </Link>
      <Link href="/add" className="flex flex-col items-center -mt-5">
        <div className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 flex items-center justify-center text-white text-3xl shadow-lg shadow-blue-500/30 transition-colors">+</div>
      </Link>
      <Link href="/insights" className={`flex flex-col items-center gap-0.5 text-[10px] py-2 px-3 transition-colors ${active('/insights')}`}>
        <span className="text-xl">📊</span>Insights
      </Link>
      <Link href="/history" className={`flex flex-col items-center gap-0.5 text-[10px] py-2 px-3 transition-colors ${active('/history')}`}>
        <span className="text-xl">📋</span>History
      </Link>
    </nav>
  )
}
```

- [ ] **Step 2: Update middleware to protect new routes**

Replace entire file:

```typescript
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
```

- [ ] **Step 3: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All 19 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.tsx src/middleware.ts
git commit -m "feat: 5-item bottom nav (add Daily + Insights) and protect new routes"
```

---

## Task 11: TypeScript Check + Build + Deploy

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run all tests one final time**

```bash
npx jest --no-coverage
```

Expected: All 19 tests pass.

- [ ] **Step 3: Push to GitHub**

```bash
git push
```

- [ ] **Step 4: Deploy to Vercel**

```bash
vercel deploy --prod --yes
```

Expected: Deployment URL printed. App is live.

- [ ] **Step 5: Run the migration in Supabase**

If not already done in Task 1 Step 2 — paste `supabase/migrations/002_recurring.sql` into Supabase SQL Editor and run.

- [ ] **Step 6: Final commit**

```bash
git add supabase/migrations/002_recurring.sql
git commit -m "chore: finalize UI redesign and insights — all tasks complete"
git push
```
