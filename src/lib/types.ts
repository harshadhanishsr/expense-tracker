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
  recurrence_interval: 'weekly' | 'monthly' | null
}

export interface Suggestion {
  description: string
  category: string
  amount: number
}
