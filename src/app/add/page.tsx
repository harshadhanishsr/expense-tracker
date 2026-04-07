import TransactionForm from '@/components/TransactionForm'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

export default function AddPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-800 text-white px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/dashboard" className="text-slate-400 hover:text-white">‹</Link>
          <h1 className="text-lg font-semibold">Add Transaction</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-4">
        <TransactionForm />
      </div>
      <BottomNav />
    </main>
  )
}
