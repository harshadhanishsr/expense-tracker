'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PinInput from '@/components/PinInput'

export default function PinPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isSetup, setIsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupPin, setSetupPin] = useState('')

  useEffect(() => {
    fetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ pin: '0000' }),
      headers: { 'Content-Type': 'application/json' }
    }).then(r => {
      if (r.status === 404) setIsSetup(true)
      setLoading(false)
    })
  }, [])

  async function handlePin(pin: string) {
    setError('')
    if (isSetup) {
      if (!setupPin) { setSetupPin(pin); return }
      if (pin !== setupPin) { setError('PINs do not match, try again'); setSetupPin(''); return }
      const res = await fetch('/api/auth/setup', {
        method: 'POST', body: JSON.stringify({ pin }), headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ pin }), headers: { 'Content-Type': 'application/json' } })
        router.push('/dashboard')
      }
      return
    }
    const res = await fetch('/api/auth', {
      method: 'POST', body: JSON.stringify({ pin }), headers: { 'Content-Type': 'application/json' }
    })
    if (res.ok) router.push('/dashboard')
    else setError('Incorrect PIN')
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400">Loading...</div>
    </main>
  )

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <p className="text-slate-400 text-sm tracking-widest uppercase mb-2">Expense Tracker</p>
        <h1 className="text-white text-2xl font-bold">
          {isSetup ? (setupPin ? 'Confirm PIN' : 'Set your PIN') : 'Enter PIN'}
        </h1>
        {isSetup && !setupPin && <p className="text-slate-400 text-sm mt-2">You&apos;ll enter it twice to confirm</p>}
      </div>
      <PinInput onComplete={handlePin} error={error} />
    </main>
  )
}
