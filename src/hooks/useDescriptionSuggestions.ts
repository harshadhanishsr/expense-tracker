// src/hooks/useDescriptionSuggestions.ts
import { useState, useEffect } from 'react'
import type { Suggestion } from '@/lib/types'

export function useDescriptionSuggestions(query: string, enabled: boolean): Suggestion[] {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  useEffect(() => {
    if (!enabled || query.length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/transactions/suggestions?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const json = await res.json()
          setSuggestions(json.suggestions ?? [])
        }
      } catch {
        setSuggestions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, enabled])

  return suggestions
}
