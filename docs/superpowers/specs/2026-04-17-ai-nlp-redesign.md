# Spec: AI-Powered NLP, Pattern Engine & UI Redesign
**Date:** 2026-04-17
**Status:** Approved

---

## Overview

Three interconnected upgrades to the expense tracker:

1. **Hybrid NLP Parser** — regex fast path stays; `gemma3:4b` via local Ollama handles messy Tamil+English input when regex confidence is low
2. **Proactive Pattern Engine** — client-side rule engine detects recurring behaviour, spending spikes, and generates weekly digests
3. **UI Redesign** — dark bento dashboard with glassmorphism AI card, spending heatmap, smart input chips, and personal model training from user corrections

All features are zero-cost and work offline (Ollama runs locally).

---

## Type Changes

### Widen `ParseResult.type` (`src/lib/types.ts`)

`ParseResult.type` is currently hardcoded `'expense'`. It must be widened to `'expense' | 'income'` so the Ollama parser can return income entries (e.g. "salary 42000 received").

```typescript
export interface ParseResult {
  amount: number
  category: string        // valid category ID from CATEGORIES
  description: string
  type: 'expense' | 'income'   // ← widened from 'expense'
  confidence: 'high' | 'low'
}
```

This is a non-breaking change — the regex parser always returns `'expense'` today, which still satisfies the widened union.

---

## Architecture

### New Files

```
src/
├── lib/
│   ├── ollamaParser.ts          # Calls local Ollama API → ParseResult
│   ├── patternEngine.ts         # Rule-based pattern detection (recurring, spikes, digest)
│   └── trainingStore.ts         # Reads/writes few-shot example pairs to localStorage
├── app/
│   └── api/
│       ├── ai/
│       │   ├── parse/
│       │   │   └── route.ts     # POST: NLP parse proxy to Ollama
│       │   └── digest/
│       │       └── route.ts     # POST: weekly digest text generation via Ollama
│       └── transactions/
│           └── recent/
│               └── route.ts     # GET: recent transactions windowed by ?days=N
└── components/
    ├── AIInsightCard.tsx         # Glassmorphism proactive card (dismissable)
    ├── SpendingHeatmap.tsx       # GitHub-style 3-week calendar grid
    └── BentoCategoryGrid.tsx     # 2×2 bento tiles replacing SummaryCards + CategoryBars
```

### Modified Files

```
src/
├── lib/
│   ├── types.ts                 # Widen ParseResult.type
│   └── tripContext.tsx          # Add pendingPrefill / setPendingPrefill to TripContextValue
├── components/
│   └── AIInputBar.tsx           # Add Ollama fallback, spinner, smart chips, prefill consumption;
│                                #   remove old suggestions fetch + suggestion pills UI
├── app/
│   └── dashboard/
│       └── page.tsx             # Remove blue hero header + BottomNav import/usage;
│                                #   add dark bg, gradient blobs, AI card, heatmap, bento grid
```

---

## Feature 1: Hybrid NLP Parser

### Flow

```
User types/speaks
      ↓
smartParser.parse(input)
      ↓
confidence === 'high'?  ──yes──→  Use result immediately (< 50ms)
      ↓ no
POST /api/ai/parse  { input, examples }
      ↓
ollamaParser  →  gemma3:4b  →  JSON ParseResult
      ↓
Validate + sanitise category (see below)
      ↓
AIInputBar shows compact tag: [emoji category] [₹amount]
```

### `src/lib/ollamaParser.ts`

Calls `http://localhost:11434/api/generate` (Ollama default) with model `gemma3:4b`.

**Category list in prompt:** Must be derived from `CATEGORIES` in `src/lib/categories.ts` at runtime — never hardcoded. Build two lists:

```typescript
const expenseCats = CATEGORIES.filter(c => c.type === 'expense').map(c => c.id).join(', ')
// → "food, transport, rent, utilities, health, shopping, entertainment, other_expense"

const incomeCats = CATEGORIES.filter(c => c.type === 'income').map(c => c.id).join(', ')
// → "salary, freelance, investment, other_income"
```

**Prompt structure:**

```
You are an expense parser for a personal finance app. Extract the transaction details from the user's input.
The user speaks Tamil and English (Tanglish). Understand both.

For expenses, valid category IDs are: {expenseCats}
For income, valid category IDs are: {incomeCats}

Examples from this user's history:
{fewShotExamples}

Input: "{userText}"

Respond ONLY with valid JSON, no explanation:
{"amount": number, "category": string, "description": string, "type": "expense" or "income", "confidence": "high" or "low"}
```

**Output validation:** After parsing the model's JSON response, validate:
- `category` must exist in `CATEGORIES` (via `getCategoryById`). If not, replace with `other_expense` (for expense) or `other_income` (for income) based on `type`.
- `type` must be `'expense'` or `'income'`. Default to `'expense'` if missing/invalid.
- `amount` must be a positive number. If missing/zero, return `confidence: 'low'`.
- `description` must be a non-empty string. Fall back to `userText` if blank.

**Fallback:** If Ollama is unreachable (connection refused or timeout > 8s), return the original regex result unchanged. No error shown — the inline category selector appears as usual for `confidence: low`.

### `POST /api/ai/parse`

```typescript
// Request
{ input: string, examples: Array<{ input: string, result: ParseResult }> }

// Response
ParseResult
```

Proxies to Ollama server-side. Ollama URL (`http://localhost:11434`) stays server-side only — never exposed to client.

### AIInputBar changes (NLP only)

- During Ollama call: spinner icon replaces the send `➤` button
- On result: single compact inline tag shows `[emoji] [category] · ₹[amount]` — one line, no height increase to the bar
- Bar width, height, and position unchanged

---

## Feature 2: Training Store

### `src/lib/trainingStore.ts`

Persists to `localStorage` under key `expense-tracker:training-examples`.

```typescript
interface TrainingExample {
  input: string          // raw user text
  result: ParseResult    // confirmed final result
  corrected: boolean     // true if user changed AI's suggested category/amount
  timestamp: number      // ms since epoch
}

export function saveExample(input: string, result: ParseResult, corrected: boolean): void
export function getTopExamples(n: number): TrainingExample[]
export function clearExamples(): void
```

**`getTopExamples(n)` sort order:** Partition by `corrected`, each partition sorted by `timestamp DESC`, corrected partition first. So: most recent corrections first, then most recent non-corrected confirmations.

**When to save:**
- On every successful transaction submission from AIInputBar
- `corrected: true` when user changed the AI-suggested category or amount before submitting

**Storage limit:** Cap at 200 examples. When adding beyond 200, drop the oldest non-corrected example first. Corrected examples are never auto-dropped (they are the most valuable signal).

**Dismissal key pruning:** Insight dismissal keys (stored separately under `expense-tracker:dismissed:*`) are pruned on read — any key older than 60 days is deleted during `AIInsightCard` mount to prevent unbounded accumulation.

**Size estimate:** 200 examples × ~500 bytes (Tamil Unicode + JSON) ≈ 100 KB. Well within `localStorage`'s 5 MB limit.

---

## Feature 3: New API Routes

### `POST /api/ai/parse`

Defined above in Feature 1.

### `POST /api/ai/digest`

Generates the weekly digest body text via Ollama.

```typescript
// Request
{
  weekTotal: number,
  topCategory: string,       // category label (e.g. "Food")
  topCategoryAmount: number,
  prevWeekTotal: number,
}

// Response
{ text: string }  // Tanglish digest sentence, max 2 sentences
```

Prompt:

```
Write a friendly 1-2 sentence weekly spending summary in Tanglish (Tamil + English mix).
Be casual and encouraging. Use ₹ for amounts.

This week: ₹{weekTotal} total. Top category: {topCategory} ₹{topCategoryAmount}.
Previous week: ₹{prevWeekTotal}.

Respond with ONLY the summary text.
```

If Ollama is unreachable, return a template fallback:
```
"Last week: ₹{weekTotal} spent. {topCategory} was biggest (₹{topCategoryAmount})."
```

---

## Feature 4: Pattern Engine

### `src/lib/patternEngine.ts`

Pure function — takes a transaction array, returns up to 3 `Insight` objects. No API calls, no side effects.

```typescript
interface Insight {
  type: 'recurring' | 'spike' | 'digest'
  title: string
  body: string
  action?: {
    label: string
    prefill: { category: string; amount: number; description: string; type: 'expense' | 'income' }
  }
  dismissKey: string
}

export function detectInsights(transactions: Transaction[], today: Date): Insight[]
```

#### Pattern 1: Recurring Behaviour

- Look at last 28 days of transactions
- Group by weekday + category
- If a category appears on the same weekday ≥ 3 times: fire insight on that weekday
- `action.prefill` = `{ category, amount: Math.round(average), description: mostCommonDescription, type: 'expense' }`
- `dismissKey` = `recurring-{category}-{weekday}-{YYYY-WW}` (resets weekly)
- Example body: *"Nee Friday-la petrol fill panna usual — today panniyacha? ⛽"*

**`{YYYY-WW}` format:** ISO 8601 week — use this helper: `const d = new Date(today); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const w = Math.ceil(((d - new Date(Date.UTC(d.getUTCFullYear(),0,1))) / 86400000 + 1) / 7); const year = d.getUTCFullYear(); return \`${year}-W${String(w).padStart(2,'0')}\`` — yields e.g. `2026-W16`.

#### Pattern 2: Spending Spike

- Compare current week (Mon–today) spend per category vs 4-week rolling average
- Fire if current week > 1.8× average for any category
- Pick the single largest spike only
- No action button
- `dismissKey` = `spike-{category}-{YYYY-WW}` (same ISO 8601 helper above)
- Example body: *"Saapadu-ku இந்த வாரம் ₹1,800 — usual-a vida 2x aagidhu 🍕"*

#### Pattern 3: Weekly Digest

- Fires on Mondays only
- `dismissKey` = `digest-{YYYY-WW}` (auto-dismissed once seen for the week)
- Body: fetched from `POST /api/ai/digest` (with template fallback if Ollama offline)
- No action button

#### Priority: `recurring > spike > digest`. `AIInsightCard` shows one at a time.

### How pattern engine gets transaction data

`AIInsightCard.tsx` is a `'use client'` component. It fetches its own transaction data on mount:

```typescript
useEffect(() => {
  fetch('/api/transactions/recent?days=90')
    .then(r => r.json())
    .then(d => setTransactions(d.transactions ?? []))
}, [])
```

This keeps the dashboard server component unchanged. The fetch is independent and non-blocking — insights load after the page paints.

### New endpoint: `GET /api/transactions/recent?days=N`

```typescript
// Request: GET /api/transactions/recent?days=90
// Query params:
//   days: number — how many trailing days to include (default: 30, max: 90; values > 90 are silently clamped to 90)
// Date boundary: calendar days relative to server UTC midnight
// Response: { transactions: Transaction[] }
// Error: { error: string } with 400 if days is non-numeric
```

Add to `src/app/api/transactions/recent/route.ts`.

`AIInsightCard` fetches this endpoint, passes the resulting `transactions` array as a prop to `SpendingHeatmap`. `AIInputBar` makes its own independent fetch from the same endpoint to power smart chips — this is a separate `useEffect` in `AIInputBar` triggered on mount, keeping the two components decoupled.

---

## Feature 5: AIInputBar Redesign

### New prop: `prefill`

```typescript
interface AIInputBarProps {
  prefill?: { category: string; amount: number; description: string; type: 'expense' | 'income' } | null
}
```

When `prefill` is set (from an insight card action), `AIInputBar`:
1. Sets the input text to `"{description} {amount}"`
2. Runs `smartParser.parse()` on it immediately (will be high confidence since category keyword is present); then overrides `parsed.type` with `prefill.type`
3. Focuses the input
4. Clears `prefill` after consuming it (parent passes `null` after)

`AIInsightCard` calls `setPendingPrefill(insight.action.prefill)` from `useTripContext()`. `AIInputBar` reads `pendingPrefill` from the same context and consumes it. No callback prop or prop drilling required.

**Placement:** `AIInsightCard` is a `'use client'` component rendered inside `dashboard/page.tsx` as a client island (the server page just imports and renders it). It is NOT added to `layout.tsx`. The `TripProvider` in `layout.tsx` wraps the entire tree, so `useTripContext()` works inside `AIInsightCard` even though it is mounted from a server page.

**TripContext extension** — add to `TripContextValue` in `src/lib/tripContext.tsx`:

```typescript
pendingPrefill: { category: string; amount: number; description: string; type: 'expense' | 'income' } | null
setPendingPrefill: (v: { category: string; amount: number; description: string; type: 'expense' | 'income' } | null) => void
```

`TripProvider` adds `const [pendingPrefill, setPendingPrefill] = useState(null)` and includes both in the context value. Initial value: `null`.

Note: `Insight.action.prefill` already has `type: 'expense' | 'income'`, matching this shape exactly. `AIInsightCard` passes `insight.action.prefill` directly to `setPendingPrefill`.

### AIInputBar: category selector uses `parsed.type`

The existing AIInputBar has `getCategoriesForType('expense')` hardcoded on line 75. This must be changed to `getCategoriesForType(parsed?.type ?? 'expense')` so that when Ollama returns an income parse, the category selector shows income categories instead of expense categories.

### Smart chips (replaces old suggestion pills)

**Remove** the existing `suggestions` state, the `fetch('/api/transactions/suggestions')` effect, and the `{!parsed && suggestions.length > 0 && ...}` render block entirely. Smart chips replace them.

```typescript
function getSmartChips(transactions: Transaction[], hour: number): Chip[]
```

- `transactions` fetched via a dedicated `useEffect` in `AIInputBar` on mount: `fetch('/api/transactions/recent?days=90').then(r => r.json()).then(d => setChipTransactions(d.transactions ?? []))`
- Groups by hour range: morning (6–10), lunch (11–14), evening (17–21), night (21+)
- Returns top 5 most frequent `{description, category, amount}` tuples for current hour
- Chips: horizontal scroll, `flex-shrink-0`, max 5, above input bar
- Tap = directly POSTs the transaction (skips debounce + `parsed` state entirely): call `submitTransaction({ amount: chip.amount, category: chip.category, description: chip.description, type: 'expense', confidence: 'high' })` — extract a `submitTransaction(result: ParseResult)` helper from the existing submit handler so both the normal flow and chip tap share it

---

## Feature 6: UI Redesign

### Dashboard layout (top → bottom)

The existing blue hero header (`bg-gradient-to-br from-blue-600...`) is **removed**. Replaced with:

```
Status bar (system)
Greeting line + Balance (gradient text, white→orange)
Income / Spent / Today pills (3 columns, glassmorphism)
AIInsightCard (dismissable, lazy-loaded)          ← NEW
SpendingHeatmap (3-week grid, lazy-loaded)         ← NEW
Section label: "Categories"
BentoCategoryGrid (2×2)                            ← REPLACES flat bars
Section label: "Recent"
TransactionList (limit 5, unchanged)
[AIInputBar + chips above BottomNav — in layout]
BottomNav
```

### Background

`dashboard/page.tsx` body: `bg-[#0b0c15]`. A fixed `<div>` with `pointer-events-none` and two CSS radial gradient blobs:
- Orange: top-left, `radial-gradient(circle at 0% 0%, rgba(255,107,53,0.12), transparent 50%)`
- Purple: mid-right, `radial-gradient(circle at 100% 40%, rgba(139,92,246,0.10), transparent 50%)`

### `AIInsightCard.tsx`

- `'use client'`, fetches own transactions from `/api/transactions/recent?days=90`
- Background: `rgba(255,107,53,0.08)`, border: `rgba(255,107,53,0.25)`, `border-radius: 20px`
- Pulsing orange dot (CSS animation, `rgba(255,107,53,1)` → `rgba(255,107,53,0.4)`)
- Body: 13px, `line-height: 1.55`, max 2 lines
- Action buttons: small pill buttons inline, `font-size: 11px`
- Dismiss: ✕ top-right corner; stores `expense-tracker:dismissed:{dismissKey}` in `localStorage`
- Height: max 90px total

### `SpendingHeatmap.tsx`

Props: `transactions: Transaction[]` — passed from `AIInsightCard`'s fetch result (not fetched independently; `AIInsightCard` renders `<SpendingHeatmap transactions={transactions} />`).

- 3 rows × 7 columns = 21 days ending today
- Each cell: `border-radius: 5px`, colour by daily spend vs 21-day average:
  - 0: `rgba(255,255,255,0.05)`
  - < avg: `rgba(255,107,53,0.2)`
  - ≈ avg: `rgba(255,107,53,0.45)`
  - 1.5× avg: `rgba(255,107,53,0.7)`
  - 2×+ avg: `rgba(255,107,53,0.95)`
- Today cell: `box-shadow: 0 0 0 2px #ff6b35`

### `BentoCategoryGrid.tsx` (`src/components/BentoCategoryGrid.tsx`)

Replaces `SummaryCards` and `CategoryBars` on the dashboard.

```typescript
interface BentoCategoryGridProps {
  transactions: Transaction[]  // current month's transactions (passed from dashboard server component)
  prevMonthTransactions: Transaction[]  // previous month's transactions (passed from dashboard server component)
}
```

The dashboard server component already fetches the current month and computes `prevMonth` (e.g. `"2026-03"`). Add a second fetch for the previous calendar month using the existing `GET /api/transactions` endpoint with `?month={prevMonth}` — this param is already supported by the route handler.

**Rendering:** 2×2 grid (`grid-cols-2 gap-3`). For each of the top 4 categories by current-month spend:
- Emoji (from `getCategoryById(id).emoji`)
- Label (`getCategoryById(id).label`)
- Amount (`₹{amount.toLocaleString('en-IN')}`)
- Delta: `+₹X` in green or `-₹X` in orange vs previous month (show `—` if no previous month data)
- Mini gradient bar: `height: 3px`, fill proportion = `amount / maxCategoryAmount` across the 4 tiles, `background: linear-gradient(90deg, #ff6b35, #ff9f00)`

Tile style: `bg-white/[0.04] border border-white/[0.06] rounded-2xl p-3`

---

## Out of Scope

- Actual model fine-tuning (weight updates) — few-shot injection achieves the same effect
- Tamil script keyboard / IME integration
- Cloud sync of training examples
- Chat interface (future upgrade)
- Push notifications
- The `/daily` page and route (remains in codebase, just not in nav)

---

## Success Criteria

- *"chai kudi 35"* → Food ₹35 parsed correctly within 8 seconds via Ollama
- *"amma medicine vaanginen 450"* → Health ₹450
- *"salary vandhuchu 42000"* → Income, salary category, ₹42,000
- After 20+ corrections, Ollama prompt includes user-specific examples
- Petrol chip appears on Fridays after 3 consecutive Friday petrol entries
- Heatmap shows correct 21-day intensity grid
- Ollama offline → no crash; category selector shown; chips still work
- AI insight card dismisses and does not reappear within same week
- Dashboard fits on 375px screen, key info above the fold
- `/api/transactions/recent?days=90` returns correct windowed data
