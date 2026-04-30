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
    <nav className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-lg mx-auto px-3 pb-2">
        <div className="glass flex items-center justify-around rounded-2xl shadow-2xl shadow-black/70"
          style={{ height: 62 }}>
          {NAV.map(item => {
            if (item.href === '/add') {
              return (
                <Link key={item.href} href="/add"
                  className="flex flex-col items-center -mt-6">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-3xl font-light"
                    style={{
                      background: 'linear-gradient(135deg,#0d9488,#34d399)',
                      boxShadow: '0 4px 24px rgba(13,148,136,0.55), 0 0 0 3px #020d0a',
                    }}>
                    +
                  </div>
                </Link>
              )
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const isTrips  = item.href === '/trips'
            return (
              <Link key={item.href} href={item.href}
                className="relative flex flex-col items-center gap-1 rounded-xl transition-all duration-200"
                style={{ minWidth: 54, padding: '8px 4px' }}>
                {isActive && (
                  <span className="absolute inset-0 rounded-xl"
                    style={{ background: 'rgba(13,148,136,0.14)', border: '1px solid rgba(45,212,191,0.22)' }} />
                )}
                <span className="relative text-2xl leading-none transition-all duration-200"
                  style={{ color: isActive ? '#2dd4bf' : 'rgba(255,255,255,0.28)' }}>
                  {item.icon}
                </span>
                {isTrips && activeTrip && (
                  <span className="absolute top-1 right-3 w-2 h-2 rounded-full"
                    style={{ background: '#2dd4bf', boxShadow: '0 0 6px rgba(45,212,191,0.8)' }} />
                )}
                <span className="relative text-[10px] font-semibold tracking-wide transition-all duration-200"
                  style={{ color: isActive ? '#2dd4bf' : 'rgba(255,255,255,0.25)' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
