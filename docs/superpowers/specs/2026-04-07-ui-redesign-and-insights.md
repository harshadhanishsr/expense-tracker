# Expense Tracker — UI Redesign & Insights Upgrade
**Date:** 2026-04-07

## Overview

Five upgrades built simultaneously:
1. Complete dark-theme UI redesign (all pages)
2. New `/daily` page — transactions grouped by calendar day with category grid
3. New `/insights` page — week/month/year analytics with bar charts and comparisons
4. Smart autocomplete on Add Transaction (suggestions from past entries)
5. Recurring transaction support (DB column, form toggle, dashboard widget)

All existing API routes, session flow, and tests must continue to pass.

---

## Architecture Changes

### New Pages
| Route | File | Type |
|-------|------|------|
| `/daily` | `src/app/daily/page.tsx` | Server Component |
| `/insights` | `src/app/insights/page.tsx` | Server Component |

### New API Routes
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/transactions/suggestions?q=` | Autocomplete from past transactions |
| GET | `/api/transactions/recurring` | List all recurring transactions |

### Middleware Update
Add `/daily` and `/insights` to `PROTECTED` array and `config.matcher`.

### DB Migration — `supabase/migrations/002_recurring.sql`
```sql
alter table transactions
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval text
    check (recurrence_interval in ('weekly', 'monthly') or recurrence_interval is null);

create index if not exists transactions_recurring_idx
  on transactions (is_recurring) where is_recurring = true;
```

---

## Design System — Dark Theme

| Role | Class |
|------|-------|
| Page background | `bg-slate-900` |
| Card background | `bg-slate-800` |
| Card border | `border border-slate-700` |
| Primary text | `text-white` |
| Secondary text | `text-slate-400` |
| Input background | `bg-slate-700` |
| Dividers | `divide-slate-700` |

Dashboard header: `bg-gradient-to-br from-blue-600 to-indigo-700 rounded-b-3xl` containing month nav + all 3 summary numbers (balance, income, spent + today's spend).

Bottom nav: 5 items — Home | Daily | + (FAB) | Insights | History.

---

## New Files

```
src/app/daily/page.tsx                         # Day-grouped transaction view
src/app/insights/page.tsx                      # Analytics with period toggle
src/app/api/transactions/suggestions/route.ts  # Autocomplete endpoint
src/app/api/transactions/recurring/route.ts    # Recurring list endpoint
src/components/DayGroup.tsx                    # Day header + category grid
src/components/CategoryDayGrid.tsx             # 4-col category tile grid
src/components/InsightsPeriodToggle.tsx        # Week/Month/Year toggle (client)
src/components/BarChart.tsx                    # Pure Tailwind bar chart (client)
src/components/InsightCategoryCard.tsx         # Most/Least spent card
src/components/RecurringSection.tsx            # Recurring widget for dashboard
src/components/SuggestionDropdown.tsx          # Autocomplete dropdown (client)
src/hooks/useDescriptionSuggestions.ts         # Debounced fetch hook
src/lib/types.ts                               # Shared Transaction + Suggestion types
supabase/migrations/002_recurring.sql          # DB migration
```

## Modified Files

```
src/middleware.ts                   # Add /daily, /insights
src/app/dashboard/page.tsx          # Dark theme + gradient header + RecurringSection
src/app/add/page.tsx                # Dark theme
src/app/history/page.tsx            # Dark theme
src/app/api/transactions/route.ts   # POST: accept is_recurring + recurrence_interval
src/components/BottomNav.tsx        # 5 items (add Daily + Insights)
src/components/SummaryCards.tsx     # Dark theme
src/components/CategoryBars.tsx     # Dark theme
src/components/TransactionList.tsx  # Dark theme
src/components/TransactionForm.tsx  # Dark theme + autocomplete + recurring toggle
```

---

## Key Implementation Details

### Daily View (`/daily`)
- Fetch last 30 days from Supabase (server-side direct call)
- Group by `date` string in TypeScript
- Day labels: "Today", "Yesterday", "Apr 5"
- Each `DayGroup` renders `CategoryDayGrid` (all 8 expense categories, dimmed if ₹0) + income rows

### Insights (`/insights`)
- Reads `?period=week|month|year` from `searchParams` (default: `month`)
- Fetches 6 months of data in one query, aggregates in TypeScript (no extra Supabase queries)
- `BarChart`: pure `div` elements with `style={{ height: '..%' }}` — zero new dependencies
- `InsightsPeriodToggle`: client component, changes URL param → server re-renders with new data

### Smart Input
- `GET /api/transactions/suggestions?q=zom` → returns distinct past descriptions matching prefix
- `useDescriptionSuggestions` hook: 300ms debounce, clears when query < 2 chars
- Selecting a suggestion: fills description + category + amount
- Dropdown dismisses on blur (150ms delay to allow click)

### Recurring
- New state in `TransactionForm`: `isRecurring`, `recurrenceInterval`
- Toggle switch UI below the Note field
- POST validation: if `is_recurring=true`, `recurrence_interval` must be `weekly|monthly`
- Dashboard shows `<RecurringSection>` between CategoryBars and Recent

### Existing Tests
- `GET /api/transactions` mock chain unchanged — not modified
- `POST /api/transactions` mock chain: `from→insert→select→single` — structure unchanged, just adds optional fields to insert object, tests still pass

---

## Implementation Order
1. DB migration (`002_recurring.sql`) — run in Supabase SQL editor
2. `src/lib/types.ts` — shared types
3. New API routes (`suggestions`, `recurring`)
4. New hooks + components
5. Dark theme restyle all existing components + pages
6. `TransactionForm` — autocomplete + recurring toggle
7. New pages (`/daily`, `/insights`)
8. `BottomNav` — add Daily + Insights
9. `middleware.ts` — protect new routes
