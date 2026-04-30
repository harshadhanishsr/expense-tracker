// src/components/VoiceInput.tsx
'use client'
import { useRef, useState, useEffect } from 'react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  onError?: (msg: string) => void
}

export default function VoiceInput({ onTranscript, onError }: VoiceInputProps) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SpeechRec)
  }, [])

  if (!supported) return null  // same on server + client initial render

  function startListening() {
    if (listening) return
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SpeechRec()
    rec.lang = 'en-IN'
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = (e: any) => {
      setListening(false)
      if (e.error === 'not-allowed') onError?.('Mic permission needed')
    }
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      onTranscript(transcript)
    }

    recRef.current = rec
    rec.start()
  }

  return (
    <button
      onClick={startListening}
      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg
        bg-gradient-to-br from-[#6366f1] to-[#a78bfa] shadow-lg shadow-indigo-500/30
        ${listening ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900' : ''}`}
      aria-label={listening ? 'Listening…' : 'Tap to speak'}
      title={listening ? 'Listening…' : 'Tap to speak'}
    >
      🎙️
    </button>
  )
}
