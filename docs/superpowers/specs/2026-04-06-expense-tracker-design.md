# Expense Tracker — Design Spec
**Date:** 2026-04-06

## Overview
A personal expense and income tracker accessible from any device via a public URL. Protected by a 4-digit PIN. Zero cost to run.

## Goals
- Track income and expenses with categories and notes
- View monthly summaries with spending breakdowns
- Search and filter transaction history
- Access from any device via a single link
- Store all data persistently

## Non-Goals
- Multi-user / sharing
- Budgeting / goal-setting (future scope)
- Mobile app / PWA (responsive web is sufficient)
- Recurring transactions automation
- Edit transaction (delete + re-add is the correction flow)

---

## Stack (all free tier)
| Layer | Technology |
|-------|------------|
| Frontend + API | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL, free tier) |
| Hosting | Vercel (free tier) |
| Auth | 4-digit PIN → bcrypt hash → signed cookie |

---

## Data Model

### `settings` table
| Column | Type | Notes |
|--------|------|-------|
| id | int (PK) | always 1 (single-row config) |
| pin_hash | text | bcrypt hash of the 4-digit PIN |
| created_at | timestamptz | auto |

### `transactions` table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | auto |
| type | text | `income` or `expense` |
| amount | numeric(12,2) | positive value |
| category | text | see categories list |
| description | text | optional note |
| date | date | user-selected, defaults to today |
| created_at | timestamptz | auto |

### Categories
**Expense:** Food, Transport, Rent, Utilities, Health, Shopping, Entertainment, Other
**Income:** Salary, Freelance, Investment, Other

---

## Application Structure

```
src/
  app/
    page.tsx              # PIN lock screen (/)
    dashboard/
      page.tsx            # Dashboard (/dashboard)
    add/
      page.tsx            # Add transaction (/add)
    history/
      page.tsx            # Transaction history (/history)
    api/
      auth/route.ts       # POST /api/auth — verify PIN, set cookie
      transactions/
        route.ts          # GET (list), POST (create)
        [id]/route.ts     # DELETE
  lib/
    supabase.ts           # Supabase server client
    auth.ts               # Cookie session helpers
  components/
    BottomNav.tsx
    SummaryCards.tsx
    CategoryBar.tsx
    TransactionList.tsx
    TransactionForm.tsx
    PinInput.tsx
```

---

## Pages

### `/` — PIN Lock
- Numpad UI (0–9 + backspace)
- 4 dot indicators showing progress
- On complete: POST /api/auth → if valid, set `session` cookie (httpOnly, sameSite=strict) → redirect to /dashboard
- Cookie expires when browser closes (no persistent login)

### `/dashboard`
- Monthly navigation (← April 2026 →)
- Three summary cards: Income (green), Expenses (red), Balance (blue)
- Top spending category bars (progress bars, top 5 categories)
- Recent transactions (last 5 rows)
- Bottom nav: Dashboard | + (FAB) | History

### `/add`
- Income / Expense toggle at top
- Large amount input (tap to type)
- Category grid (emoji + label chips)
- Date picker (defaults today)
- Note field (optional)
- Submit button
- On success: redirect to /dashboard

### `/history`
- Search bar (searches description + category)
- Month filter dropdown
- Type filter: All / Income / Expense
- Transaction list grouped by date
- Swipe-to-delete (or trash icon) with confirmation
- Pagination (20 per page)

---

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth | — | Verify PIN, issue session cookie |
| DELETE | /api/auth | cookie | Clear session (logout) |
| GET | /api/transactions | cookie | List transactions (month, type, search params) |
| POST | /api/transactions | cookie | Create transaction |
| DELETE | /api/transactions/[id] | cookie | Delete transaction |

All non-auth API routes check the session cookie and return 401 if missing/invalid.

---

## Auth Flow
1. User visits any protected page → middleware checks `session` cookie → redirects to `/` if absent
2. User enters PIN → POST /api/auth → server fetches `pin_hash` from Supabase → bcrypt.compare → if match, sign cookie with `SESSION_SECRET` env var → set as httpOnly cookie
3. All subsequent requests carry the cookie automatically

**Cookie content:** On successful PIN verification, server generates a random session ID (UUID), stores it in memory/cache (or in Supabase `sessions` table), and signs it with `SESSION_SECRET` using `iron-session` or similar. The PIN itself is never placed in the cookie.

**First-time setup:** If `settings` table has no row, `/` shows a "Set PIN" flow instead of "Enter PIN".

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=        # safe to expose (just the project URL)
SUPABASE_ANON_KEY=               # server-side only, no NEXT_PUBLIC_ prefix
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, for bypassing RLS
SESSION_SECRET=                  # random 32+ char string for cookie signing
```

Note: `NEXT_PUBLIC_` prefix is used for the URL but the actual DB calls happen server-side only, so the anon key's RLS policies will enforce security.

---

## Supabase RLS Policy
- All tables: deny all by default
- API routes use `service_role_key` (server-side only) → bypasses RLS safely
- No direct browser-to-Supabase calls

---

## Deployment Checklist
1. Create Supabase project → run SQL migrations → copy credentials
2. Push code to GitHub
3. Import repo in Vercel → add env vars → deploy
4. Visit the Vercel URL → set your PIN on first launch

---

## Currency
Indian Rupees (₹) — hardcoded in display, amounts stored as plain numerics.
