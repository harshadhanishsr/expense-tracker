// src/components/BottomNav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  const active = (path: string) =>
    pathname === path ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 pb-safe h-16 z-50">
      <Link href="/dashboard" className={`flex flex-col items-center gap-0.5 text-[10px] py-2 px-3 transition-colors ${active('/dashboard')}`}>
        <span className="text-xl">🏠</span>Home
      </Link>
      <Link href="/daily" className={`flex flex-col items-center gap-0.5 text-[10px] py-2 px-3 transition-colors ${active('/daily')}`}>
        <span className="text-xl">📅</span>Daily
      </Link>
      <Link href="/add" className="flex flex-col items-center -mt-5">
        <div className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 flex items-center justify-center text-white text-3xl shadow-lg shadow-blue-500/30 transition-colors">+</div>
      </Link>
      <Link href="/insights" className={`flex flex-col items-center gap-0.5 text-[10px] py-2 px-3 transition-colors ${active('/insights')}`}>
        <span className="text-xl">📊</span>Insights
      </Link>
      <Link href="/history" className={`flex flex-col items-center gap-0.5 text-[10px] py-2 px-3 transition-colors ${active('/history')}`}>
        <span className="text-xl">📋</span>History
      </Link>
    </nav>
  )
}
