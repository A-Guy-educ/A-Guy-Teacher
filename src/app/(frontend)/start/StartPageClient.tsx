'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { setUserProfile } from '@/client/state/localStorage/userProfile'
import type { Course } from '@/infra/types/content'
import { cn } from '@/infra/utils/ui'
import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'

type Direction = 'ltr' | 'rtl'
type Pane = 'welcome' | 'conversation' | 'redirecting'
type Interaction = 'none' | 'mood' | 'courses'
type Mood = 'excellent' | 'good' | 'tired'

interface StartPageClientProps {
  courses: Course[]
  direction: Direction
}

const moodCards: Array<{ id: Mood; emoji: string; title: string; description: string }> = [
  {
    id: 'excellent',
    emoji: '😊',
    title: 'מצויין',
    description: 'מלאי מוטיבציה ואנרגיה ללמוד',
  },
  {
    id: 'good',
    emoji: '👍',
    title: 'אחלה',
    description: 'מוכנים להתקדם כרגיל',
  },
  {
    id: 'tired',
    emoji: '🥱',
    title: 'קצת עייף',
    description: 'נשמור על קצב קליל וממוקד',
  },
]

const moodResponses: Record<Mood, string> = {
  excellent: 'איזה כיף! ננצל את האנרגיה הזאת 💪',
  good: 'מעולה, נתקדם בקצב טוב 👍',
  tired: 'אין בעיה, ניקח את זה קל וממוקד 🧘',
}

export function StartPageClient({ courses, direction }: StartPageClientProps) {
  const router = useRouter()
  const [pane, setPane] = useState<Pane>('welcome')
  const [interaction, setInteraction] = useState<Interaction>('none')
  const [displayedText, setDisplayedText] = useState('')
  const [audioEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [selectedMood, setSelectedMood] = useState<Mood>('good')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const runIdRef = useRef(0)

  useEffect(() => {
    document.body.classList.add('landing-page')
    return () => document.body.classList.remove('landing-page')
  }, [])

  const sleep = useCallback(
    (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms)),
    [],
  )

  const playTone = useCallback(
    (freq = 600, duration = 70) => {
      if (!audioEnabled) return

      try {
        const browserWindow = window as Window & {
          webkitAudioContext?: typeof AudioContext
        }
        const AudioContextCtor = window.AudioContext || browserWindow.webkitAudioContext
        if (!AudioContextCtor) return
        const audioContext = new AudioContextCtor()
        const oscillator = audioContext.createOscillator()
        const gain = audioContext.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime)
        gain.gain.setValueAtTime(0.025, audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration / 1000)
        oscillator.connect(gain)
        gain.connect(audioContext.destination)
        oscillator.start()
        oscillator.stop(audioContext.currentTime + duration / 1000)
      } catch {
        // Audio is decorative only.
      }
    },
    [audioEnabled],
  )

  const typeText = useCallback(
    async (text: string, speed = 45) => {
      const currentRun = ++runIdRef.current
      setDisplayedText('')
      setIsSpeaking(true)

      for (let i = 0; i < text.length; i += 1) {
        if (runIdRef.current !== currentRun) return
        setDisplayedText(text.slice(0, i + 1))
        if (Math.random() > 0.65) playTone(600 + Math.random() * 150, 40)
        await sleep(speed)
      }

      if (runIdRef.current === currentRun) setIsSpeaking(false)
    },
    [playTone, sleep],
  )

  const startConversation = useCallback(async () => {
    setPane('conversation')
    setInteraction('none')
    await typeText('נעים מאוד! אני Aguy, מורה פרטי למתמטיקה', 40)
    await sleep(1500)
    await typeText('איך את/ה היום?', 45)
    setInteraction('mood')
  }, [sleep, typeText])

  const selectMood = useCallback(
    async (mood: Mood) => {
      setSelectedMood(mood)
      setInteraction('none')
      playTone(580, 120)
      await typeText(moodResponses[mood], 45)
      await sleep(1500)
      await typeText('איזה כיתה/שאלון את/ה לומד/ת?', 45)
      setInteraction('courses')
    },
    [playTone, sleep, typeText],
  )

  const selectCourse = useCallback(
    async (course: Course) => {
      setSelectedCourse(course)
      setUserProfile({
        gradeLevel: course.courseLabel || course.title,
        courseId: course.id,
        mood: selectedMood,
        lastVisit: new Date().toISOString(),
      })
      setInteraction('none')
      playTone(580, 120)
      await typeText('בואו נתחיל! ⚡', 50)
      await sleep(1200)
      setPane('redirecting')
      window.setTimeout(() => {
        router.push(getCourseHref(course))
      }, 800)
    },
    [playTone, router, selectedMood, sleep, typeText],
  )

  return (
    <main
      dir={direction}
      className="min-h-screen overflow-hidden bg-background font-sans text-foreground"
    >
      <div className="pointer-events-none fixed -left-24 top-20 h-72 w-72 rounded-full bg-primary/10 blur-[120px] dark:bg-primary/20" />
      <div className="pointer-events-none fixed -bottom-24 right-10 h-96 w-96 rounded-full bg-success/10 blur-[120px] dark:bg-success/20" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="fixed left-4 top-4 z-50 rounded-xl border border-border bg-card/80 shadow-elevation-1 backdrop-blur">
          <ThemeSelector />
        </div>

        <section className="flex flex-1 items-center justify-center px-4 py-section-xs">
          {pane === 'welcome' && <WelcomePane onStart={startConversation} />}
          {pane === 'conversation' && (
            <ConversationPane
              courses={courses}
              displayedText={displayedText}
              interaction={interaction}
              isSpeaking={isSpeaking}
              selectedCourse={selectedCourse}
              onSelectCourse={selectCourse}
              onSelectMood={selectMood}
            />
          )}
          {pane === 'redirecting' && <RedirectingPane selectedCourse={selectedCourse} />}
        </section>

        <StartFooter activeIndex={paneToIndex(pane)} />
      </div>
    </main>
  )
}

function WelcomePane({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <div className="mb-8 inline-flex items-center gap-content-gap-xs rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-body-sm font-extrabold text-primary">
        <span className="h-2 w-2 rounded-full bg-primary" />
        מערכת הלמידה האישית למתמטיקה
      </div>
      <h1 className="mb-6 text-display-lg font-extrabold leading-tight text-foreground md:text-display-xl">
        ללמוד מתמטיקה בדרך החכמה
      </h1>
      <p className="mx-auto mb-10 max-w-2xl text-body-lg font-medium leading-relaxed text-muted-foreground md:text-heading-xl">
        שיעורים אינטראקטיביים, תרגול מונחה, תשובות מיידיות לפענוח שאלות שלך, הכוונה למבחנים - הכל
        במקום אחד.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="inline-flex h-14 items-center gap-3 rounded-xl bg-primary px-9 text-body-lg font-extrabold text-primary-foreground shadow-elevation-3 transition-all duration-normal hover:bg-primary/90 active:scale-[0.98]"
      >
        <span className="text-body-md">▶</span>
        להתחיל ללמוד
      </button>
    </div>
  )
}

function ConversationPane({
  courses,
  displayedText,
  interaction,
  isSpeaking,
  selectedCourse,
  onSelectMood,
  onSelectCourse,
}: {
  courses: Course[]
  displayedText: string
  interaction: Interaction
  isSpeaking: boolean
  selectedCourse: Course | null
  onSelectMood: (mood: Mood) => void
  onSelectCourse: (course: Course) => void
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="relative mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card text-primary shadow-elevation-1">
          <Bot className="h-10 w-10" aria-hidden />
          <div className="absolute -bottom-3 flex h-7 items-end gap-1 rounded-full bg-card px-2 py-1 shadow-elevation-1">
            {[0, 1, 2].map((item) => (
              <span
                key={item}
                className={cn(
                  'w-1 rounded-full bg-primary transition-all duration-normal',
                  isSpeaking ? 'h-5 animate-pulse' : 'h-2',
                )}
              />
            ))}
          </div>
        </div>

        <p className="min-h-24 max-w-3xl text-display-sm font-extrabold leading-relaxed text-foreground md:text-display-md">
          {displayedText}
          {isSpeaking ? (
            <span className="me-1 inline-block h-6 w-1 animate-pulse bg-primary" />
          ) : null}
        </p>
      </div>

      <div
        className={cn(
          'transition-all duration-normal',
          interaction === 'none' ? 'opacity-0' : 'opacity-100',
        )}
      >
        {interaction === 'mood' ? <MoodGrid onSelectMood={onSelectMood} /> : null}
        {interaction === 'courses' ? (
          <CourseGrid
            courses={courses}
            selectedCourse={selectedCourse}
            onSelectCourse={onSelectCourse}
          />
        ) : null}
      </div>
    </div>
  )
}

function MoodGrid({ onSelectMood }: { onSelectMood: (mood: Mood) => void }) {
  return (
    <div className="mx-auto grid max-w-2xl grid-cols-1 gap-content-gap-sm md:grid-cols-3">
      {moodCards.map((mood) => (
        <button
          key={mood.id}
          type="button"
          onClick={() => onSelectMood(mood.id)}
          className="flex flex-col items-center rounded-2xl border border-border bg-card p-5 text-center shadow-elevation-1 transition-all duration-normal hover:-translate-y-0.5 hover:border-primary/50"
        >
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-heading-md">
            {mood.emoji}
          </span>
          <span className="mb-1 text-body-md font-extrabold text-card-foreground">
            {mood.title}
          </span>
          <span className="text-body-xs text-muted-foreground">{mood.description}</span>
        </button>
      ))}
    </div>
  )
}

function CourseGrid({
  courses,
  selectedCourse,
  onSelectCourse,
}: {
  courses: Course[]
  selectedCourse: Course | null
  onSelectCourse: (course: Course) => void
}) {
  if (courses.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-card-padding text-center text-body-md text-muted-foreground">
        אין כרגע קורסים זמינים במערכת.
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-3">
      {courses.map((course) => (
        <button
          key={course.id}
          type="button"
          onClick={() => onSelectCourse(course)}
          className={cn(
            'relative min-h-32 rounded-xl border border-border bg-card p-card-padding-sm text-start shadow-elevation-1 transition-all duration-normal hover:-translate-y-0.5 hover:border-primary/50',
            selectedCourse?.id === course.id && 'border-primary',
          )}
        >
          <span className="absolute left-3 top-3 rounded border border-primary/10 bg-primary/10 px-2 py-1 text-body-xs font-extrabold text-primary">
            {course.courseLabel || 'קורס'}
          </span>
          <span className="mt-8 block text-heading-sm font-extrabold text-card-foreground">
            {course.title}
          </span>
          {course.description ? (
            <span className="mt-2 line-clamp-2 block text-body-xs text-muted-foreground">
              {stripHtml(course.description)}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

function RedirectingPane({ selectedCourse }: { selectedCourse: Course | null }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto mb-6 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <h2 className="mb-2 text-heading-xl font-extrabold text-foreground">פותח את הקורס...</h2>
      <p className="text-body-sm text-muted-foreground">
        מעביר אותך אל {selectedCourse?.title || 'הקורס שבחרת'}...
      </p>
    </div>
  )
}

function StartFooter({ activeIndex }: { activeIndex: number }) {
  return (
    <div
      role="contentinfo"
      className="border-t border-border bg-card/70 py-5 text-center text-body-xs text-muted-foreground"
    >
      <div className="mb-3 flex justify-center gap-content-gap-xs">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1 rounded-full bg-muted-foreground/30 transition-all duration-normal',
              index === activeIndex ? 'w-4 bg-primary' : 'w-2',
            )}
          />
        ))}
      </div>
      Aguy Onboarding Platform © 2026. כל הזכויות שמורות.
    </div>
  )
}

function paneToIndex(pane: Pane) {
  if (pane === 'welcome') return 0
  if (pane === 'conversation') return 1
  return 2
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function getCourseHref(course: Course) {
  return course.slug ? `/courses/${course.slug}` : '/study'
}
