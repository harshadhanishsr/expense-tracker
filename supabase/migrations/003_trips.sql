-- supabase/migrations/003_trips.sql

-- 1. New trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

-- 2. Add trip_id FK to transactions
ALTER TABLE transactions
  ADD COLUMN trip_id UUID REFERENCES trips(id) ON DELETE SET NULL;

CREATE INDEX ON transactions(trip_id);
