// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { push, useSearchParams } = vi.hoisted(() => ({
  push: vi.fn(),
  useSearchParams: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams,
}))

vi.mock('@/client/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}))

import { Search } from '@/ui/web/search/Component'

describe('Search', () => {
  beforeEach(() => {
    push.mockClear()
    useSearchParams.mockReturnValue(new URLSearchParams('q=math'))
  })

  it('keeps the URL query in the search input without erasing it', () => {
    render(<Search />)

    expect((screen.getByRole('textbox', { name: 'Search' }) as HTMLInputElement).value).toBe('math')
    expect(push).not.toHaveBeenCalled()
  })
})
