# Expense Tracker

A personal income and expense tracker you can self-host for free. Protected by a 4-digit PIN, accessible from any device via a URL.

**Tech stack:** Next.js 14 · TypeScript · Tailwind CSS · Supabase (PostgreSQL) · iron-session · Vercel

---

## Features

- PIN-protected — no accounts, no passwords
- Add income and expenses with categories
- Dashboard with monthly summary, balance, and top spending breakdown
- Full transaction history with search, filter by type, and delete
- Works on mobile and desktop
- Data stored in your own Supabase database

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
2. Click **New Project** and give it a name
3. Once created, go to **Settings → API** and copy:
   - Project URL
   - `anon` / public key
   - `service_role` key

### 3. Run the database schema

1. In your Supabase dashboard, go to **SQL Editor → New query**
2. Paste the contents of `supabase/migrations/001_init.sql`
3. Click **Run** — you should see "Success. No rows returned."

### 4. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your values:

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

Open [http://localhost:3000](http://localhost:3000) — set your PIN and start tracking.

---

## Deploy to Vercel (free)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Add the same 4 environment variables from `.env.local` in the Vercel dashboard
4. Click **Deploy**

Your app will be live at a `*.vercel.app` URL.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # PIN lock / first-time setup
│   ├── dashboard/page.tsx    # Dashboard
│   ├── add/page.tsx          # Add transaction
│   ├── history/page.tsx      # Transaction history
│   └── api/
│       ├── auth/route.ts         # POST (verify PIN), DELETE (logout)
│       ├── auth/setup/route.ts   # POST (first-time PIN setup)
│       └── transactions/
│           ├── route.ts          # GET (list), POST (create)
│           └── [id]/route.ts     # DELETE (remove)
├── components/
│   ├── PinInput.tsx
│   ├── BottomNav.tsx
│   ├── SummaryCards.tsx
│   ├── CategoryBars.tsx
│   ├── TransactionList.tsx
│   └── TransactionForm.tsx
└── lib/
    ├── supabase.ts     # Supabase server client
    ├── session.ts      # iron-session config
    └── categories.ts   # Category definitions
```

---

## Running Tests

```bash
npx jest --no-coverage
```

19 tests covering auth API, transactions API, session config, and PinInput component.

---

## License

MIT — fork it, self-host it, make it yours.
