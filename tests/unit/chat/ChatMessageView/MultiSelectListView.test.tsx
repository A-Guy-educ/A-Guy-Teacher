// @vitest-environment jsdom
import { ChatMessageView } from '@/ui/web/chat/ChatMessageView'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('MultiSelectListView', () => {
  const payload = JSON.stringify({
    purpose: 'multi-select-list',
    data: {
      title: 'Pick courses to attach',
      body: 'Choose any combination.',
      items: [
        { id: 'algebra', label: 'Algebra' },
        { id: 'geometry', label: 'Geometry' },
        { id: 'calc', label: 'Calculus' },
      ],
    },
  })

  it('renders the title, body, and every selectable item', () => {
    const onChoice = vi.fn()
    const { getByTestId, container } = render(
      <ChatMessageView content={payload} onChoice={onChoice} />,
    )

    expect(getByTestId('chat-view-multi-select-list-title').textContent).toBe(
      'Pick courses to attach',
    )
    expect(getByTestId('chat-view-multi-select-list-body').textContent).toBe(
      'Choose any combination.',
    )
    expect(
      container.querySelectorAll('[data-testid^="chat-view-multi-select-list-item-"]'),
    ).toHaveLength(3)
  })

  it('does NOT render the body section when body is omitted', () => {
    const minimal = JSON.stringify({
      purpose: 'multi-select-list',
      data: {
        title: 'Pick',
        items: [{ id: 'a', label: 'A' }],
      },
    })
    const { queryByTestId } = render(<ChatMessageView content={minimal} onChoice={vi.fn()} />)
    expect(queryByTestId('chat-view-multi-select-list-body')).toBeNull()
  })

  it('submit is disabled until at least one item is selected', () => {
    const { getByTestId } = render(<ChatMessageView content={payload} onChoice={vi.fn()} />)
    const submit = getByTestId('chat-view-multi-select-list-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it('selecting two items and clicking submit posts the joined labels', () => {
    const onChoice = vi.fn()
    const { getByTestId } = render(<ChatMessageView content={payload} onChoice={onChoice} />)

    fireEvent.click(getByTestId('chat-view-multi-select-list-item-algebra'))
    fireEvent.click(getByTestId('chat-view-multi-select-list-item-calc'))

    const submit = getByTestId('chat-view-multi-select-list-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)

    expect(onChoice).toHaveBeenCalledTimes(1)
    // Order matches the order in the payload, not the click order.
    expect(onChoice).toHaveBeenCalledWith('Algebra, Calculus')
  })

  it('unselecting an item removes it from the joined output', () => {
    const onChoice = vi.fn()
    const { getByTestId } = render(<ChatMessageView content={payload} onChoice={onChoice} />)

    fireEvent.click(getByTestId('chat-view-multi-select-list-item-algebra'))
    fireEvent.click(getByTestId('chat-view-multi-select-list-item-geometry'))
    // Toggle algebra off again.
    fireEvent.click(getByTestId('chat-view-multi-select-list-item-algebra'))

    const submit = getByTestId('chat-view-multi-select-list-submit') as HTMLButtonElement
    fireEvent.click(submit)

    expect(onChoice).toHaveBeenCalledWith('Geometry')
  })

  it('stays RTL-aware — Hebrew title is rendered inside a dir=auto card', () => {
    const hebrew = JSON.stringify({
      purpose: 'multi-select-list',
      data: {
        title: 'בחר קורסים',
        items: [{ id: 'a', label: 'אלגברה' }],
      },
    })
    const { getByTestId } = render(<ChatMessageView content={hebrew} onChoice={vi.fn()} />)
    const card = getByTestId('chat-view-multi-select-list')
    expect(card.getAttribute('dir')).toBe('auto')
  })

  it('falls back to plain markdown when the payload is malformed', () => {
    const malformed = JSON.stringify({
      purpose: 'multi-select-list',
      data: { title: 'missing items' },
    })
    const { container } = render(<ChatMessageView content={malformed} onChoice={vi.fn()} />)
    expect(container.querySelector('[data-testid="chat-view-multi-select-list"]')).toBeNull()
    expect(container.querySelector('.chat-message-content')).not.toBeNull()
  })
})
