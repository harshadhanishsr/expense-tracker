'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTripContext } from '@/lib/tripContext'

const NAV = [
  { href: '/dashboard', icon: '⊞', label: 'Home' },
  { href: '/add',       icon: null, label: 'Add' },
  { href: '/trips',     icon: '✈️',  label: 'Trips' },
  { href: '/history',   icon: '≡',  label: 'History' },
  { href: '/insights',  icon: '◈',  label: 'Insights' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { activeTrip } = useTripContext()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-lg mx-auto px-4 pb-safe pb-3">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 rounded-2xl
          flex items-center justify-around px-2 h-16 shadow-2xl shadow-black/40">
          {NAV.map(item => {
            if (item.href === '/add') {
              return (
                <Link key={item.href} href="/add" className="flex flex-col items-center -mt-6">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-3xl
                    font-light shadow-xl border-4 border-slate-950
                    bg-gradient-to-br from-[#ff6b35] to-[#ff9f00] shadow-orange-500/40">
                    +
                  </div>
                </Link>
              )
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const isTrips = item.href === '/trips'
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl relative
                  ${isActive ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <span className="text-xl">{item.icon}</span>
                {isTrips && activeTrip && (
                  <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-orange-500" />
                )}
                <span className="text-[9px] font-semibold tracking-wide">{item.label}</span>
                {isActive && <span className="w-1 h-1 rounded-full bg-orange-400 -mt-0.5" />}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
