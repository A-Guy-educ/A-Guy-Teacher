// @vitest-environment jsdom
import { ChatMessageView } from '@/ui/web/chat/ChatMessageView'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('ChatMessageView routing', () => {
  it('routes an approval-card payload to ApprovalCardView', () => {
    const payload = JSON.stringify({
      purpose: 'approval-card',
      data: {
        title: 'Approve?',
        actions: [{ id: 'a', label: 'Yes', response: 'yes' }],
      },
    })
    const { container } = render(<ChatMessageView content={payload} onChoice={vi.fn()} />)
    expect(container.querySelector('[data-testid="chat-view-approval-card"]')).not.toBeNull()
    expect(container.querySelector('.chat-message-content')).toBeNull()
  })

  it('routes a selection-list payload to SelectionListView', () => {
    const payload = JSON.stringify({
      purpose: 'selection-list',
      data: { title: 'Pick', items: [{ id: 'a', label: 'A' }] },
    })
    const { container } = render(<ChatMessageView content={payload} onChoice={vi.fn()} />)
    expect(container.querySelector('[data-testid="chat-view-selection-list"]')).not.toBeNull()
  })

  it('routes a multi-select-list payload to MultiSelectListView', () => {
    const payload = JSON.stringify({
      purpose: 'multi-select-list',
      data: { title: 'Pick', items: [{ id: 'a', label: 'A' }] },
    })
    const { container } = render(<ChatMessageView content={payload} onChoice={vi.fn()} />)
    expect(container.querySelector('[data-testid="chat-view-multi-select-list"]')).not.toBeNull()
  })

  it('routes a JSON-fenced view payload inside prose to the right view', () => {
    const prose =
      'Here is what I need you to pick:\n\n```json\n' +
      JSON.stringify({
        purpose: 'selection-list',
        data: { title: 'Pick', items: [{ id: 'a', label: 'A' }] },
      }) +
      '\n```\n\nLet me know.'
    const { container } = render(<ChatMessageView content={prose} onChoice={vi.fn()} />)
    expect(container.querySelector('[data-testid="chat-view-selection-list"]')).not.toBeNull()
  })

  it('falls back to ChatMessageContent for plain markdown', () => {
    const { container } = render(
      <ChatMessageView content="Hello world, just some text." onChoice={vi.fn()} />,
    )
    expect(container.querySelector('.chat-message-content')).not.toBeNull()
  })

  it('does not crash on an empty content string', () => {
    const { container } = render(<ChatMessageView content="" onChoice={vi.fn()} />)
    expect(
      container.querySelector('.chat-message-content, [data-testid^="chat-view-"]'),
    ).not.toBeNull()
  })
})
