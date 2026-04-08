# Expense Tracker

A personal income and expense tracker you can self-host for free. No accounts, no login — open the URL and start tracking.

**Tech stack:** Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase (PostgreSQL) · Vercel

---

## Features

- **Dashboard** — monthly balance, income vs spent, today's spend, top categories
- **Daily view** — spending broken down by category for each day
- **Insights** — week / month / year analytics with bar charts and comparisons
- **Smart autocomplete** — learns from past entries (description, category, amount)
- **Quick repeat** — hover any recent transaction and tap ↺ to re-add it instantly
- **Recurring transactions** — mark any transaction as weekly or monthly
- **Full history** — search, filter by type and month, swipe to delete
- Mobile-first, dark theme, works on any device

---

## Setup Guide

### 1. Clone the repo

```bash
git clone https://github.com/harshadhanishsr/expense-tracker.git
cd expense-tracker
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**
3. Once created, go to **Settings → API** and copy:
   - Project URL
   - Anon / publishable key
   - Service role / secret key

### 3. Run the database migrations

In your Supabase dashboard → **SQL Editor → New query**, run each file in order:

1. `supabase/migrations/001_init.sql` — creates the transactions table
2. `supabase/migrations/002_recurring.sql` — adds recurring transaction support

Click **Run** after each — you should see "Success. No rows returned."

### 4. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=your-32-char-random-secret
```

Generate a session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects straight to the dashboard.

---

## Deploy to Vercel (free)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Add the 4 environment variables in the Vercel dashboard under **Settings → Environment Variables**
4. Click **Deploy**

Your app will be live at a `*.vercel.app` URL.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Redirects to /dashboard
│   ├── dashboard/page.tsx        # Main dashboard
│   ├── add/page.tsx              # Add transaction
│   ├── history/page.tsx          # Transaction history
│   ├── daily/page.tsx            # Daily category breakdown
│   ├── insights/page.tsx         # Analytics & charts
│   └── api/transactions/
│       ├── route.ts              # GET (list), POST (create)
│       ├── [id]/route.ts         # DELETE
│       ├── suggestions/route.ts  # GET autocomplete suggestions
│       └── recurring/route.ts    # GET recurring transactions
├── components/
│   ├── BottomNav.tsx
│   ├── SummaryCards.tsx
│   ├── CategoryBars.tsx
│   ├── TransactionList.tsx
│   ├── TransactionForm.tsx
│   ├── DayGroup.tsx
│   ├── CategoryDayGrid.tsx
│   ├── BarChart.tsx
│   ├── InsightsPeriodToggle.tsx
│   ├── InsightCategoryCard.tsx
│   ├── RecurringSection.tsx
│   └── SuggestionDropdown.tsx
├── hooks/
│   └── useDescriptionSuggestions.ts
└── lib/
    ├── supabase.ts       # Supabase server client
    ├── session.ts        # Session config
    ├── categories.ts     # Category definitions + color map
    └── types.ts          # Shared TypeScript types
supabase/
├── migrations/
│   ├── 001_init.sql
│   └── 002_recurring.sql
```

---

## Running Tests

```bash
npx jest --no-coverage
```

---

## License

MIT — fork it, self-host it, make it yours.
