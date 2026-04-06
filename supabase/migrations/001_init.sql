-- supabase/migrations/001_init.sql

-- Settings table (single-row: stores PIN hash)
create table if not exists settings (
  id int primary key default 1,
  pin_hash text not null,
  created_at timestamptz default now()
);

-- Enforce single row
create unique index if not exists settings_singleton on settings (id);

-- Transactions table
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  description text,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- Index for fast monthly queries
create index if not exists transactions_date_idx on transactions (date desc);

-- Deny all by default (API routes use service_role_key which bypasses RLS)
alter table settings enable row level security;
alter table transactions enable row level security;
