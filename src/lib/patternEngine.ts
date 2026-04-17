// src/lib/patternEngine.ts
import type { Insight, Transaction } from './types'

function isoWeek(today: Date): string {
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const w = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`
}

export function detectInsights(transactions: Transaction[], today: Date): Insight[] {
  const week = isoWeek(today)
  const results: Insight[] = []

  // Pattern 1: Recurring behaviour — same weekday + category ≥ 3 times in last 28 days
  const cutoff28 = new Date(today)
  cutoff28.setDate(cutoff28.getDate() - 28)
  const recent = transactions.filter(t => new Date(t.date) >= cutoff28 && t.type === 'expense')

  const groups = new Map<string, Transaction[]>()
  for (const t of recent) {
    const day = new Date(t.date).getDay()
    const key = `${day}-${t.category}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  for (const [key, txns] of groups) {
    if (txns.length >= 3) {
      const [wdStr, category] = key.split('-')
      const wd = Number(wdStr)
      // Only surface on the matching weekday
      if (today.getDay() !== wd) continue
      const avg = Math.round(txns.reduce((s, t) => s + Number(t.amount), 0) / txns.length)
      const descCounts = new Map<string, number>()
      for (const t of txns) {
        const d = t.description ?? ''
        if (d) descCounts.set(d, (descCounts.get(d) ?? 0) + 1)
      }
      const desc = [...descCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? category
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      results.push({
        type: 'recurring',
        title: 'Recurring spend',
        body: `Nee ${dayNames[wd]}-la ${category} usual — today panniyacha? 🔄`,
        action: { label: 'Log it', prefill: { category, amount: avg, description: desc, type: 'expense' } },
        dismissKey: `recurring-${category}-${wd}-${week}`,
      })
    }
  }

  // Pattern 2: Spending spike — current week vs 4-week rolling average
  const monOffset = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - monOffset)
  monday.setHours(0, 0, 0, 0)
  const cutoff4w = new Date(monday)
  cutoff4w.setDate(cutoff4w.getDate() - 28)

  const thisWeekTxns = transactions.filter(
    t => new Date(t.date) >= monday && t.type === 'expense'
  )
  const prev4wTxns = transactions.filter(t => {
    const d = new Date(t.date)
    return d >= cutoff4w && d < monday && t.type === 'expense'
  })

  const catSpendThis = new Map<string, number>()
  for (const t of thisWeekTxns) catSpendThis.set(t.category, (catSpendThis.get(t.category) ?? 0) + Number(t.amount))
  const catSpendPrev = new Map<string, number>()
  for (const t of prev4wTxns) catSpendPrev.set(t.category, (catSpendPrev.get(t.category) ?? 0) + Number(t.amount))

  let biggestSpikeRatio = 1.8
  let spikeCategory = ''
  let spikeCurrent = 0
  for (const [cat, cur] of catSpendThis) {
    const avg4w = (catSpendPrev.get(cat) ?? 0) / 4
    if (avg4w > 0 && cur / avg4w > biggestSpikeRatio) {
      biggestSpikeRatio = cur / avg4w
      spikeCategory = cat
      spikeCurrent = cur
    }
  }
  if (spikeCategory) {
    results.push({
      type: 'spike',
      title: 'Spending spike',
      body: `${spikeCategory}-ku இந்த வாரம் ₹${spikeCurrent.toLocaleString('en-IN')} — usual-a vida ${biggestSpikeRatio.toFixed(1)}x aagidhu 📈`,
      dismissKey: `spike-${spikeCategory}-${week}`,
    })
  }

  // Pattern 3: Weekly digest — fires on Mondays only
  if (today.getDay() === 1) {
    results.push({
      type: 'digest',
      title: 'Weekly digest',
      body: '', // AIInsightCard fetches body from /api/ai/digest
      dismissKey: `digest-${week}`,
    })
  }

  // Priority: recurring > spike > digest; max 3
  return results.slice(0, 3)
}
