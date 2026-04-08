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

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  food:          { bg: 'bg-orange-500/15',  text: 'text-orange-400',  bar: 'bg-gradient-to-r from-orange-500 to-orange-400' },
  transport:     { bg: 'bg-blue-500/15',    text: 'text-blue-400',    bar: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  rent:          { bg: 'bg-purple-500/15',  text: 'text-purple-400',  bar: 'bg-gradient-to-r from-purple-500 to-purple-400' },
  utilities:     { bg: 'bg-amber-500/15',   text: 'text-amber-400',   bar: 'bg-gradient-to-r from-amber-500 to-amber-400' },
  health:        { bg: 'bg-red-500/15',     text: 'text-red-400',     bar: 'bg-gradient-to-r from-red-500 to-red-400' },
  shopping:      { bg: 'bg-pink-500/15',    text: 'text-pink-400',    bar: 'bg-gradient-to-r from-pink-500 to-pink-400' },
  entertainment: { bg: 'bg-violet-500/15',  text: 'text-violet-400',  bar: 'bg-gradient-to-r from-violet-500 to-violet-400' },
  other_expense: { bg: 'bg-slate-500/15',   text: 'text-slate-400',   bar: 'bg-gradient-to-r from-slate-500 to-slate-400' },
  salary:        { bg: 'bg-emerald-500/15', text: 'text-emerald-400', bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400' },
  freelance:     { bg: 'bg-teal-500/15',    text: 'text-teal-400',    bar: 'bg-gradient-to-r from-teal-500 to-teal-400' },
  investment:    { bg: 'bg-green-500/15',   text: 'text-green-400',   bar: 'bg-gradient-to-r from-green-500 to-green-400' },
  other_income:  { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    bar: 'bg-gradient-to-r from-cyan-500 to-cyan-400' },
}
