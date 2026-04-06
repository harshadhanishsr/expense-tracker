// src/lib/categories.ts
export type TransactionType = 'income' | 'expense'

export interface Category {
  id: string
  label: string
  emoji: string
  type: TransactionType
}

export const CATEGORIES: Category[] = [
  // Expense categories
  { id: 'food',          label: 'Food',          emoji: '🍔', type: 'expense' },
  { id: 'transport',     label: 'Transport',     emoji: '🚗', type: 'expense' },
  { id: 'rent',          label: 'Rent',          emoji: '🏠', type: 'expense' },
  { id: 'utilities',     label: 'Utilities',     emoji: '⚡', type: 'expense' },
  { id: 'health',        label: 'Health',        emoji: '🏥', type: 'expense' },
  { id: 'shopping',      label: 'Shopping',      emoji: '🛍️', type: 'expense' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬', type: 'expense' },
  { id: 'other_expense', label: 'Other',         emoji: '📦', type: 'expense' },
  // Income categories
  { id: 'salary',        label: 'Salary',        emoji: '💰', type: 'income' },
  { id: 'freelance',     label: 'Freelance',     emoji: '💼', type: 'income' },
  { id: 'investment',    label: 'Investment',    emoji: '📈', type: 'income' },
  { id: 'other_income',  label: 'Other',         emoji: '💵', type: 'income' },
]

export function getCategoriesForType(type: TransactionType): Category[] {
  return CATEGORIES.filter(c => c.type === type)
}

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id)
}
