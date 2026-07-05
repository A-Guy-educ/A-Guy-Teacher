// @vitest-environment jsdom
import { ChatMessageView } from '@/ui/web/chat/ChatMessageView'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('ApprovalCardView', () => {
  it('renders the title, body, and every action button', () => {
    const payload = JSON.stringify({
      purpose: 'approval-card',
      data: {
        title: 'Approve lesson?',
        body: 'This lesson covers algebra basics.',
        actions: [
          { id: 'approve', label: 'Approve', response: 'Approved', variant: 'primary' },
          { id: 'edit', label: 'Edit', response: 'Needs edits', variant: 'secondary' },
          { id: 'reject', label: 'Reject', response: 'Rejected', variant: 'danger' },
        ],
      },
    })

    const { container, getByTestId } = render(
      <ChatMessageView content={payload} onChoice={vi.fn()} />,
    )

    expect(getByTestId('chat-view-approval-card-title').textContent).toBe('Approve lesson?')
    expect(getByTestId('chat-view-approval-card-body').textContent).toBe(
      'This lesson covers algebra basics.',
    )
    expect(
      container.querySelectorAll('[data-testid^="chat-view-approval-card-action-"]'),
    ).toHaveLength(3)
  })

  it('does NOT render the body section when body is omitted', () => {
    const payload = JSON.stringify({
      purpose: 'approval-card',
      data: {
        title: 'Approve?',
        actions: [{ id: 'approve', label: 'Approve', response: 'Approved' }],
      },
    })
    const { queryByTestId } = render(<ChatMessageView content={payload} onChoice={vi.fn()} />)
    expect(queryByTestId('chat-view-approval-card-body')).toBeNull()
  })

  it('fires onChoice with the action response when an action button is clicked', () => {
    const onChoice = vi.fn()
    const payload = JSON.stringify({
      purpose: 'approval-card',
      data: {
        title: 'Approve?',
        actions: [
          { id: 'approve', label: 'Approve', response: 'Approved' },
          { id: 'reject', label: 'Reject', response: 'Rejected' },
        ],
      },
    })

    const { getByTestId } = render(<ChatMessageView content={payload} onChoice={onChoice} />)

    fireEvent.click(getByTestId('chat-view-approval-card-action-approve'))
    expect(onChoice).toHaveBeenCalledWith('Approved')

    fireEvent.click(getByTestId('chat-view-approval-card-action-reject'))
    expect(onChoice).toHaveBeenCalledWith('Rejected')

    expect(onChoice).toHaveBeenCalledTimes(2)
  })

  it('stays RTL-aware — Hebrew body is rendered inside a dir=auto card', () => {
    const payload = JSON.stringify({
      purpose: 'approval-card',
      data: {
        title: 'לאשר את השיעור?',
        body: 'השיעור מכסה אלגברה בסיסית.',
        actions: [{ id: 'approve', label: 'אשר', response: 'אושר' }],
      },
    })
    const { getByTestId } = render(<ChatMessageView content={payload} onChoice={vi.fn()} />)
    const card = getByTestId('chat-view-approval-card')
    expect(card.getAttribute('dir')).toBe('auto')
  })

  it('disables action buttons when disabled=true', () => {
    const onChoice = vi.fn()
    const payload = JSON.stringify({
      purpose: 'approval-card',
      data: {
        title: 'Approve?',
        actions: [{ id: 'approve', label: 'Approve', response: 'Approved' }],
      },
    })
    const { getByTestId } = render(
      <ChatMessageView content={payload} onChoice={onChoice} disabled />,
    )
    const btn = getByTestId('chat-view-approval-card-action-approve') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('falls back to plain markdown for a malformed approval-card payload (no crash)', () => {
    // Missing required `actions` field → parseView returns null → ChatMessageView
    // falls back to ChatMessageContent (markdown). The bubble still appears.
    const payload = JSON.stringify({
      purpose: 'approval-card',
      data: { title: 'no actions' },
    })
    const { container } = render(<ChatMessageView content={payload} onChoice={vi.fn()} />)
    // Approval card testid is absent — we're back in markdown-land.
    expect(container.querySelector('[data-testid="chat-view-approval-card"]')).toBeNull()
    // The plain content survives in the bubble.
    expect(container.querySelector('.chat-message-content')).not.toBeNull()
  })
})
