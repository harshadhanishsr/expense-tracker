// src/app/add/page.tsx
export const dynamic = 'force-dynamic'

import TransactionForm from '@/components/TransactionForm'
import Link from 'next/link'

export default function AddPage() {
  return (
    <main className="min-h-screen" style={{ background: '#020d0a', paddingBottom: 'calc(180px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="relative bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 px-4 pt-14 pb-6 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 blur-xl" />
        <div className="max-w-lg mx-auto relative flex items-center gap-3">
          <Link href="/dashboard"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-all active:scale-95 flex-shrink-0">
            ‹
          </Link>
          <div>
            <p className="text-teal-200 text-xs font-semibold uppercase tracking-widest">New Entry</p>
            <h1 className="text-white text-xl font-bold">Add Transaction</h1>
          </div>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-5">
        <TransactionForm />
      </div>
    </main>
  )
}
