/**
 * @fileType module
 * @domain ui/chat
 * @pattern view-payload-parser
 * @ai-summary Detects and validates a structured "view" payload inside a chat message.
 */

import { z } from 'zod'

/**
 * The three renderer rules mirrored from `views/renderers/*.json`.
 * Adding a new renderer here is a deliberate change — schemas in
 * repo-root JSON files must be updated alongside.
 */
export const APPROVAL_CARD = 'approval-card' as const
export const SELECTION_LIST = 'selection-list' as const
export const MULTI_SELECT_LIST = 'multi-select-list' as const

export const KNOWN_VIEW_PURPOSES = [APPROVAL_CARD, SELECTION_LIST, MULTI_SELECT_LIST] as const
export type KnownViewPurpose = (typeof KNOWN_VIEW_PURPOSES)[number]

const ActionVariant = z.enum(['primary', 'secondary', 'danger']).optional()

const Action = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  response: z.string().min(1),
  variant: ActionVariant,
})

const SelectableItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
})

const ApprovalCardData = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  actions: z.array(Action).min(1),
})

const SelectionListData = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  items: z.array(SelectableItem).min(1),
})

const MultiSelectListData = SelectionListData // identical shape

export interface ApprovalCardView {
  purpose: typeof APPROVAL_CARD
  data: z.infer<typeof ApprovalCardData>
}
export interface SelectionListView {
  purpose: typeof SELECTION_LIST
  data: z.infer<typeof SelectionListData>
}
export interface MultiSelectListView {
  purpose: typeof MULTI_SELECT_LIST
  data: z.infer<typeof MultiSelectListData>
}

export type ParsedView = ApprovalCardView | SelectionListView | MultiSelectListView

const FencedJsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g

function tryParseJson(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

function looksLikeViewPayload(value: unknown): value is { purpose: string; data: unknown } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { purpose?: unknown; data?: unknown }
  return typeof candidate.purpose === 'string' && 'data' in candidate
}

function validateData(purpose: string, data: unknown): ParsedView | null {
  if (purpose === APPROVAL_CARD) {
    const result = ApprovalCardData.safeParse(data)
    return result.success
      ? ({ purpose: APPROVAL_CARD, data: result.data } as ApprovalCardView)
      : null
  }
  if (purpose === SELECTION_LIST) {
    const result = SelectionListData.safeParse(data)
    return result.success
      ? ({ purpose: SELECTION_LIST, data: result.data } as SelectionListView)
      : null
  }
  if (purpose === MULTI_SELECT_LIST) {
    const result = MultiSelectListData.safeParse(data)
    return result.success
      ? ({ purpose: MULTI_SELECT_LIST, data: result.data } as MultiSelectListView)
      : null
  }
  return null
}

function tryBuildView(payload: unknown): ParsedView | null {
  if (!looksLikeViewPayload(payload)) return null
  const purpose = (payload as { purpose: string }).purpose
  if (!KNOWN_VIEW_PURPOSES.includes(purpose as KnownViewPurpose)) return null
  const data = (payload as { data: unknown }).data
  return validateData(purpose, data)
}

/**
 * Extract and validate the first valid view payload from a chat message.
 *
 * Detection order:
 *  1. The whole trimmed content is JSON whose top-level object has a
 *     recognised `purpose` and matching `data` schema.
 *  2. Otherwise, scan for the first `​```json … ```​` fenced block whose body
 *     parses to a recognised payload. Fenced block wins over plain inline
 *     prose — agents should wrap the JSON to make intent unambiguous.
 *
 * Returns `null` if no renderer matches. Malformed payloads are skipped,
 * never raised, so the chat never crashes.
 */
export function parseView(content: string): ParsedView | null {
  const whole = tryParseJson(content)
  if (whole !== undefined) {
    const view = tryBuildView(whole)
    if (view) return view
  }

  // Scan fenced blocks in order. The regex is stateful so reset before use.
  FencedJsonBlockRegex.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FencedJsonBlockRegex.exec(content)) !== null) {
    const candidate = tryParseJson(match[1])
    if (candidate === undefined) continue
    const view = tryBuildView(candidate)
    if (view) return view
  }

  return null
}
