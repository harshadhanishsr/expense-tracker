'use client'
import { useState } from 'react'

interface Props {
  onComplete: (pin: string) => void
  error?: string
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export default function PinInput({ onComplete, error }: Props) {
  const [digits, setDigits] = useState<string[]>([])

  function handleKey(key: string) {
    if (key === '⌫') { setDigits(d => d.slice(0, -1)); return }
    if (key === '' || digits.length >= 4) return
    const next = [...digits, key]
    setDigits(next)
    if (next.length === 4) { onComplete(next.join('')); setDigits([]) }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-4">
        {[0,1,2,3].map(i => (
          <div key={i} data-testid="pin-dot"
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              digits.length > i ? 'bg-blue-500 border-blue-500' : 'border-slate-500 bg-transparent'
            }`}
          />
        ))}
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) => (
          <button key={i} onClick={() => handleKey(key)} disabled={key === ''}
            className={`w-14 h-14 rounded-xl text-lg font-semibold transition-colors ${
              key === '' ? 'invisible' :
              key === '⌫' ? 'bg-red-600 text-white hover:bg-red-700' :
              'bg-slate-700 text-white hover:bg-slate-600 active:bg-slate-500'
            }`}
          >{key}</button>
        ))}
      </div>
    </div>
  )
}
