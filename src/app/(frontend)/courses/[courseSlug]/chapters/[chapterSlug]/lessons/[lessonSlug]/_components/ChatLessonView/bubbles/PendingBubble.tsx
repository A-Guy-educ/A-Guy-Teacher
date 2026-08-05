'use client'

/**
 * Placeholder shown while the /api/agent/chat request is in flight. Kept
 * deliberately chrome-less (no teacher header, no speak button) so a
 * still-pending message can't be interacted with as if it were a real
 * assistant reply.
 */
export function PendingBubble() {
  return (
    <div className="flex justify-start">
      <div
        className="inline-flex items-center gap-1.5 rounded-2xl rounded-tr-none border border-border bg-card px-4 py-3 shadow-elevation-1"
        aria-live="polite"
        aria-label="…"
      >
        <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" />
      </div>
    </div>
  )
}
