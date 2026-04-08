'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', icon: '⊞', label: 'Home' },
  { href: '/daily',     icon: '◫', label: 'Daily' },
  { href: '/add',       icon: null, label: 'Add' },
  { href: '/insights',  icon: '◈', label: 'Insights' },
  { href: '/history',   icon: '≡', label: 'History' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-lg mx-auto px-4 pb-safe pb-3">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl flex items-center justify-around px-2 h-16 shadow-2xl shadow-black/40">
          {NAV.map(item => {
            if (item.href === '/add') {
              return (
                <Link key={item.href} href="/add" className="flex flex-col items-center -mt-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-light shadow-xl shadow-blue-500/40 hover:shadow-blue-500/60 active:scale-95 transition-all duration-200 border-4 border-slate-950">
                    +
                  </div>
                </Link>
              )
            }
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200
                  ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>
                <span className={`text-[9px] font-semibold tracking-wide ${isActive ? 'text-blue-400' : ''}`}>
                  {item.label}
                </span>
                {isActive && <span className="w-1 h-1 rounded-full bg-blue-400 -mt-0.5" />}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
