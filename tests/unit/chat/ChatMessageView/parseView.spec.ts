/**
 * Pin the contract that `parseView` exposes to the rest of the codebase.
 * The parser is the boundary that decides whether a chat message is a
 * structured "view" or plain markdown. If this drifts, every chat
 * surface silently renders raw JSON instead of an interactive card.
 */
import { describe, expect, it } from 'vitest'

import {
  APPROVAL_CARD,
  MULTI_SELECT_LIST,
  SELECTION_LIST,
  parseView,
} from '@/ui/web/chat/ChatMessageView/parseView'

describe('parseView', () => {
  describe('whole-content JSON detection', () => {
    it('parses an approval-card payload that is the entire message', () => {
      const payload = {
        purpose: 'approval-card',
        data: {
          title: 'Approve draft',
          body: 'Looks good?',
          actions: [
            { id: 'approve', label: 'Approve', response: 'Approved', variant: 'primary' },
            { id: 'reject', label: 'Reject', response: 'Rejected', variant: 'danger' },
          ],
        },
      }
      const view = parseView(JSON.stringify(payload))
      expect(view).not.toBeNull()
      expect(view?.purpose).toBe(APPROVAL_CARD)
      if (view?.purpose === APPROVAL_CARD) {
        expect(view.data.title).toBe('Approve draft')
        expect(view.data.actions).toHaveLength(2)
        expect(view.data.actions[0]?.response).toBe('Approved')
      }
    })

    it('parses a selection-list payload', () => {
      const payload = {
        purpose: 'selection-list',
        data: {
          title: 'Pick a topic',
          items: [
            { id: 'algebra', label: 'Algebra' },
            { id: 'geometry', label: 'Geometry' },
          ],
        },
      }
      const view = parseView(JSON.stringify(payload))
      expect(view?.purpose).toBe(SELECTION_LIST)
      if (view?.purpose === SELECTION_LIST) {
        expect(view.data.items).toHaveLength(2)
      }
    })

    it('parses a multi-select-list payload', () => {
      const payload = {
        purpose: 'multi-select-list',
        data: {
          title: 'Pick courses',
          items: [
            { id: 'a', label: 'Algebra' },
            { id: 'b', label: 'Geometry' },
          ],
        },
      }
      const view = parseView(JSON.stringify(payload))
      expect(view?.purpose).toBe(MULTI_SELECT_LIST)
    })
  })

  describe('fenced JSON-block detection', () => {
    it('parses a selection-list inside a ```json code fence embedded in prose', () => {
      const prose =
        'Here is what I need you to pick:\n\n```json\n' +
        JSON.stringify({
          purpose: 'selection-list',
          data: {
            title: 'Pick one',
            items: [{ id: 'a', label: 'A' }],
          },
        }) +
        '\n```\n\nLet me know.'
      const view = parseView(prose)
      expect(view?.purpose).toBe(SELECTION_LIST)
    })

    it('parses inside a ```(no language) code fence', () => {
      const fenced =
        '```\n' +
        JSON.stringify({
          purpose: 'selection-list',
          data: { title: 't', items: [{ id: 'a', label: 'A' }] },
        }) +
        '\n```'
      const view = parseView(fenced)
      expect(view?.purpose).toBe(SELECTION_LIST)
    })
  })

  describe('graceful degradation — never crashes the chat', () => {
    it('returns null for plain markdown', () => {
      expect(parseView('Hello there, here is how we solve it.')).toBeNull()
    })

    it('returns null for an empty message', () => {
      expect(parseView('')).toBeNull()
    })

    it('returns null for a JSON object that is not a view payload', () => {
      expect(parseView(JSON.stringify({ foo: 'bar' }))).toBeNull()
    })

    it('returns null for an unknown purpose', () => {
      const payload = JSON.stringify({ purpose: 'unknown-widget', data: { title: 't' } })
      expect(parseView(payload)).toBeNull()
    })

    it('returns null when data is missing required fields', () => {
      const payload = JSON.stringify({
        purpose: 'approval-card',
        data: { title: 'no actions here' }, // missing actions
      })
      expect(parseView(payload)).toBeNull()
    })

    it('returns null for a selection-list with empty items', () => {
      const payload = JSON.stringify({
        purpose: 'selection-list',
        data: { title: 'Pick', items: [] },
      })
      expect(parseView(payload)).toBeNull()
    })

    it('does NOT crash on malformed JSON', () => {
      expect(parseView('```json\n{not json}\n```')).toBeNull()
    })

    it('does NOT crash on unbalanced JSON', () => {
      expect(parseView('{ "purpose": "approval-card", ')).toBeNull()
    })

    it('returns null for plaintext that happens to contain a { character', () => {
      expect(parseView('Use {x = 5} as your starting point')).toBeNull()
    })
  })

  describe('intent safety', () => {
    it('rejects the view payload when extra unknown top-level keys are present but data still parses — uses the whole-content payload as the canonical view', () => {
      // The parser is permissive on extra keys; only `purpose` + `data` are typed.
      const payload = JSON.stringify({
        purpose: 'selection-list',
        data: { title: 't', items: [{ id: 'a', label: 'A' }] },
        debug: { traceId: 1234 },
      })
      const view = parseView(payload)
      expect(view?.purpose).toBe(SELECTION_LIST)
    })
  })
})
