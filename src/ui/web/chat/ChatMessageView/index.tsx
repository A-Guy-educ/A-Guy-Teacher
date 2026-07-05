'use client'

import { ChatMessageContent } from '../ChatMessageContent'
import {
  APPROVAL_CARD,
  MULTI_SELECT_LIST,
  SELECTION_LIST,
  parseView,
  type ParsedView,
} from './parseView'
import { ApprovalCardView } from './ApprovalCardView'
import { SelectionListView } from './SelectionListView'
import { MultiSelectListView } from './MultiSelectListView'

interface ChatMessageViewProps {
  /** Raw assistant message text. May or may not contain a structured view payload. */
  content: string
  /**
   * Called with the text the renderer wants posted as the user's next message.
   * Selection / approval choice → caller pipes this into the chat input submit.
   */
  onChoice: (text: string) => void
  /** Disables every interaction inside the view (e.g. while the chat is loading). */
  disabled?: boolean
  /** Optional className forwarded to the markdown fallback bubble. */
  className?: string
}

/**
 * Routing wrapper for a chat message.
 *
 * 1. Tries `parseView(content)` to detect a structured "view" payload
 *    matching one of the renderers defined in `views/renderers/`.
 * 2. If a known payload is found, renders the matching view component.
 * 3. Otherwise (or if rendering throws) falls back to plain markdown via
 *    `ChatMessageContent`. The chat never crashes on a malformed payload.
 */
export function ChatMessageView({ content, onChoice, disabled, className }: ChatMessageViewProps) {
  let view: ParsedView | null = null
  try {
    view = parseView(content)
  } catch {
    view = null
  }

  if (view) {
    return renderView(view, onChoice, disabled)
  }

  return <ChatMessageContent content={content} className={className} />
}

function renderView(view: ParsedView, onChoice: (text: string) => void, disabled?: boolean) {
  switch (view.purpose) {
    case APPROVAL_CARD:
      return <ApprovalCardView view={view} onChoice={onChoice} disabled={disabled} />
    case SELECTION_LIST:
      return <SelectionListView view={view} onChoice={onChoice} disabled={disabled} />
    case MULTI_SELECT_LIST:
      return <MultiSelectListView view={view} onChoice={onChoice} disabled={disabled} />
  }
}
