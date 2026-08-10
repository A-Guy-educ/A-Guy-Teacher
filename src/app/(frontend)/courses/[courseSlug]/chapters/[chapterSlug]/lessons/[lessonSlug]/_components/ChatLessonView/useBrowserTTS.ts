/**
 * @fileType hook
 * @domain lessons
 * @ai-summary Hebrew TTS narration for chat lessons. Prefers our
 *             self-hosted Piper endpoint (open-source neural voice with
 *             Dicta Nakdan niqqud preprocessing — dramatically better
 *             than the stock OS voice), falls back to `window.speechSynthesis`
 *             when the endpoint is unreachable so lessons still narrate
 *             offline. Public API unchanged: `speak(text)`, `cancel()`,
 *             `toggleMuted()`, plus `supported`/`speaking`/`muted` state.
 *
 *             Piper endpoint: `a-guy-tts` repo, Vercel Python function,
 *             ~500 ms warm / ~3 s cold. Response is aggressively cached
 *             at Vercel's edge (24 h) on (text, voice), so repeat plays
 *             of the same bubble are instant.
 *
 *             Zero token cost — Piper + Dicta are both free and open.
 *             Deliberately NOT calling Gemini/OpenAI TTS.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const HEBREW_LANG_PREFIX = 'he'

// Our Piper TTS microservice (see `aguyshayb/tts` repo). Public, no auth,
// CORS-open — cross-origin fetch from the main app is expected.
const PIPER_ENDPOINT = 'https://aguy-text-to-speech-piper-aguy.vercel.app/api/tts'
const PIPER_VOICE = 'he_IL-saspeech-medium'
// If Piper doesn't return in this budget, fall back to browser TTS so the
// user isn't stuck waiting. Warm is ~500 ms; cold-start after idle can be
// 3-4 s; give some headroom past cold start.
const PIPER_TIMEOUT_MS = 6000

/**
 * Named-voice preference list for the browser fallback path, roughly
 * ranked by empirical quality on the platforms that expose them.
 *
 * - Google Chrome desktop ships "Google עברית" via Google's cloud voice
 *   backend — significantly more natural than any OS-installed Hebrew voice.
 * - Edge desktop / Windows expose the Microsoft neural voices "Asaf" (m) /
 *   "Hila" (f) via speechSynthesis, also cloud-hosted.
 * - iOS / macOS ship "Carmit" (m/f depending on version); the "Enhanced"
 *   / "Premium" variant is a downloadable high-quality voice — much better
 *   than the default. The user has to actually download it from Settings,
 *   which we can't force, but we prefer it when present.
 *
 * Matching is case-insensitive substring on `voice.name`.
 */
const PREFERRED_VOICE_NAMES: readonly string[] = [
  'Google עברית',
  'Google Hebrew',
  'Microsoft Asaf',
  'Microsoft Hila',
  'Microsoft Hebrew',
  'Carmit (Enhanced)',
  'Carmit (Premium)',
  'Carmit',
]

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

function isHebrewVoice(v: SpeechSynthesisVoice): boolean {
  return v.lang?.toLowerCase().startsWith(HEBREW_LANG_PREFIX) || /hebrew/i.test(v.name)
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0
  const nameIdx = PREFERRED_VOICE_NAMES.findIndex((preferred) =>
    v.name.toLowerCase().includes(preferred.toLowerCase()),
  )
  if (nameIdx !== -1) score += 100 - nameIdx
  if (v.localService === false) score += 50
  return score
}

function pickHebrewVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const hebrewVoices = voices.filter(isHebrewVoice)
  if (hebrewVoices.length === 0) return undefined
  return hebrewVoices
    .map((v, i) => ({ v, i, s: scoreVoice(v) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)[0]?.v
}

export function useBrowserTTS() {
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(false)
  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined)
  // Track the in-flight Piper request + audio element so `cancel()` and
  // subsequent `speak()` calls can tear them down cleanly. Playing a new
  // line while the previous is loading should silently supersede it.
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasBrowserTTSRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // We're "supported" as long as either engine works. The Piper engine
    // needs `fetch` (universal) + `Audio` (universal) — safe to assume
    // it's available in any browser we care about.
    setSupported(true)
    hasBrowserTTSRef.current = 'speechSynthesis' in window

    if (!hasBrowserTTSRef.current) return

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

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    stopAudio()
    if (hasBrowserTTSRef.current) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }, [stopAudio])

  const speakViaBrowser = useCallback((clean: string) => {
    if (!hasBrowserTTSRef.current) {
      setSpeaking(false)
      return
    }
    // Defensive re-pick: on Chrome desktop the first paint of the page
    // sees an empty voices list, so voiceRef may be undefined on the very
    // first speak call even though voices are now available.
    if (!voiceRef.current) {
      voiceRef.current = pickHebrewVoice(window.speechSynthesis.getVoices())
    }
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
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!supported || muted || !text) return
      const clean = stripForSpeech(text)
      if (!clean) return

      // Tear down anything from the previous line.
      cancel()

      const controller = new AbortController()
      abortRef.current = controller
      const timeoutId = window.setTimeout(() => controller.abort(), PIPER_TIMEOUT_MS)

      const url = `${PIPER_ENDPOINT}?voice=${PIPER_VOICE}&text=${encodeURIComponent(clean)}`
      setSpeaking(true)

      fetch(url, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`Piper HTTP ${r.status}`)
          return r.blob()
        })
        .then((blob) => {
          window.clearTimeout(timeoutId)
          // If a newer speak() has already replaced our controller, abort.
          if (abortRef.current !== controller) return
          const objectUrl = URL.createObjectURL(blob)
          const audio = new Audio(objectUrl)
          audioRef.current = audio
          audio.onended = () => {
            URL.revokeObjectURL(objectUrl)
            if (audioRef.current === audio) {
              audioRef.current = null
              setSpeaking(false)
            }
          }
          audio.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            if (audioRef.current === audio) {
              audioRef.current = null
              // Audio decode failed — fall back to browser voice so the
              // student still hears something.
              speakViaBrowser(clean)
            }
          }
          void audio.play().catch(() => {
            // Autoplay policy or other play() rejection — fall back.
            URL.revokeObjectURL(objectUrl)
            if (audioRef.current === audio) audioRef.current = null
            speakViaBrowser(clean)
          })
        })
        .catch((err) => {
          window.clearTimeout(timeoutId)
          // Superseded by a newer speak() — silently drop.
          if (abortRef.current !== controller) return
          abortRef.current = null
          if ((err as Error).name === 'AbortError') return
          // Piper unreachable / timed out — degrade to browser voice.
          speakViaBrowser(clean)
        })
    },
    [cancel, muted, speakViaBrowser, supported],
  )

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      if (next) cancel()
      return next
    })
  }, [cancel])

  return { supported, muted, speaking, speak, cancel, toggleMuted }
}
