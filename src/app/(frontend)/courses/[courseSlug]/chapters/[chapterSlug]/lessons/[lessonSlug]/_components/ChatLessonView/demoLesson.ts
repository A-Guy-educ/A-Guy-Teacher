/**
 * @fileType data
 * @domain lessons
 * @ai-summary Hardcoded demo lesson for the Chat view. All correctness checks
 *             + feedback text live here (no AI in the runtime path). Ported from
 *             the AI Studio prototype at a-guy-ai-math-teacher.
 */

import type { LessonScript } from './types'

export const demoLesson: LessonScript = {
  id: 'chat-demo-1',
  lessonName: 'מספרים מכוונים — בסיס וציר המספרים',
  lessonNumber: 'שיעור 1',
  highlights: 'התמצאות בציר, השוואת שברים, סימנים כפולים ומשוואות חסרות',
  steps: [
    {
      id: 'personality',
      type: 'multiple_choice',
      text: 'שלום! אני A-Guy, המורה הדיגיטלי שלך למתמטיקה. באיזה סגנון הוראה נתחיל היום?',
      options: [
        {
          text: 'מורה קשוח וממוקד',
          value: 'tough',
          feedback: 'מצוין. נתחיל מיד, אין לנו זמן לבזבז.',
          next: 'how_are_you',
        },
        {
          text: 'מורה חברותי ומסביר',
          value: 'talkative',
          feedback: 'איזה כיף לפגוש אותך! נלמד היום ברוגע ובסבלנות, צעד אחר צעד.',
          next: 'how_are_you',
        },
        {
          text: 'מורה קצר וענייני',
          value: 'focused',
          feedback: 'מעולה. ניגש ישר לחומר ונפתור את זה ביעילות.',
          next: 'how_are_you',
        },
      ],
    },
    {
      id: 'how_are_you',
      type: 'multiple_choice',
      text: 'אז אחרי שהכרנו — מה שלומך ואיך האנרגיה שלך היום?',
      options: [
        {
          text: 'מצוין, מלא מרץ',
          feedback: 'נהדר, ננצל את הכוח הזה כדי לרוץ קדימה!',
          next: 'goal',
        },
        {
          text: 'קצת עייף אבל נסתדר',
          feedback: 'מובן לגמרי. נהיה ממוקדים ונעשה את זה קל ומהיר.',
          next: 'goal',
        },
      ],
    },
    {
      id: 'goal',
      type: 'multiple_choice',
      text: 'מה תרצה שנעשה בשיעור היום?',
      options: [
        {
          text: 'ללמוד חומר חדש מהיסוד',
          feedback: 'בחירה מצוינת. היום נלמד את הבסיס של מספרים מכוונים.',
          next: 'intro_ex1',
        },
        {
          text: 'לעשות חזרה ולתרגל',
          feedback: 'מעולה — תרגול מביא לשליטה. נפתור יחד את התרגילים הראשונים.',
          next: 'intro_ex1',
        },
      ],
    },
    {
      id: 'intro_ex1',
      type: 'rich_text',
      text: 'נתחיל עם תרגיל 1 — התמצאות על ציר המספרים.',
      content: `
        <div class="p-card-padding-sm bg-primary/5 rounded-2xl border border-primary/20">
          <h3 class="text-body-lg font-bold text-primary mb-2">🧭 ציר המספרים המכוונים</h3>
          <p class="text-body-md text-foreground leading-relaxed">
            במספרים שליליים הכל עובד "הפוך": ככל שהמספר נראה גדול יותר (בלי המינוס), הוא בעצם <strong>קטן יותר</strong> — כי הוא נמצא שמאלה יותר על הציר.
          </p>
        </div>
      `,
      next: 'ex1_a',
    },
    {
      id: 'ex1_a',
      type: 'multiple_choice',
      text: 'איזה מהמספרים הבאים הוא מספר שלם הקטן מ־$-2$?',
      options: [
        {
          text: '$-1$',
          isCorrect: false,
          feedback: 'לא נכון. $-1$ נמצא מימין ל־$-2$ ולכן גדול ממנו.',
          next: 'ex1_b',
        },
        {
          text: '$-3$',
          isCorrect: true,
          feedback: 'מעולה! $-3$ נמצא משמאל ל־$-2$ ולכן קטן ממנו.',
          next: 'ex1_b',
        },
      ],
      correction: {
        text: 'שים לב: מספר שקטן מ־$-2$ חייב להימצא שמאלה ממנו על הציר. לכן $-3$ הוא הנכון.',
      },
    },
    {
      id: 'ex1_b',
      type: 'multiple_choice',
      text: 'איזה מהמספרים הוא מספר שלילי שלם הגדול מ־$-4$?',
      options: [
        {
          text: '$-3$',
          isCorrect: true,
          feedback: 'נכון! $-3$ קרוב יותר לאפס ונמצא מימין ל־$-4$.',
          next: 'ex1_c',
        },
        {
          text: '$-5$',
          isCorrect: false,
          feedback: 'לא נכון — $-5$ נמצא משמאל ל־$-4$ ולכן קטן ממנו.',
          next: 'ex1_c',
        },
      ],
      correction: {
        text: 'מספר גדול יותר בציר השליליים = קרוב יותר לאפס. $-3$ קרוב יותר לאפס מ־$-4$.',
      },
    },
    {
      id: 'ex1_c',
      type: 'text_answer',
      text: 'כתוב את המספר השלם הקטן ביותר הגדול מ־$-10$.',
      expected: '-9',
      correctFeedback: 'מדויק! $-9$ קרוב יותר לאפס מ־$-10$ ולכן גדול ממנו.',
      correction: {
        text: 'התשובה הנכונה היא $-9$: הוא צעד אחד מימין ל־$-10$ על הציר.',
      },
      next: 'finish',
    },
    {
      id: 'finish',
      type: 'rich_text',
      text: 'כל הכבוד! סיימת את היחידה הראשונה 🎉',
      content: `
        <div class="p-card-padding-sm bg-success/10 rounded-2xl border border-success/30">
          <p class="text-body-md text-foreground">
            עברת את הבסיס של מספרים מכוונים. בפעם הבאה נמשיך להשוואת שברים וסימנים כפולים.
          </p>
        </div>
      `,
      isEnd: true,
    },
  ],
}
