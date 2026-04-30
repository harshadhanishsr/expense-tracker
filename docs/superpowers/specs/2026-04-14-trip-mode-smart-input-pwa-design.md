# Spec: Trip Mode, Smart Input, Voice Entry & PWA
**Date:** 2026-04-14
**Status:** Approved

---

## ⚠️ Important: Next.js Version Note

This project uses a Next.js version with breaking API changes. Before touching any route handler, layout, or metadata API, **read the local docs first**: `node_modules/next/dist/docs/`. Do not rely on training knowledge for Next.js APIs.

---

## Overview

Add three interconnected capabilities to the existing Next.js + Supabase expense tracker:

1. **Trip Mode** — a dedicated space to group, track, and review expenses within a named trip (defined by start/end dates)
2. **Smart Input (app-wide)** — a floating AI bar with regex-based natural language parsing and voice entry via Web Speech API
3. **PWA** — installable on iOS via "Add to Home Screen" with offline support

All features are zero-cost: no external AI APIs, no App Store fees.

---

## Type Definitions

### Updated `Transaction` interface (`src/lib/types.ts`)

```typescript
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
  trip_id?: string | null   // ← NEW: nullable FK to trips.id
}
```

### New `Trip` interface (`src/lib/types.ts`)

```typescript
export interface Trip {
  id: string
  name: string
  start_date: string        // ISO date string YYYY-MM-DD
  end_date: string          // ISO date string YYYY-MM-DD
  budget: number | null
  created_at: string
  // Computed fields returned by GET /api/trips and GET /api/trips/[id]
  total_spent: number
  expense_count: number
  days_elapsed: number      // days since start_date (capped at total trip days)
  total_days: number        // end_date - start_date + 1
}

export interface TripWithTransactions extends Trip {
  transactions: Transaction[]
}
```

### Parser result interface (`src/lib/smartParser.ts`)

```typescript
export interface ParseResult {
  amount: number
  category: string          // valid category ID from CATEGORIES (e.g. 'food', 'transport')
  description: string
  type: 'expense' | 'income'
  confidence: 'high' | 'low'
}
```

---

## Architecture

### New Files

```
src/
├── app/
│   ├── trips/
│   │   ├── page.tsx              # Trip list (active + past)
│   │   └── [id]/page.tsx         # Trip detail: budget ring, category tiles, timeline
│   └── api/
│       └── trips/
│           ├── route.ts          # GET list, POST create
│           └── [id]/route.ts     # GET detail, PATCH update, DELETE
├── components/
│   ├── AIInputBar.tsx            # Floating pill bar (app-wide, uses TripContext)
│   ├── VoiceInput.tsx            # Mic button + Web Speech API hook
│   ├── TripCard.tsx              # Active trip card (dashboard banner + trips list)
│   ├── TripCategoryGrid.tsx      # 2x2 bento category tiles on trip detail
│   └── TripTimeline.tsx          # Day-by-day expense timeline
├── lib/
│   ├── smartParser.ts            # Regex parsing: text → ParseResult
│   └── tripContext.tsx           # React Context: active trip state, shared app-wide
public/
├── manifest.json                 # PWA manifest
├── sw.js                         # Service worker
├── icon-192.png                  # PWA icon (generate from SVG at build time or provide manually)
└── icon-512.png                  # PWA icon
```

### Database Migration (`supabase/migrations/003_trips.sql`)

```sql
-- 1. New trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)   -- validation in DB
);

-- 2. Add trip_id FK to existing transactions table
ALTER TABLE transactions ADD COLUMN trip_id UUID REFERENCES trips(id) ON DELETE SET NULL;
CREATE INDEX ON transactions(trip_id);
```

---

## API Contracts

### `GET /api/trips`

Returns all trips ordered by `start_date DESC`, with computed fields.

**Response:**
```json
{
  "trips": [
    {
      "id": "uuid",
      "name": "Goa Trip",
      "start_date": "2026-04-12",
      "end_date": "2026-04-17",
      "budget": 12000,
      "created_at": "...",
      "total_spent": 3200,
      "expense_count": 14,
      "days_elapsed": 2,
      "total_days": 6
    }
  ]
}
```

`total_spent` and `expense_count` are computed via a Supabase query joining `transactions` where `type = 'expense'`.

---

### `POST /api/trips`

**Request body:**
```json
{
  "name": "Goa Trip",
  "start_date": "2026-04-12",
  "end_date": "2026-04-17",
  "budget": 12000          // optional, null if omitted
}
```

**Validation:**
- `name`: required, non-empty string
- `start_date`, `end_date`: required, valid date strings, `end_date >= start_date` (also enforced by DB constraint)
- `budget`: optional number > 0

**Response:** `201` with created `Trip` object (computed fields will be 0 on creation).

**Error:** `400` with `{ "error": "end_date must be >= start_date" }` etc.

---

### `GET /api/trips/[id]`

Returns a single trip with all its transactions (for the detail page).

**Response:**
```json
{
  "trip": {
    "id": "uuid",
    "name": "Goa Trip",
    "start_date": "2026-04-12",
    "end_date": "2026-04-17",
    "budget": 12000,
    "total_spent": 3200,
    "expense_count": 14,
    "days_elapsed": 2,
    "total_days": 6,
    "transactions": [ ...Transaction[] ordered by date DESC ]
  }
}
```

---

### `PATCH /api/trips/[id]`

Accepts partial updates. Allowed fields: `name`, `end_date`, `budget`. `start_date` is immutable after creation.

**Request body:** any subset of `{ name, end_date, budget }`.

**Response:** `200` with updated `Trip` object (without transactions).

If `start_date` is present in the body, **ignore it silently** — do not return an error.

---

### `DELETE /api/trips/[id]`

Hard delete. Linked transactions have their `trip_id` set to `NULL` (via `ON DELETE SET NULL`).

**Response:** `204` no content.

---

### Updated `POST /api/transactions`

**Add `trip_id` to the accepted body:**

```typescript
// In route.ts, update destructuring:
const { type, amount, category, date, description, is_recurring, recurrence_interval, trip_id } = body

// Validate: if trip_id provided, must be a valid UUID string
// Pass to Supabase insert:
await supabase.from('transactions').insert({
  type, amount, category, date, description,
  is_recurring: is_recurring ?? false,
  recurrence_interval: recurrence_interval ?? null,
  trip_id: trip_id ?? null     // ← NEW
})
```

---

## Feature: Smart Parser (`src/lib/smartParser.ts`)

Regex-based, zero-cost, runs entirely client-side.

### Category Keyword Map → Category IDs

Output `category` must be a valid ID from `CATEGORIES` in `src/lib/categories.ts`:

| Output ID | Trigger Keywords |
|---|---|
| `food` | food, lunch, dinner, breakfast, coffee, tea, snack, restaurant, cafe, drink, water, meal, eating |
| `transport` | auto, cab, uber, ola, bus, train, flight, taxi, transport, travel, petrol, fuel, metro, rickshaw |
| `other_expense` | hotel, stay, hostel, lodge, room, resort, accommodation, bnb, airbnb *(no hotel category exists — maps to other_expense)* |
| `shopping` | shop, shopping, clothes, market, buy, purchase |
| `health` | medical, medicine, doctor, pharmacy, hospital, health, clinic |
| `entertainment` | movie, show, event, ticket, fun, game, party, outing |
| `other_expense` | fallback if no keyword matches |

> **Note:** There is no `hotel` or `stay` category in the codebase. These map to `other_expense`. If a hotel/stay category is desired in the future, add it to `categories.ts` and this map.

### Parsing Rules (priority order)

| Pattern | Example | Output |
|---|---|---|
| `<keyword> <amount>` | `food 120` | category=food, amount=120, confidence=high |
| `<amount> <keyword>` | `120 food` | category=food, amount=120, confidence=high |
| `spent <amount> on <desc>` | `spent 80 on coffee` | category=food, amount=80, confidence=high |
| `<desc> <amount> for <note>` | `hotel 2000 for 2 nights` | category=other_expense, amount=2000, confidence=high |
| `<desc> to <place> <amount>` | `auto to airport 80` | category=transport, amount=80, confidence=high |
| number only | `120` | category=other_expense, amount=120, confidence=low |
| unrecognised text | `xyz 120` | category=other_expense, amount=120, confidence=low |

### confidence=low UI behaviour

When `confidence === 'low'`:
- The parse tags appear but a **category selector** row is shown inline below them (a horizontal scroll of category emoji buttons)
- Submission is **not blocked** — the user can submit immediately with `other_expense`, or tap a category button to override
- If the user submits without selecting, `other_expense` is used

---

## Feature: Voice Input (`src/components/VoiceInput.tsx`)

- Uses `window.SpeechRecognition || window.webkitSpeechRecognition` (Web Speech API)
- If API is unavailable (non-Safari non-Chrome browser), the mic button is **hidden** with no error
- On tap: request mic permission → if denied, show toast "Mic permission needed"
- On listening: mic button pulses (simple CSS border animation, very subtle)
- On result: transcript string is passed to `smartParser.parse()`, result populates the AIInputBar
- Language: `en-IN` (English, India) for better number recognition

---

## Feature: Active Trip Context (`src/lib/tripContext.tsx`)

A React Context that wraps the root layout and makes the active trip available app-wide without prop drilling.

```typescript
interface TripContextValue {
  activeTrip: Trip | null       // trip where today is within start_date..end_date
  setActiveTrip: (t: Trip | null) => void
  refreshActiveTrip: () => Promise<void>  // re-fetches from /api/trips
}
```

- Fetches `/api/trips` on mount, finds the trip where `start_date <= today <= end_date`
- If multiple trips overlap (should be prevented at create time, but if it happens), picks the one with the most recent `start_date`
- Trip creation (`POST /api/trips`) calls `refreshActiveTrip()` after success
- `AIInputBar` reads `activeTrip` from context to auto-assign `trip_id`

### Preventing overlapping trips

On `POST /api/trips`, before inserting, check if any existing trip's date range overlaps the new one. If yes, return `409 Conflict` with `{ "error": "A trip already exists for those dates" }`. The UI shows this as a toast.

---

## Feature: AI Input Bar (`src/components/AIInputBar.tsx`)

Rendered in root layout, sits above bottom nav on every page.

**No active trip state:** Bar works normally — expenses are logged without `trip_id`. No visual change except the trip auto-tag pill does not appear.

**With active trip:** After the parse tags, an additional pill appears: `🏖️ <Trip Name>` (purple/indigo colour). This indicates the expense will be tagged to the trip.

### Quick-suggest pills

- Reuses existing `/api/transactions/suggestions` endpoint (already built)
- Fetches top 3 suggestions on mount (most frequently used descriptions)
- On the trip detail page (`/trips/[id]`), pills are filtered to suggestions that have appeared in past trip expenses for that trip — falls back to global suggestions if none exist

### Submission flow

1. User types or speaks → `smartParser.parse()` → `ParseResult`
2. If `confidence === 'low'`, show inline category selector (non-blocking)
3. User taps send (or presses Enter)
4. `POST /api/transactions` with `{ ...parsedFields, trip_id: activeTrip?.id ?? null, date: today }`
5. On success: clear input, show brief "✓ Logged" toast, update dashboard counts

---

## Feature: Trip Mode UI

### Navigation Changes (`src/components/BottomNav.tsx`)

Current 5 tabs: Home · Daily · Add · Insights · History

Updated 5 tabs: **Home · Add · Trips · History · Insights**

- **Daily tab is removed.** The `/daily` route and page remain in the codebase (not deleted), just removed from the nav.
- Tab order chosen for mobile thumb-reach: most-used actions (Home, Add) on the left.
- When a trip is active, the Trips tab icon shows an orange dot badge.
- The Add button accent colour is updated from existing blue to the amber/coral gradient (`#ff6b35 → #ff9f00`).

### Trip List Page (`/trips`)

- Header row: "My Trips ✈️" + "+ New" button (opens slide-up sheet)
- **Active section** (shown only if activeTrip exists): glowing card — trip name, dates, spent/remaining, progress bar, expense count
- **Past section**: compact cards — name, dates, total spent, days, top-2 category tags, chevron

**New Trip Sheet** (slide-up bottom sheet):
- Fields: Trip Name (text), From (date), To (date), Budget (number, optional)
- Client validation: name non-empty, to >= from
- On submit: `POST /api/trips` → on success dismiss sheet, refresh list, `refreshActiveTrip()`

### Trip Detail Page (`/trips/[id]`)

- Back link to `/trips`
- Header: trip name, date range, Active/Closed badge
- **Budget ring**: SVG donut (viewBox 70×70), shows `(total_spent / budget) * 100`%. If no budget set, ring is hidden and only raw totals are shown.
- **Stats beside ring**: Total Spent, Budget Left (or "No budget set"), Per Day Avg (`total_spent / days_elapsed`, minimum 1)
- **Category bento grid** (2×2): top 4 categories by total amount, each shows emoji, category name, total, expense count, mini progress bar relative to the largest category
- **Day-by-day timeline**: `transactions` grouped by `date` DESC, each entry shows emoji (from category), description, category label, amount
- **AIInputBar** is the global one — on this page, the active trip is already set so expenses auto-tag

### Dashboard Integration

- Active trip banner shown when `activeTrip !== null`
- Banner shows: emoji + name, "Day X of Y", amount spent, budget
- Tapping navigates to `/trips/[activeTrip.id]`

---

## Feature: PWA

### `public/manifest.json`

```json
{
  "name": "Expense Tracker",
  "short_name": "Expenses",
  "display": "standalone",
  "background_color": "#0a0a0f",
  "theme_color": "#ff6b35",
  "start_url": "/dashboard",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Icons

Generate `icon-192.png` and `icon-512.png` using a simple Node script at build time from the existing `public/next.svg`, or create them manually as solid `#ff6b35` background with a "₹" symbol. Place in `public/`.

### `public/sw.js` — Service Worker

```javascript
// Pre-cache at install
const STATIC_CACHE = 'expenses-v1'
const STATIC_ASSETS = ['/', '/dashboard', '/offline', '/manifest.json']

// Cache-first for static assets, network-first for API
// Offline fallback: serve /offline for navigation requests when network fails
```

- Create `/app/offline/page.tsx` — simple page: "You're offline. Your data will sync when connected."
- For API calls when offline: return `{ error: 'offline', offline: true }` from SW so UI can show a toast. UI components that call API routes should check `response.offline === true` and show a "You are offline" toast rather than a generic error message.
- Geist font (loaded from CDN in current `layout.tsx`): swap to `next/font/google` with `display: 'swap'` so it loads locally and is available offline

### Registration

In `src/app/layout.tsx`, add a `<script>` tag (or a `useEffect` in a client component) to register the service worker:

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

### Metadata in `layout.tsx`

Add using the Next.js Metadata API (check local docs for exact syntax):
- `<link rel="manifest" href="/manifest.json">`
- `<meta name="theme-color" content="#ff6b35">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`

---

## UI Design

- **Color accent**: amber/coral gradient `#ff6b35 → #ff9f00`
- **Dark base**: `#0a0a0f` background, `#111118` cards
- **Card style**: `rgba(255,255,255,0.04)` background, `1px solid rgba(255,255,255,0.07)` border, `border-radius: 18px`
- **Bento grid**: 2-column, 10px gap
- **Zero CSS animations**: no `transition`, no `@keyframes` — everything instant
- **Typography**: system font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`), weight 800 for values, 600 for labels, 400 for secondary

---

## Out of Scope

- Multi-currency support
- Trip sharing / split expenses
- Push notifications
- App Store / Capacitor packaging
- External AI API integration
- Adding `user_id` to trips (no auth in this version — known gap, trips are global)

---

## Success Criteria

- User can create a trip with name + start/end date in under 10 seconds
- Typing `food 120` logs a ₹120 Food expense in under 2 taps
- Speaking "auto to beach 80" logs a ₹80 Transport expense
- All trip expenses are visible grouped by day and category on the trip detail page
- App installs on iOS via "Add to Home Screen" and runs full-screen
- All features work with zero paid API calls
- `end_date < start_date` is rejected both client-side and at DB level
