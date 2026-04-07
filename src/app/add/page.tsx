// src/app/add/page.tsx
import TransactionForm from '@/components/TransactionForm'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function AddPage() {
  return (
    <main className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-12 pb-6 rounded-b-3xl shadow-xl">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/dashboard" className="text-blue-200 hover:text-white text-xl">‹</Link>
          <h1 className="text-white text-lg font-semibold">Add Transaction</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-4">
        <TransactionForm />
      </div>
      <BottomNav />
    </main>
  )
}
