/**
 * @fileType data
 * @domain lessons
 * @ai-summary Stock of Hebrew "well done" lines for the Chat view to
 *             surface after a correct answer. Deliberately non-gendered
 *             (no מצוינת/מצוין split, no masculine or feminine verb forms)
 *             and professional in tone — no exclamation-heavy cheerleading.
 *             Pick one at random via `pickWellDone()` so the same lesson
 *             pass doesn't repeat the same line back-to-back.
 */

export const WELL_DONE_MESSAGES: readonly string[] = [
  'מדויק. אפשר להמשיך.',
  'תשובה נכונה. ממשיכים.',
  'עבודה טובה, זה בדיוק זה.',
  'נכון מאוד. הצלחת לפתור.',
  'מצוין, בואו נמשיך הלאה.',
  'זה הפתרון הנכון.',
  'תשובה מדויקת. בהמשך תהיה שאלה נוספת.',
  'יפה מאוד, זה בדיוק המהלך.',
  'הצלחת, ניגש לשאלה הבאה.',
  'התשובה תואמת את הפתרון המצופה.',
]

export function pickWellDone(): string {
  const idx = Math.floor(Math.random() * WELL_DONE_MESSAGES.length)
  return WELL_DONE_MESSAGES[idx] ?? WELL_DONE_MESSAGES[0]
}
