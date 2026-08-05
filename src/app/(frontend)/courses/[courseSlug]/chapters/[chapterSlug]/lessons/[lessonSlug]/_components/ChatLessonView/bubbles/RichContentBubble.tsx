'use client'

import { SafeHtml } from '@/ui/web/SafeHtml'

interface RichContentBubbleProps {
  html: string
}

/**
 * Renders authored HTML inside a teacher bubble. Content now flows in from
 * the `chat-lessons` Payload collection where admins/content-editors author
 * it, so raw `dangerouslySetInnerHTML` is unsafe (stored XSS). Sanitize at
 * the sink via SafeHtml — same DOMPurify config the rest of the app uses.
 */
export function RichContentBubble({ html }: RichContentBubbleProps) {
  return <SafeHtml html={html} className="text-body-md text-foreground leading-relaxed" />
}
