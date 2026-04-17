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

## Architecture

### New Files

```
src/
├── lib/
│   ├── ollamaParser.ts       # Calls local Ollama API → ParseResult
│   ├── patternEngine.ts      # Rule-based pattern detection (recurring, spikes, digest)
│   └── trainingStore.ts      # Reads/writes few-shot example pairs to localStorage
├── app/
│   └── api/
│       └── ai/
│           └── parse/
│               └── route.ts  # Server route proxy to Ollama
└── components/
    └── AIInsightCard.tsx     # Glassmorphism proactive card (dashboard top)
    └── SpendingHeatmap.tsx   # GitHub-style 3-week calendar grid
```

### Modified Files

```
src/
├── components/
│   ├── AIInputBar.tsx        # Add Ollama fallback, spinner, smart chips
│   └── SummaryCards.tsx      # Replace with bento 2×2 category grid
├── app/
│   └── dashboard/
│       └── page.tsx          # Add AI insight card + heatmap above bento grid
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
POST /api/ai/parse
      ↓
ollamaParser.parse(input, fewShotExamples)
      ↓
Returns ParseResult  ──→  AIInputBar shows category tag + amount
```

### `src/lib/ollamaParser.ts`

Calls `http://localhost:11434/api/generate` (Ollama default) with `gemma3:4b`.

**Prompt structure:**
```
You are an expense parser. Extract amount, category, and description from the user's input.
Valid categories: food, transport, shopping, health, entertainment, other_expense, income.

Examples from this user's history:
{fewShotExamples}  ← injected from trainingStore

Input: "{userText}"

Respond ONLY with JSON: {"amount": number, "category": string, "description": string, "type": "expense"|"income", "confidence": "high"|"low"}
```

**Fallback:** If Ollama is unreachable (connection refused), return the original regex result unchanged. No error shown to user — the inline category selector appears as usual for `confidence: low`.

**Timeout:** 8 seconds. If exceeded, fall back to regex result.

### `/api/ai/parse/route.ts`

```typescript
POST /api/ai/parse
Body: { input: string, examples: Array<{input: string, result: ParseResult}> }
Response: ParseResult
```

Proxies to Ollama. Keeps API key / Ollama URL server-side (not exposed to client).

### AIInputBar changes

- Shows a small spinner (replacing the send `➤` button) during Ollama call
- On result: renders category emoji + amount as a compact inline tag (single line, no extra height)
- No change to bar dimensions

---

## Feature 2: Training Store

### `src/lib/trainingStore.ts`

Persists to `localStorage` under key `expense-tracker:training-examples`.

```typescript
interface TrainingExample {
  input: string          // raw user text
  result: ParseResult    // confirmed final result
  corrected: boolean     // true if user overrode AI suggestion
  timestamp: number
}

export function saveExample(input: string, result: ParseResult, corrected: boolean): void
export function getTopExamples(n: number): TrainingExample[]  // most recent + all corrected first
export function clearExamples(): void
```

**When to save:**
- On every successful transaction submission from AIInputBar
- `corrected: true` when user changed the AI-suggested category before submitting

**Injection:** `ollamaParser.ts` calls `getTopExamples(10)` before each Ollama call and injects them as few-shot examples into the prompt. Corrected examples are always included first.

**Storage limit:** Cap at 200 examples. Oldest non-corrected examples are dropped first when limit is reached.

---

## Feature 3: Proactive Pattern Engine

### `src/lib/patternEngine.ts`

Runs client-side on the transaction array. Returns an array of `Insight` objects (max 3).

```typescript
interface Insight {
  type: 'recurring' | 'spike' | 'digest'
  title: string           // short label
  body: string            // Tanglish message
  action?: {
    label: string
    prefill: Partial<ParseResult>  // pre-fills AIInputBar on tap
  }
  dismissKey: string      // localStorage key to track dismissal
}
```

#### Pattern 1: Recurring Behaviour

Detects if a category appears 3+ times on the same weekday in the past 4 weeks.

- Calculates average amount for that category on that weekday
- Only fires on the matching weekday
- Example output: *"Nee Friday-la petrol fill panna usual — today panniyacha? ⛽"*
- Action: pre-fills AIInputBar with Transport + average amount

#### Pattern 2: Spending Spike

- Compares current week spend per category vs 4-week rolling average
- Fires if current week > 1.8× average for any category
- Example output: *"Saapadu-ku இந்த வாரம் ₹1,800 — usual-a vida 2x aagidhu 🍕"*
- No action button — informational only, dismissable

#### Pattern 3: Weekly Digest (Monday only)

- Fires on Mondays, dismissed for the week once seen
- Summarises last week: total spend, top category, vs previous week
- Body generated by `gemma3:4b` if Ollama is running; falls back to a template string if not
- Example: *"Last week: ₹6,200 spent. Food was biggest (₹2,100). Previous week-a vida ₹400 kammiya — good job! 💪"*

### Dashboard integration

`AIInsightCard.tsx` — a single dismissable card rendered above the heatmap.

- Shows the highest-priority insight (recurring > spike > digest)
- Swipe right or tap ✕ to dismiss (stored in localStorage by `dismissKey`)
- Tapping the action button pre-fills AIInputBar and focuses it
- Max height: 80px — compact, not intrusive

---

## Feature 4: UI Redesign

### Dashboard layout (top → bottom)

```
Status bar
Greeting + Balance (gradient text)
Income / Spent / Today pills (3 columns)
AIInsightCard (glassmorphism, dismissable)      ← NEW
SpendingHeatmap (3-week grid)                   ← NEW
Section label: "Categories"
BentoCategoryGrid (2×2 replacing flat bars)     ← UPDATED
Section label: "Recent"
TransactionList (unchanged)
AIInputBar + chips (above bottom nav)
BottomNav
```

### `AIInsightCard.tsx`

- Background: `rgba(255,107,53,0.08)`, border: `rgba(255,107,53,0.25)`, `border-radius: 20px`
- Pulsing orange dot + "AI Insight" label
- Body text: 13px, line-height 1.55
- Action buttons: small pill buttons inline below text
- Dismiss: ✕ top-right, stores `dismissed-{dismissKey}-{weekStamp}` in localStorage

### `SpendingHeatmap.tsx`

- 3 rows × 7 columns grid (21 days ending today)
- Each cell: `border-radius: 5px`, colour intensity based on daily spend:
  - No spend: `rgba(255,255,255,0.05)`
  - L1 (< avg): `rgba(255,107,53,0.2)`
  - L2 (avg): `rgba(255,107,53,0.45)`
  - L3 (1.5× avg): `rgba(255,107,53,0.7)`
  - L4 (2× avg+): `rgba(255,107,53,0.95)`
- Today cell: `box-shadow: 0 0 0 2px #ff6b35`
- Props: `transactions: Transaction[]`

### Background

- Dashboard page body: `background: #0b0c15`
- Two radial gradient blobs (CSS `::before`/`::after` on a fixed div):
  - Orange blob: top-left, `rgba(255,107,53,0.12)`
  - Purple blob: mid-right, `rgba(139,92,246,0.10)`

### Smart chips (AIInputBar)

Logic in `AIInputBar.tsx`:

```typescript
function getSmartChips(transactions: Transaction[], hour: number): Chip[]
```

- Fetches last 90 days of transactions from `/api/transactions?limit=200`
- Groups by hour range (morning 6–10, lunch 11–14, evening 17–21, night 21+)
- Returns top 5 most frequent (description + amount) for current hour range
- Chips rendered as horizontal scroll above input bar, tap = sets input + immediately submits

---

## Data Flow

```
User input (text/voice)
    ↓
smartParser (regex, < 50ms)
    ↓ confidence=low?
    ↓ yes → POST /api/ai/parse → ollamaParser (gemma3:4b + few-shot examples)
    ↓
AIInputBar shows tag: [emoji category] [₹amount]
    ↓
User submits
    ↓
POST /api/transactions
trainingStore.saveExample(input, result, corrected)
    ↓
Dashboard refreshes, patternEngine re-evaluates
```

---

## Out of Scope

- Actual model fine-tuning (weight updates) — few-shot injection achieves same effect
- Tamil script keyboard / IME
- Cloud sync of training examples
- Chat interface (future upgrade)
- Push notifications

---

## Success Criteria

- *"chai kudi 35"* → Food ₹35 parsed correctly within 8 seconds
- *"amma medicine vaanginen 450"* → Health ₹450
- After 20 corrections, AI gets user's personal phrases right
- Petrol chip appears on Fridays if user fills up every Friday
- Heatmap renders correctly for last 21 days
- Ollama offline → graceful fallback, no crash
- AI insight card dismisses and does not reappear until next week (digest) or next trigger (recurring)
- Dashboard fits on a 375px screen without scrolling past the fold for key info
