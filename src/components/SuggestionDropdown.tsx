// src/components/SuggestionDropdown.tsx
'use client'
import { getCategoryById } from '@/lib/categories'
import type { Suggestion } from '@/lib/types'

interface Props {
  suggestions: Suggestion[]
  onSelect: (s: Suggestion) => void
  visible: boolean
}

export default function SuggestionDropdown({ suggestions, onSelect, visible }: Props) {
  if (!visible || suggestions.length === 0) return null

  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-700 border border-slate-600 rounded-xl overflow-hidden z-10 shadow-xl">
      {suggestions.map((s, i) => {
        const cat = getCategoryById(s.category)
        return (
          <button
            key={i}
            type="button"
            onMouseDown={() => onSelect(s)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-600 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">{cat?.emoji ?? '📦'}</span>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{s.description}</p>
                <p className="text-slate-400 text-xs">{cat?.label ?? s.category}</p>
              </div>
            </div>
            <span className="text-slate-300 text-sm font-semibold ml-3 shrink-0">
              ₹{s.amount.toLocaleString('en-IN')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
