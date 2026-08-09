/**
 * @fileType hook
 * @domain lessons
 * @ai-summary Thin wrapper around `window.speechSynthesis`. Zero token cost —
 *             deliberately uses the browser voice so the chat lesson can narrate
 *             every teacher line without a Gemini/OpenAI TTS call.
 *
 *             Voice selection ranks Hebrew voices so we prefer the
 *             higher-quality cloud voices Chrome/Edge desktop expose
 *             (Google/Microsoft neural voices sound near-human) over the
 *             stock OS voice, which is what browsers pick by default and
 *             what students were describing as "robotic". Falls back through
 *             known-good named voices, then any cloud Hebrew voice, then
 *             any Hebrew voice at all. Level 1 (cloud-hosted TTS via
 *             Google Cloud / Azure free tier) is a follow-up if this
 *             ranking alone isn't enough.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const HEBREW_LANG_PREFIX = 'he'

/**
 * Named-voice preference list, roughly ranked by empirical quality on
 * the platforms that expose them.
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
 * Matching is case-insensitive substring on `voice.name` — voice names
 * vary slightly across platforms and language settings (e.g. "Google עברית"
 * vs "Google Hebrew" vs "Google Hebrew (Israel)"), so partial match is more
 * robust than equality.
 */
const PREFERRED_VOICE_NAMES: readonly string[] = [
  // Highest quality first
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

/**
 * Score a Hebrew voice by empirical quality. Higher = better.
 * Combined signal from the preferred-name list + `localService` (network
 * voices are usually the cloud-neural ones).
 */
function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0
  const nameIdx = PREFERRED_VOICE_NAMES.findIndex((preferred) =>
    v.name.toLowerCase().includes(preferred.toLowerCase()),
  )
  if (nameIdx !== -1) {
    // Earlier in the preferred list = better score. Base +100, minus rank.
    score += 100 - nameIdx
  }
  // Network voices are usually the cloud-neural ones (Google/Microsoft).
  // localService=true is the local OS voice which tends to sound robotic.
  if (v.localService === false) score += 50
  return score
}

function pickHebrewVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const hebrewVoices = voices.filter(isHebrewVoice)
  if (hebrewVoices.length === 0) return undefined
  // Stable sort: keep original order among equal scores so the first
  // matching Hebrew voice still wins the tiebreak.
  return hebrewVoices
    .map((v, i) => ({ v, i, s: scoreVoice(v) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)[0]?.v
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

      // Defensive re-pick: on Chrome desktop the first paint of the page
      // sees an empty voices list, so voiceRef may be undefined on the very
      // first speak call even though voices are now available. Cheap to
      // retry here rather than relying only on the onvoiceschanged handler.
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
