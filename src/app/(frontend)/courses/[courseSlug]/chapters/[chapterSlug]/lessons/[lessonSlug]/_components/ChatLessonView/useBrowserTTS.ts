/**
 * @fileType hook
 * @domain lessons
 * @ai-summary Thin wrapper around `window.speechSynthesis`. Zero token cost —
 *             deliberately uses the browser voice so the chat lesson can narrate
 *             every teacher line without a Gemini/OpenAI TTS call. Swap in an AI
 *             voice later if the manager wants higher fidelity.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const HEBREW_LANG_PREFIX = 'he'

function stripForSpeech(text: string): string {
  return (
    text
      // KaTeX inline math delimiters
      .replace(/\$([^$]+)\$/g, '$1')
      .replace(/\$\$([^$]+)\$\$/g, '$1')
      // stray markdown
      .replace(/[*_`~#]/g, '')
      // HTML tags if any leaked in
      .replace(/<[^>]+>/g, '')
      .trim()
  )
}

function pickHebrewVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith(HEBREW_LANG_PREFIX)) ??
    voices.find((v) => /hebrew/i.test(v.name))
  )
}

export function useBrowserTTS() {
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(false)
  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    setSupported(true)

    const loadVoices = () => {
      voiceRef.current = pickHebrewVoice(window.speechSynthesis.getVoices())
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
      window.speechSynthesis.cancel()
    }
  }, [])

  const cancel = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!supported || muted || !text) return
      const clean = stripForSpeech(text)
      if (!clean) return

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.lang = 'he-IL'
      utterance.rate = 0.95
      utterance.pitch = 1.0
      if (voiceRef.current) utterance.voice = voiceRef.current
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)

      window.speechSynthesis.speak(utterance)
    },
    [muted, supported],
  )

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      if (next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        setSpeaking(false)
      }
      return next
    })
  }, [])

  return { supported, muted, speaking, speak, cancel, toggleMuted }
}
