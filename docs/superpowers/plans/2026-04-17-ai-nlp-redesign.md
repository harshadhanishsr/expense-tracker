# AI NLP, Pattern Engine & UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Ollama-powered Tanglish NLP parsing, a proactive pattern engine with weekly insights, smart chips, and a full dark bento dashboard redesign.

**Architecture:** Hybrid parser (regex fast-path → Ollama fallback), client-side pattern detection via `AIInsightCard`, new `/api/ai/*` and `/api/transactions/recent` routes, and a complete visual overhaul of `dashboard/page.tsx` replacing the blue hero header with a dark glassmorphism layout.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS v4, Supabase, Ollama (`gemma3:4b` at `http://localhost:11434`), localStorage

---

## Task 1: Type foundations

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/tripContext.tsx`

- [ ] **Step 1: Widen ParseResult.type and add Insight + PendingPrefill types**

Edit `src/lib/types.ts`:
- Change `type: 'expense'` → `type: 'expense' | 'income'` in `ParseResult`
- Remove the `Suggestion` interface (dead code — replaced by smart chips)
- Add the `Insight` export after `ParseResult`:

```typescript
export interface Insight {
  type: 'recurring' | 'spike' | 'digest'
  title: string
  body: string
  action?: {
    label: string
    prefill: { category: string; amount: number; description: string; type: 'expense' | 'income' }
  }
  dismissKey: string
}
```

Full updated `ParseResult` block:
```typescript
export interface ParseResult {
  amount: number
  category: string        // valid category ID from CATEGORIES
  description: string
  type: 'expense' | 'income'
  confidence: 'high' | 'low'
}
```

- [ ] **Step 2: Extend TripContext with pendingPrefill**

Edit `src/lib/tripContext.tsx` — extend the interface, default, provider state:

```typescript
// Add to imports at top:
import { Trip, Insight } from './types'  // Insight not needed here, just the prefill type inline

// Replace TripContextValue interface with:
type PrefillData = { category: string; amount: number; description: string; type: 'expense' | 'income' }

interface TripContextValue {
  activeTrip: Trip | null
  setActiveTrip: (t: Trip | null) => void
  refreshActiveTrip: () => Promise<void>
  pendingPrefill: PrefillData | null
  setPendingPrefill: (v: PrefillData | null) => void
}

// Update createContext default:
const TripContext = createContext<TripContextValue>({
  activeTrip: null,
  setActiveTrip: () => {},
  refreshActiveTrip: async () => {},
  pendingPrefill: null,
  setPendingPrefill: () => {},
})

// Add inside TripProvider function body (after activeTrip state):
const [pendingPrefill, setPendingPrefill] = useState<PrefillData | null>(null)

// Update Provider value:
<TripContext.Provider value={{ activeTrip, setActiveTrip, refreshActiveTrip, pendingPrefill, setPendingPrefill }}>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "C:/Users/harsh/projects/expense-tracker" && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 errors (or only pre-existing errors unrelated to these files).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/tripContext.tsx
git commit -m "feat: widen ParseResult.type, add Insight type, extend TripContext with pendingPrefill"
```

---

## Task 2: Training store

**Files:**
- Create: `src/lib/trainingStore.ts`

- [ ] **Step 1: Create trainingStore.ts**

```typescript
// src/lib/trainingStore.ts
import { ParseResult } from './types'

const KEY = 'expense-tracker:training-examples'
const MAX = 200

interface TrainingExample {
  input: string
  result: ParseResult
  corrected: boolean
  timestamp: number
}

function load(): TrainingExample[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(examples: TrainingExample[]) {
  localStorage.setItem(KEY, JSON.stringify(examples))
}

export function saveExample(input: string, result: ParseResult, corrected: boolean): void {
  const examples = load()
  examples.push({ input, result, corrected, timestamp: Date.now() })
  if (examples.length > MAX) {
    const idx = examples.findLastIndex(e => !e.corrected)
    if (idx !== -1) {
      examples.splice(idx, 1)
    } else {
      // All corrected — drop oldest corrected
      examples.shift()
    }
  }
  save(examples)
}

export function getTopExamples(n: number): TrainingExample[] {
  const all = load()
  const corrected = all.filter(e => e.corrected).sort((a, b) => b.timestamp - a.timestamp)
  const normal = all.filter(e => !e.corrected).sort((a, b) => b.timestamp - a.timestamp)
  return [...corrected, ...normal].slice(0, n)
}

export function clearExamples(): void {
  localStorage.removeItem(KEY)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trainingStore.ts
git commit -m "feat: add trainingStore for few-shot learning examples"
```

---

## Task 3: Ollama parser

**Files:**
- Create: `src/lib/ollamaParser.ts`

- [ ] **Step 1: Create ollamaParser.ts**

```typescript
// src/lib/ollamaParser.ts
import { ParseResult } from './types'
import { CATEGORIES, getCategoryById } from './categories'

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'gemma3:4b'
const TIMEOUT_MS = 8000

export async function ollamaParse(
  userText: string,
  examples: Array<{ input: string; result: ParseResult }>
): Promise<ParseResult | null> {
  const expenseCats = CATEGORIES.filter(c => c.type === 'expense').map(c => c.id).join(', ')
  const incomeCats = CATEGORIES.filter(c => c.type === 'income').map(c => c.id).join(', ')

  const fewShotExamples = examples
    .map(e => `Input: "${e.input}"\nOutput: ${JSON.stringify({ amount: e.result.amount, category: e.result.category, description: e.result.description, type: e.result.type, confidence: e.result.confidence })}`)
    .join('\n\n')

  const prompt = `You are an expense parser for a personal finance app. Extract the transaction details from the user's input.
The user speaks Tamil and English (Tanglish). Understand both.

For expenses, valid category IDs are: ${expenseCats}
For income, valid category IDs are: ${incomeCats}

Examples from this user's history:
${fewShotExamples || '(none yet)'}

Input: "${userText}"

Respond ONLY with valid JSON, no explanation:
{"amount": number, "category": string, "description": string, "type": "expense" or "income", "confidence": "high" or "low"}`

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    const raw = JSON.parse(data.response.trim())

    // Validate and sanitise
    const type: 'expense' | 'income' = raw.type === 'income' ? 'income' : 'expense'
    const fallbackCat = type === 'income' ? 'other_income' : 'other_expense'
    const category = getCategoryById(raw.category) ? raw.category : fallbackCat
    const amount = typeof raw.amount === 'number' && raw.amount > 0 ? raw.amount : 0
    const description = typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : userText
    const confidence: 'high' | 'low' = amount > 0 ? (raw.confidence === 'high' ? 'high' : 'low') : 'low'

    return { amount, category, description, type, confidence }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ollamaParser.ts
git commit -m "feat: add ollamaParser calling gemma3:4b via Ollama"
```

---

## Task 4: Pattern engine

**Files:**
- Create: `src/lib/patternEngine.ts`

- [ ] **Step 1: Create patternEngine.ts**

```typescript
// src/lib/patternEngine.ts
import type { Insight, Transaction } from './types'

function isoWeek(today: Date): string {
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const w = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`
}

export function detectInsights(transactions: Transaction[], today: Date): Insight[] {
  const week = isoWeek(today)
  const results: Insight[] = []

  // Pattern 1: Recurring behaviour (last 28 days, same weekday + category ≥ 3 times)
  const cutoff28 = new Date(today); cutoff28.setDate(cutoff28.getDate() - 28)
  const recent = transactions.filter(t => new Date(t.date) >= cutoff28 && t.type === 'expense')
  const groups = new Map<string, Transaction[]>()
  for (const t of recent) {
    const day = new Date(t.date).getDay()
    const key = `${day}-${t.category}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }
  for (const [key, txns] of groups) {
    if (txns.length >= 3) {
      const [wdStr, category] = key.split('-')
      const wd = Number(wdStr)
      if (today.getDay() !== wd) continue  // only surface on matching weekday
      const avg = Math.round(txns.reduce((s, t) => s + Number(t.amount), 0) / txns.length)
      const desc = txns.map(t => t.description ?? '').filter(Boolean)
        .sort((a, b) => txns.filter(t => t.description === b).length - txns.filter(t => t.description === a).length)[0] ?? category
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      results.push({
        type: 'recurring',
        title: 'Recurring spend',
        body: `Nee ${dayNames[wd]}-la ${category} usual — today panniyacha? 🔄`,
        action: { label: 'Log it', prefill: { category, amount: avg, description: desc, type: 'expense' } },
        dismissKey: `recurring-${category}-${wd}-${week}`,
      })
    }
  }

  // Pattern 2: Spending spike (current week vs 4-week rolling average)
  const monOffset = (today.getDay() + 6) % 7
  const monday = new Date(today); monday.setDate(today.getDate() - monOffset); monday.setHours(0,0,0,0)
  const cutoff4w = new Date(monday); cutoff4w.setDate(cutoff4w.getDate() - 28)
  const thisWeekTxns = transactions.filter(t => new Date(t.date) >= monday && t.type === 'expense')
  const prev4wTxns = transactions.filter(t => { const d = new Date(t.date); return d >= cutoff4w && d < monday && t.type === 'expense' })
  const catSpendThis = new Map<string, number>()
  for (const t of thisWeekTxns) catSpendThis.set(t.category, (catSpendThis.get(t.category) ?? 0) + Number(t.amount))
  const catSpendPrev = new Map<string, number>()
  for (const t of prev4wTxns) catSpendPrev.set(t.category, (catSpendPrev.get(t.category) ?? 0) + Number(t.amount))
  let biggestSpikeRatio = 1.8
  let spikeCategory = ''
  let spikeCurrent = 0
  for (const [cat, cur] of catSpendThis) {
    const avg4w = (catSpendPrev.get(cat) ?? 0) / 4
    if (avg4w > 0 && cur / avg4w > biggestSpikeRatio) {
      biggestSpikeRatio = cur / avg4w
      spikeCategory = cat
      spikeCurrent = cur
    }
  }
  if (spikeCategory) {
    results.push({
      type: 'spike',
      title: 'Spending spike',
      body: `${spikeCategory}-ku இந்த வாரம் ₹${spikeCurrent.toLocaleString('en-IN')} — usual-a vida ${biggestSpikeRatio.toFixed(1)}x aagidhu 📈`,
      dismissKey: `spike-${spikeCategory}-${week}`,
    })
  }

  // Pattern 3: Weekly digest (Mondays only)
  if (today.getDay() === 1) {
    results.push({
      type: 'digest',
      title: 'Weekly digest',
      body: '',  // AIInsightCard fetches from /api/ai/digest
      dismissKey: `digest-${week}`,
    })
  }

  // Priority: recurring > spike > digest; return up to 3
  return results.slice(0, 3)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/patternEngine.ts
git commit -m "feat: add pattern engine for recurring, spike, and weekly digest insights"
```

---

## Task 5: API routes

**Files:**
- Create: `src/app/api/ai/parse/route.ts`
- Create: `src/app/api/ai/digest/route.ts`
- Create: `src/app/api/transactions/recent/route.ts`

Before writing these routes, read `node_modules/next/dist/docs/` for the current route handler API if any doubt about Next.js conventions.

- [ ] **Step 1: Create POST /api/ai/parse**

```typescript
// src/app/api/ai/parse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ollamaParse } from '@/lib/ollamaParser'

export async function POST(req: NextRequest) {
  const { input, examples = [] } = await req.json()
  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'input required' }, { status: 400 })
  }
  const result = await ollamaParse(input, examples)
  if (!result) return NextResponse.json({ error: 'ollama unavailable' }, { status: 503 })
  return NextResponse.json(result)
}
```

- [ ] **Step 2: Create POST /api/ai/digest**

```typescript
// src/app/api/ai/digest/route.ts
import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'gemma3:4b'

export async function POST(req: NextRequest) {
  const { weekTotal, topCategory, topCategoryAmount, prevWeekTotal } = await req.json()

  const fallback = `Last week: ₹${weekTotal} spent. ${topCategory} was biggest (₹${topCategoryAmount}).`

  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8000)
    const prompt = `Write a friendly 1-2 sentence weekly spending summary in Tanglish (Tamil + English mix).
Be casual and encouraging. Use ₹ for amounts.

This week: ₹${weekTotal} total. Top category: ${topCategory} ₹${topCategoryAmount}.
Previous week: ₹${prevWeekTotal}.

Respond with ONLY the summary text.`
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
      signal: ctrl.signal,
    })
    if (!res.ok) return NextResponse.json({ text: fallback })
    const data = await res.json()
    return NextResponse.json({ text: data.response?.trim() || fallback })
  } catch {
    return NextResponse.json({ text: fallback })
  }
}
```

- [ ] **Step 3: Create GET /api/transactions/recent**

```typescript
// src/app/api/transactions/recent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const daysParam = searchParams.get('days')
  const days = Math.min(90, Math.max(1, daysParam && !isNaN(Number(daysParam)) ? Number(daysParam) : 30))

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const { data, error } = await getSupabaseAdmin()
    .from('transactions')
    .select('*')
    .gte('date', cutoffStr)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data ?? [] })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/parse/route.ts src/app/api/ai/digest/route.ts src/app/api/transactions/recent/route.ts
git commit -m "feat: add /api/ai/parse, /api/ai/digest, /api/transactions/recent routes"
```

---

## Task 6: SpendingHeatmap component

**Files:**
- Create: `src/components/SpendingHeatmap.tsx`

- [ ] **Step 1: Create SpendingHeatmap.tsx**

```typescript
// src/components/SpendingHeatmap.tsx
import type { Transaction } from '@/lib/types'

interface Props { transactions: Transaction[] }

function getDailySpend(transactions: Transaction[], today: Date): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    map.set(t.date, (map.get(t.date) ?? 0) + Number(t.amount))
  }
  return map
}

export default function SpendingHeatmap({ transactions }: Props) {
  const today = new Date()
  const days: Date[] = []
  for (let i = 20; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d)
  }

  const dailySpend = getDailySpend(transactions, today)
  const amounts = days.map(d => dailySpend.get(d.toISOString().slice(0, 10)) ?? 0)
  const avg = amounts.reduce((s, a) => s + a, 0) / (amounts.filter(a => a > 0).length || 1)
  const todayStr = today.toISOString().slice(0, 10)

  function cellColor(amount: number): string {
    if (amount === 0) return 'rgba(255,255,255,0.05)'
    if (amount < avg * 0.8) return 'rgba(255,107,53,0.2)'
    if (amount < avg * 1.2) return 'rgba(255,107,53,0.45)'
    if (amount < avg * 1.5) return 'rgba(255,107,53,0.7)'
    return 'rgba(255,107,53,0.95)'
  }

  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Last 21 days</p>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const ds = d.toISOString().slice(0, 10)
          const amt = dailySpend.get(ds) ?? 0
          const isToday = ds === todayStr
          return (
            <div
              key={ds}
              title={`${ds}: ₹${amt}`}
              style={{
                background: cellColor(amt),
                borderRadius: 5,
                height: 20,
                boxShadow: isToday ? '0 0 0 2px #ff6b35' : undefined,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SpendingHeatmap.tsx
git commit -m "feat: add SpendingHeatmap component (21-day intensity grid)"
```

---

## Task 7: BentoCategoryGrid component

**Files:**
- Create: `src/components/BentoCategoryGrid.tsx`

- [ ] **Step 1: Create BentoCategoryGrid.tsx**

```typescript
// src/components/BentoCategoryGrid.tsx
import type { Transaction } from '@/lib/types'
import { getCategoryById } from '@/lib/categories'

interface Props {
  transactions: Transaction[]
  prevMonthTransactions: Transaction[]
}

function catTotals(txns: Transaction[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of txns) {
    if (t.type !== 'expense') continue
    m.set(t.category, (m.get(t.category) ?? 0) + Number(t.amount))
  }
  return m
}

export default function BentoCategoryGrid({ transactions, prevMonthTransactions }: Props) {
  const cur = catTotals(transactions)
  const prev = catTotals(prevMonthTransactions)
  const top4 = [...cur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const max = top4[0]?.[1] ?? 1

  if (top4.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3">
      {top4.map(([id, amount]) => {
        const cat = getCategoryById(id)
        const prevAmt = prev.get(id) ?? 0
        const delta = amount - prevAmt
        const pct = Math.round((amount / max) * 100)
        return (
          <div key={id} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-xl mb-1">{cat?.emoji ?? '📦'}</div>
            <div className="text-[11px] text-white/40 mb-0.5">{cat?.label ?? id}</div>
            <div className="text-sm font-bold text-white">₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            {prevAmt > 0 && (
              <div className={`text-[10px] mt-0.5 ${delta > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                {delta > 0 ? '+' : ''}₹{Math.abs(delta).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            )}
            <div className="h-[3px] rounded-full mt-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-[3px] rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#ff6b35,#ff9f00)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BentoCategoryGrid.tsx
git commit -m "feat: add BentoCategoryGrid (2x2 bento tiles with delta vs last month)"
```

---

## Task 8: AIInsightCard component

**Files:**
- Create: `src/components/AIInsightCard.tsx`

- [ ] **Step 1: Create AIInsightCard.tsx**

```typescript
// src/components/AIInsightCard.tsx
'use client'
import { useState, useEffect } from 'react'
import { detectInsights } from '@/lib/patternEngine'
import { useTripContext } from '@/lib/tripContext'
import type { Transaction, Insight } from '@/lib/types'
import SpendingHeatmap from './SpendingHeatmap'

export default function AIInsightCard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [insight, setInsight] = useState<Insight | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [digestBody, setDigestBody] = useState('')
  const { setPendingPrefill } = useTripContext()

  useEffect(() => {
    // Prune dismissal keys older than 60 days
    if (typeof window !== 'undefined') {
      const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('expense-tracker:dismissed:')) {
          try {
            const { dismissedAt } = JSON.parse(localStorage.getItem(key) ?? '{}')
            if (dismissedAt < cutoff) localStorage.removeItem(key)
          } catch { localStorage.removeItem(key) }
        }
      }
    }

    fetch('/api/transactions/recent?days=90')
      .then(r => r.json())
      .then(d => setTransactions(d.transactions ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (transactions.length === 0) return
    const today = new Date()
    const insights = detectInsights(transactions, today)
    const active = insights.find(ins => {
      const k = `expense-tracker:dismissed:${ins.dismissKey}`
      return !localStorage.getItem(k)
    })
    if (!active) return
    setInsight(active)

    if (active.type === 'digest' && !active.body) {
      // Compute weekly stats for digest
      const monOffset = (today.getDay() + 6) % 7
      const monday = new Date(today); monday.setDate(today.getDate() - monOffset)
      const thisWeek = transactions.filter(t => new Date(t.date) >= monday && t.type === 'expense')
      const prevMon = new Date(monday); prevMon.setDate(prevMon.getDate() - 7)
      const prevWeek = transactions.filter(t => { const d = new Date(t.date); return d >= prevMon && d < monday && t.type === 'expense' })
      const weekTotal = thisWeek.reduce((s, t) => s + Number(t.amount), 0)
      const prevWeekTotal = prevWeek.reduce((s, t) => s + Number(t.amount), 0)
      const catMap = new Map<string, number>()
      for (const t of thisWeek) catMap.set(t.category, (catMap.get(t.category) ?? 0) + Number(t.amount))
      const [topCat, topAmt] = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]

      fetch('/api/ai/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekTotal, topCategory: topCat, topCategoryAmount: topAmt, prevWeekTotal }),
      }).then(r => r.json()).then(d => setDigestBody(d.text ?? '')).catch(() => {
        setDigestBody(`Last week: ₹${weekTotal} spent. ${topCat} was biggest (₹${topAmt}).`)
      })
    }
  }, [transactions])

  function dismiss() {
    if (!insight) return
    localStorage.setItem(`expense-tracker:dismissed:${insight.dismissKey}`, JSON.stringify({ dismissedAt: Date.now() }))
    setDismissed(true)
  }

  const body = insight?.type === 'digest' ? digestBody : insight?.body ?? ''
  const show = insight && !dismissed && (insight.type !== 'digest' || body)

  return (
    <div className="space-y-3">
      {show && (
        <div className="relative rounded-[20px] px-4 py-3" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)', maxHeight: 90, overflow: 'hidden' }}>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#ff6b35' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/80 leading-[1.55] line-clamp-2">{body}</p>
              {insight.action && (
                <button
                  className="mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{ background: 'rgba(255,107,53,0.2)', border: '1px solid rgba(255,107,53,0.35)', color: '#ff6b35' }}
                  onClick={() => { setPendingPrefill(insight.action!.prefill); dismiss() }}
                >
                  {insight.action.label}
                </button>
              )}
            </div>
            <button onClick={dismiss} className="text-white/30 hover:text-white/60 text-sm ml-1 flex-shrink-0">✕</button>
          </div>
        </div>
      )}
      <SpendingHeatmap transactions={transactions} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AIInsightCard.tsx
git commit -m "feat: add AIInsightCard with pattern engine, digest fetch, and heatmap"
```

---

## Task 9: Update AIInputBar

**Files:**
- Modify: `src/components/AIInputBar.tsx`
- Delete: `src/app/api/transactions/suggestions/route.ts`
- Delete (if exists): `src/hooks/useDescriptionSuggestions.ts`

- [ ] **Step 1: Check and delete dead files**

```bash
ls "C:/Users/harsh/projects/expense-tracker/src/app/api/transactions/suggestions/route.ts" && echo EXISTS || echo MISSING
ls "C:/Users/harsh/projects/expense-tracker/src/hooks/useDescriptionSuggestions.ts" && echo EXISTS || echo MISSING
```

Delete whichever exist:
```bash
rm -f "C:/Users/harsh/projects/expense-tracker/src/app/api/transactions/suggestions/route.ts"
rm -f "C:/Users/harsh/projects/expense-tracker/src/hooks/useDescriptionSuggestions.ts"
```

- [ ] **Step 2: Rewrite AIInputBar.tsx**

Replace the entire file:

```typescript
// src/components/AIInputBar.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { parse } from '@/lib/smartParser'
import { useTripContext } from '@/lib/tripContext'
import { saveExample } from '@/lib/trainingStore'
import { getTopExamples } from '@/lib/trainingStore'
import { ParseResult } from '@/lib/types'
import { getCategoryById, getCategoriesForType } from '@/lib/categories'
import VoiceInput from './VoiceInput'

interface Chip { description: string; category: string; amount: number }

function getSmartChips(transactions: Array<{ description?: string | null; category: string; amount: number; date: string }>, hour: number): Chip[] {
  let range: [number, number]
  if (hour >= 6 && hour < 11) range = [6, 11]
  else if (hour >= 11 && hour < 15) range = [11, 15]
  else if (hour >= 17 && hour < 22) range = [17, 22]
  else range = [21, 28]

  const relevant = transactions.filter(t => {
    const h = new Date(t.date + 'T12:00:00').getHours()
    return h >= range[0] && h < range[1] && t.description
  })

  const freq = new Map<string, { chip: Chip; count: number }>()
  for (const t of relevant) {
    const key = `${t.description}-${t.category}`
    const existing = freq.get(key)
    if (existing) {
      existing.count++
    } else {
      freq.set(key, { chip: { description: t.description!, category: t.category, amount: Math.round(Number(t.amount)) }, count: 1 })
    }
  }
  return [...freq.values()].sort((a, b) => b.count - a.count).slice(0, 5).map(x => x.chip)
}

export default function AIInputBar() {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [chipTxns, setChipTxns] = useState<Array<{ description?: string | null; category: string; amount: number; date: string }>>([])
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { activeTrip, pendingPrefill, setPendingPrefill } = useTripContext()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch recent transactions for smart chips
  useEffect(() => {
    fetch('/api/transactions/recent?days=90')
      .then(r => r.json())
      .then(d => setChipTxns(d.transactions ?? []))
      .catch(() => {})
  }, [])

  // Consume pendingPrefill from TripContext
  useEffect(() => {
    if (!pendingPrefill) return
    const text = `${pendingPrefill.description} ${pendingPrefill.amount}`
    setInput(text)
    const result = parse(text)
    setParsed({ ...result, type: pendingPrefill.type })
    setPendingPrefill(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [pendingPrefill, setPendingPrefill])

  // Debounced parse with Ollama fallback
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!input.trim()) { setParsed(null); return }
    debounceRef.current = setTimeout(async () => {
      const regexResult = parse(input)
      if (regexResult.confidence === 'high') {
        setParsed(regexResult)
        return
      }
      // Ollama fallback
      setLoading(true)
      try {
        const examples = getTopExamples(10)
        const res = await fetch('/api/ai/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input, examples }),
        })
        if (res.ok) {
          setParsed(await res.json())
        } else {
          setParsed(regexResult)
        }
      } catch {
        setParsed(regexResult)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [input])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function submitTransaction(result: ParseResult, overrideCategory?: string) {
    if (submitting) return
    setSubmitting(true)
    const category = overrideCategory ?? result.category
    const wasCorrection = overrideCategory !== undefined && overrideCategory !== result.category
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: result.type,
          amount: result.amount,
          category,
          description: result.description,
          date: new Date().toISOString().slice(0, 10),
          trip_id: activeTrip?.id ?? null,
        }),
      })
      if (!res.ok) throw new Error()
      saveExample(input || result.description, { ...result, category }, wasCorrection)
      setInput('')
      setParsed(null)
      showToast('✓ Logged')
    } catch {
      showToast('Failed to log')
    } finally {
      setSubmitting(false)
    }
  }

  async function submit(overrideCategory?: string) {
    if (!parsed || parsed.amount <= 0) return
    await submitTransaction(parsed, overrideCategory)
  }

  async function chipTap(chip: Chip) {
    await submitTransaction({ amount: chip.amount, category: chip.category, description: chip.description, type: 'expense', confidence: 'high' })
  }

  const catForType = getCategoriesForType(parsed?.type ?? 'expense')
  const chips = getSmartChips(chipTxns, new Date().getHours())

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-40 px-4">
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

      {/* Smart chips */}
      {!parsed && chips.length > 0 && (
        <div className="flex gap-1.5 mb-2 overflow-x-auto pb-0.5">
          {chips.map((c, i) => (
            <button key={i} onClick={() => chipTap(c)}
              className="flex-shrink-0 px-2.5 py-1 rounded-2xl text-[11px] border bg-orange-500/10 border-orange-500/20 text-orange-400 whitespace-nowrap">
              {getCategoryById(c.category)?.emoji} {c.description}
            </button>
          ))}
        </div>
      )}

      {/* Main bar */}
      <div className="flex items-center gap-2 bg-[#16161f] border border-orange-500/30 rounded-3xl px-4 py-2.5 shadow-xl shadow-black/50">
        <VoiceInput onTranscript={t => setInput(t)} onError={msg => showToast(msg)} />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Type or speak an expense…"
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
        />
        {loading && (
          <span className="w-8 h-8 flex items-center justify-center text-orange-400 animate-spin text-base">⟳</span>
        )}
        {!loading && parsed && parsed.amount > 0 && (
          <button onClick={() => submit()} disabled={submitting}
            className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-sm text-orange-400">
            ➤
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AIInputBar.tsx
git rm --cached src/app/api/transactions/suggestions/route.ts 2>/dev/null || true
git rm --cached src/hooks/useDescriptionSuggestions.ts 2>/dev/null || true
git commit -m "feat: AIInputBar — Ollama fallback, smart chips, prefill from context, training store"
```

---

## Task 10: Dashboard UI redesign

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Rewrite dashboard/page.tsx**

Replace the entire file with the dark bento layout:

```typescript
// src/app/dashboard/page.tsx
export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '@/lib/supabase'
import TransactionList from '@/components/TransactionList'
import BentoCategoryGrid from '@/components/BentoCategoryGrid'
import ActiveTripBanner from '@/components/ActiveTripBanner'
import AIInsightCard from '@/components/AIInsightCard'
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

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const month = params.month ?? currentMonth
  const [year, m] = month.split('-').map(Number)

  const prevDate = new Date(year, m-2, 1)
  const nextDate = new Date(year, m, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`
  const isCurrentMonth = month === currentMonth
  const monthLabel = new Date(year, m-1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const [transactions, prevMonthTransactions] = await Promise.all([
    getTransactions(month),
    getTransactions(prevMonth),
  ])

  const income = transactions.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
  const balance = income - expenses
  const todayStr = now.toISOString().slice(0,10)
  const todaySpend = transactions
    .filter(t => t.type === 'expense' && t.date === todayStr)
    .reduce((s,t) => s + Number(t.amount), 0)

  const hourOfDay = now.getHours()
  const greeting = hourOfDay < 12 ? 'Good morning' : hourOfDay < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <main className="min-h-screen pb-32" style={{ background: '#0b0c15' }}>
      {/* Background gradient blobs */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 0% 0%, rgba(255,107,53,0.12), transparent 50%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 100% 40%, rgba(139,92,246,0.10), transparent 50%)' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4">
        {/* Month nav + greeting */}
        <div className="flex items-center justify-between pt-14 pb-2">
          <Link href={`/dashboard?month=${prevMonth}`}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white text-lg transition-all">
            ‹
          </Link>
          <p className="text-white/40 text-xs font-semibold tracking-wide">{monthLabel}</p>
          <Link href={`/dashboard?month=${nextMonth}`}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all
              ${isCurrentMonth ? 'text-white/10 pointer-events-none' : 'text-white/40 hover:text-white'}`}>
            ›
          </Link>
        </div>

        {/* Greeting + Balance */}
        <div className="pb-4">
          <p className="text-white/40 text-sm mb-1">{greeting} 👋</p>
          <p className="font-extrabold tracking-tight"
            style={{ fontSize: 'clamp(2rem, 9vw, 3rem)', background: 'linear-gradient(90deg,#fff 60%,#ff9f00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {fmt(balance)}
          </p>
        </div>

        {/* Stats pills */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { label: 'Income', value: fmt(income), color: 'text-emerald-400' },
            { label: 'Spent', value: fmt(expenses), color: 'text-red-400' },
            { label: 'Today', value: fmt(todaySpend), color: 'text-white' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-3 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 text-white/40">{label}</p>
              <p className={`font-bold text-sm tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Active trip banner */}
        <ActiveTripBanner />

        {/* AI Insight Card + Heatmap */}
        <div className="mb-4">
          <AIInsightCard />
        </div>

        {/* Category bento grid */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Categories</p>
          <BentoCategoryGrid transactions={transactions} prevMonthTransactions={prevMonthTransactions} />
        </div>

        {/* Recent transactions */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Recent</p>
            <Link href="/history" className="text-orange-400 text-xs font-medium hover:text-orange-300 transition-colors">
              See all →
            </Link>
          </div>
          <TransactionList transactions={transactions} limit={5} showRepeat />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd "C:/Users/harsh/projects/expense-tracker" && npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors before committing.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: dashboard UI redesign — dark bento layout, gradient blobs, bento category grid"
```

---

## Task 11: Cleanup and verify

- [ ] **Step 1: Remove `types.ts` Suggestion interface** (if not already done in Task 1)

Check that `Suggestion` is gone from `src/lib/types.ts`.

- [ ] **Step 2: Run TypeScript check**

```bash
cd "C:/Users/harsh/projects/expense-tracker" && npx tsc --noEmit 2>&1
```

Fix any errors.

- [ ] **Step 3: Start dev server and verify**

```bash
cd "C:/Users/harsh/projects/expense-tracker" && npm run dev
```

Open `http://localhost:3000/dashboard` and verify:
- Dark background with gradient blobs ✓
- No blue header ✓
- Greeting + balance in gradient text ✓
- Stats pills (glassmorphism) ✓
- Heatmap grid visible (may be empty on sparse data) ✓
- Bento category tiles ✓
- Recent transactions ✓

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup — remove dead suggestions route and Suggestion type"
```
