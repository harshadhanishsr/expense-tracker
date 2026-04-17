// src/lib/types.ts

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
  trip_id?: string | null   // nullable FK to trips.id
}

export interface Suggestion {
  description: string
  category: string
  amount: number
}

export interface Trip {
  id: string
  name: string
  start_date: string      // ISO date YYYY-MM-DD
  end_date: string        // ISO date YYYY-MM-DD
  budget: number | null
  created_at: string
  // Computed fields (returned by API)
  total_spent: number
  expense_count: number
  days_elapsed: number    // days since start_date, capped at total_days
  total_days: number      // end_date - start_date + 1
}

export interface TripWithTransactions extends Trip {
  transactions: Transaction[]
}

export interface ParseResult {
  amount: number
  category: string        // valid category ID from CATEGORIES
  description: string
  type: 'expense' | 'income'
  confidence: 'high' | 'low'
}

export interface Insight {
  type: 'recurring' | 'spike' | 'digest'
  title: string
  body: string
  action?: {
    label: string
    prefill: { category: string; amount: number; description: string; type: 'expense' | 'income' }
  }
  dismissKey: string
}
