'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex items-center justify-around px-6 pb-4">
      <Link href="/dashboard" className={`flex flex-col items-center py-3 gap-1 text-xs transition-colors ${pathname === '/dashboard' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}>
        <span className="text-xl">🏠</span>Dashboard
      </Link>
      <Link href="/add" className="flex flex-col items-center -mt-5">
        <div className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white text-3xl shadow-lg">+</div>
      </Link>
      <Link href="/history" className={`flex flex-col items-center py-3 gap-1 text-xs transition-colors ${pathname === '/history' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}>
        <span className="text-xl">📋</span>History
      </Link>
    </nav>
  )
}
