alter table transactions
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval text
    check (recurrence_interval in ('weekly', 'monthly') or recurrence_interval is null);

create index if not exists transactions_recurring_idx
  on transactions (is_recurring) where is_recurring = true;
