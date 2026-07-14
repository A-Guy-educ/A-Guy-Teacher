/**
 * @fileType component
 * @domain frontend
 * @pattern hero-progress-ring
 * @ai-summary Circular percent indicator (SVG) inside the roadmap hero card. Accent color is passed in from the parent so the ring tracks the active tab color (learn/practice/exams) — track color uses the border token so light + dark themes both render correctly.
 */

interface HeroProgressRingProps {
  percent: number
  accentColor: string
}

const RADIUS = 24
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function HeroProgressRing({ percent, accentColor }: HeroProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const dashOffset = CIRCUMFERENCE - (CIRCUMFERENCE * clamped) / 100
  return (
    <div className="relative w-16 h-16 flex items-center justify-center rounded-full border border-border bg-background/50 shrink-0">
      <svg className="w-14 h-14 -rotate-90" aria-hidden>
        <circle
          cx="28"
          cy="28"
          r={RADIUS}
          stroke="hsl(var(--border))"
          strokeWidth="3"
          fill="transparent"
        />
        <circle
          cx="28"
          cy="28"
          r={RADIUS}
          stroke={accentColor}
          strokeWidth="3.5"
          fill="transparent"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-slower ease-out"
        />
      </svg>
      <span className="absolute text-body-xs font-bold text-foreground tabular-nums">
        {clamped}%
      </span>
    </div>
  )
}
