// @vitest-environment jsdom
import { ChatMessageView } from '@/ui/web/chat/ChatMessageView'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('SelectionListView', () => {
  const payload = JSON.stringify({
    purpose: 'selection-list',
    data: {
      title: 'Which topic next?',
      body: 'Pick one to continue.',
      items: [
        { id: 'algebra', label: 'Algebra', description: 'Equations & polynomials' },
        { id: 'geometry', label: 'Geometry', description: 'Shapes & angles' },
        { id: 'calc', label: 'Calculus' },
      ],
    },
  })

  it('renders the title, body, and every selectable item as a radio control', () => {
    const onChoice = vi.fn()
    const { getByTestId, container } = render(
      <ChatMessageView content={payload} onChoice={onChoice} />,
    )

    expect(getByTestId('chat-view-selection-list-title').textContent).toBe('Which topic next?')
    expect(getByTestId('chat-view-selection-list-body').textContent).toBe('Pick one to continue.')
    expect(
      container.querySelectorAll('[data-testid^="chat-view-selection-list-item-"]'),
    ).toHaveLength(3)
    expect(container.querySelectorAll('[role="radio"]')).toHaveLength(3)
  })

  it('does NOT render the body section when body is omitted', () => {
    const minimal = JSON.stringify({
      purpose: 'selection-list',
      data: {
        title: 'Pick',
        items: [{ id: 'a', label: 'A' }],
      },
    })
    const { queryByTestId } = render(<ChatMessageView content={minimal} onChoice={vi.fn()} />)
    expect(queryByTestId('chat-view-selection-list-body')).toBeNull()
  })

  it('fires onChoice with the item label when an item is clicked', () => {
    const onChoice = vi.fn()
    const { getByTestId } = render(<ChatMessageView content={payload} onChoice={onChoice} />)

    fireEvent.click(getByTestId('chat-view-selection-list-item-algebra'))
    expect(onChoice).toHaveBeenCalledWith('Algebra')

    fireEvent.click(getByTestId('chat-view-selection-list-item-calc'))
    expect(onChoice).toHaveBeenCalledWith('Calculus')

    expect(onChoice).toHaveBeenCalledTimes(2)
  })

  it('stays RTL-aware — Hebrew title is rendered inside a dir=auto card', () => {
    const hebrew = JSON.stringify({
      purpose: 'selection-list',
      data: {
        title: 'בחר נושא',
        items: [{ id: 'a', label: 'אלגברה' }],
      },
    })
    const { getByTestId } = render(<ChatMessageView content={hebrew} onChoice={vi.fn()} />)
    const card = getByTestId('chat-view-selection-list')
    expect(card.getAttribute('dir')).toBe('auto')
  })

  it('disables all radio buttons when disabled=true', () => {
    const { getByTestId } = render(
      <ChatMessageView content={payload} onChoice={vi.fn()} disabled />,
    )
    const btns = ['algebra', 'geometry', 'calc'].map(
      (id) => getByTestId(`chat-view-selection-list-item-${id}`) as HTMLButtonElement,
    )
    for (const btn of btns) {
      expect(btn.disabled).toBe(true)
    }
  })

  it('falls back to plain markdown when the payload is malformed', () => {
    const malformed = JSON.stringify({
      purpose: 'selection-list',
      data: { title: 'missing items' },
    })
    const { container } = render(<ChatMessageView content={malformed} onChoice={vi.fn()} />)
    expect(container.querySelector('[data-testid="chat-view-selection-list"]')).toBeNull()
    expect(container.querySelector('.chat-message-content')).not.toBeNull()
  })
})
