import 'server-only'

import type {
  ClassProgressResponse,
  LessonProgress,
  TeacherClassesResponse,
} from '../types/class-progress'

// Fake classes for showing the dashboard before Web ships the class endpoints.
// Enabled only by TEACHER_DEMO_DATA=1; the numbers come from a seeded RNG, like the design mockup.

const CLASSES = [
  {
    id: 'demo-10-3',
    name: "י'3 מתקדם",
    seed: 11,
    skill: 0.78,
    lessons: [
      'הזזה אנכית',
      'הזזה אופקית',
      'שילוב הזזות',
      'מתיחה וכיווץ',
      'שיקוף',
      'טרנספורמציות משולבות',
      'תרגול מסכם',
    ],
    names: [
      'דנה',
      'אורי',
      'נועם',
      'מאיה',
      'יואב',
      'שירה',
      'אלון',
      'עדי',
      'רון',
      'תמר',
      'איתי',
      'נוי',
      'עומר',
      'ליה',
      'גיא',
      'הילה',
      'יהונתן',
      'מיכל',
      'אריאל',
      'רוני',
      'עידו',
      'שקד',
      'אביב',
      'טל',
    ],
  },
  {
    id: 'demo-10-5',
    name: "י'5 מתקדם",
    seed: 47,
    skill: 0.84,
    lessons: [
      'פרבולה בסיסית',
      'סימטריה',
      'קודקוד',
      'נקודות חיתוך',
      'תחומי עלייה וירידה',
      'תחומי חיוביות',
      'אי-שוויון ריבועי',
    ],
    names: [
      'ליאור',
      'אלה',
      'דור',
      'יעל',
      'בן',
      'ענבר',
      'אופק',
      'שני',
      'עמית',
      'נטע',
      'איל',
      'רז',
      'מעיין',
      'יובל',
      'הדר',
      'אגם',
      'ניר',
      'ספיר',
      'עידן',
      'רותם',
    ],
  },
  {
    id: 'demo-10-2',
    name: "י'2 רגיל",
    seed: 83,
    skill: 0.64,
    lessons: [
      'מערכת צירים',
      'גרף של ישר',
      'שיפוע',
      'משוואת ישר',
      'ישרים מקבילים',
      'ישרים מאונכים',
      'חיתוך ישרים',
    ],
    names: [
      'אורי',
      'חן',
      'מאור',
      'נויה',
      'אליה',
      'שחר',
      'דניאל',
      'לירון',
      'איתמר',
      'עדן',
      'יונתן',
      'שירן',
      'רפאל',
      'אביטל',
      'תום',
      'אוראל',
      'הלל',
      'ליאם',
      'זיו',
      'אנאל',
      'מורן',
      'יאיר',
    ],
  },
]

const QUESTION_COUNTS = [10, 8, 12, 10, 9, 11, 10]

export function isDemoDataEnabled(): boolean {
  return process.env.TEACHER_DEMO_DATA === '1'
}

export function demoClasses(): TeacherClassesResponse {
  return {
    classes: CLASSES.map((c) => ({ id: c.id, name: c.name, studentCount: c.names.length })),
  }
}

export function demoClassProgress(classId: string): ClassProgressResponse | null {
  const c = CLASSES.find((entry) => entry.id === classId)
  if (!c) return null

  let seed = c.seed
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  const last = QUESTION_COUNTS.length - 1
  const lessons = c.lessons.map((title, j) => ({
    id: `${c.id}-l${j + 1}`,
    title,
    questionCount: QUESTION_COUNTS[j],
  }))

  const students = c.names.map((name, i) => {
    const ability = Math.max(0.2, Math.min(0.97, c.skill + (random() * 0.5 - 0.25)))
    const drift = random() * 0.16 - 0.08
    const idle = random() < 0.08
    const progress: Record<string, LessonProgress> = {}

    QUESTION_COUNTS.forEach((n, j) => {
      if (j === last && (idle || random() < 0.18)) return
      const partial = j === last && random() < 0.22
      const reach = partial ? Math.round(n * (0.3 + random() * 0.4)) : n
      const a = Math.max(0.15, Math.min(0.98, ability + (drift * (j - last / 2)) / 2))
      let minutes = (i * 7 + j * 13) % 6

      const questions = Array.from({ length: n }, (_, q) => {
        const id = `q${q + 1}`
        if (q >= reach)
          return { id, status: 'unseen' as const, mistakes: 0, hints: 0, explanations: 0 }
        const x = random()
        let mistakes = 0
        let hints = 0
        let explanations = 0
        let solved = true
        if (x < a * 0.7) mistakes = random() < 0.15 ? 1 : 0
        else if (x < a) mistakes = 1 + Math.floor(random() * 2)
        else if (x < a + (1 - a) * 0.65) {
          hints = 1 + Math.floor(random() * 2)
          mistakes = Math.floor(random() * 2)
          explanations = random() < 0.2 ? 1 : 0
        } else {
          solved = false
          mistakes = 1 + Math.floor(random() * 2)
          hints = random() < 0.5 ? 1 : 0
        }
        minutes += 1.6 + mistakes * 0.7 + (hints + explanations) * 1.1
        return {
          id,
          status: solved ? ('solved' as const) : ('unsolved' as const),
          mistakes,
          hints,
          explanations,
        }
      })

      progress[lessons[j].id] = {
        status: partial ? 'in_progress' : 'completed',
        minutes: Math.round(minutes),
        questions,
      }
    })

    return { id: `${c.id}-s${i + 1}`, name, lessons: progress }
  })

  return { class: { id: c.id, name: c.name }, lessons, students }
}
