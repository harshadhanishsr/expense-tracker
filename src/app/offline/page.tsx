export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#0a0a0f]">
      <div className="text-5xl">📡</div>
      <h1 className="text-xl font-bold text-white">You&apos;re offline</h1>
      <p className="text-slate-400 text-sm">Your data will sync when you reconnect.</p>
    </div>
  )
}
