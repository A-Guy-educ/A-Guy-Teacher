/**
 * Heuristic for "is this chat message a question?".
 *
 * Mirrors the rules in the external dashboard spec: trailing `?`, or a
 * Hebrew question opener (מה, איך, למה, מדוע, מי, איזה, איפה, מתי, כמה,
 * האם, ?...).
 *
 * Exposed as a standalone function so unit tests can exercise the rule
 * directly without standing up the whole chat hook.
 */
export function looksLikeQuestion(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false
  if (/\?+\s*$/.test(trimmed)) return true

  const hebrewQuestionPrefixes = [
    'מה',
    'איך',
    'למה',
    'מדוע',
    'מי',
    'איזה',
    'איפה',
    'היכן',
    'מתי',
    'כמה',
    'האם',
    'האין',
    'כיצד',
    'למי',
  ]
  const lower = trimmed.toLowerCase()
  return hebrewQuestionPrefixes.some((prefix) => lower.startsWith(`${prefix} `))
}
