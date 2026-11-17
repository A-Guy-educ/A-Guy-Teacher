// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useLessonVisibility, type SaveLessonHidden } from '../src/lib/lesson-visibility'

const ids = ['l1', 'l2', 'l3']

/** A save whose calls stay pending until the test settles them. */
function deferredSave() {
  const calls: { args: Parameters<SaveLessonHidden>; resolve: () => void; reject: () => void }[] =
    []
  const save = vi.fn<SaveLessonHidden>(
    (...args) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ args, resolve, reject: () => reject(new Error('HTTP 500')) })
      }),
  )
  return { calls, save }
}

function setup(classId = 'c1', initialHidden?: string[]) {
  const { calls, save } = deferredSave()
  const hook = renderHook(
    ({ classId, initialHidden }) => useLessonVisibility(classId, ids, initialHidden, save),
    { initialProps: { classId, initialHidden } },
  )
  return { calls, hook, save }
}

const shown = (result: { current: ReturnType<typeof useLessonVisibility> }) =>
  ids.filter((id) => result.current.isShown(id))

describe('useLessonVisibility', () => {
  it('starts from the server hidden ids, or all shown when Web sends none', () => {
    expect(shown(setup('c1', ['l2']).hook.result)).toEqual(['l1', 'l3'])

    const { result } = setup('c1', undefined).hook
    expect(shown(result)).toEqual(ids)
    expect(result.current.shownCount).toBe(3)
    expect(result.current.failedLessonId).toBeNull()
  })

  it('shows a toggle at once and saves it', async () => {
    const { calls, hook, save } = setup('c1', ['l2'])

    act(() => hook.result.current.toggle('l1'))
    expect(shown(hook.result)).toEqual(['l3'])
    expect(hook.result.current.shownCount).toBe(1)
    expect(save).toHaveBeenCalledWith('c1', 'l1', true)

    await act(async () => calls[0].resolve())
    expect(shown(hook.result)).toEqual(['l3'])
    expect(hook.result.current.failedLessonId).toBeNull()

    act(() => hook.result.current.toggle('l2'))
    expect(save).toHaveBeenLastCalledWith('c1', 'l2', false)
    expect(shown(hook.result)).toEqual(['l2', 'l3'])
  })

  it('rolls back only the failed lesson and reports it', async () => {
    const { calls, hook } = setup()

    act(() => hook.result.current.toggle('l1'))
    act(() => hook.result.current.toggle('l2'))
    await act(async () => calls[0].reject())

    expect(shown(hook.result)).toEqual(['l1', 'l3'])
    expect(hook.result.current.failedLessonId).toBe('l1')

    // The next toggle clears the message.
    act(() => hook.result.current.toggle('l3'))
    expect(hook.result.current.failedLessonId).toBeNull()
  })

  it('keeps a newer change when an older request for the same lesson fails', async () => {
    const { calls, hook } = setup()

    act(() => hook.result.current.toggle('l1'))
    act(() => hook.result.current.toggle('l1'))
    await act(async () => calls[1].resolve())
    await act(async () => calls[0].reject())

    expect(shown(hook.result)).toEqual(ids)
    expect(hook.result.current.failedLessonId).toBeNull()
  })

  it("starts over from the new class's server list on a class switch", () => {
    const { hook } = setup('c1', ['l1'])

    act(() => hook.result.current.toggle('l2'))
    hook.rerender({ classId: 'c2', initialHidden: ['l3'] })

    expect(shown(hook.result)).toEqual(['l1', 'l2'])
  })

  it('ignores a late failure for a class already switched away from', async () => {
    const { calls, hook } = setup('c1')

    act(() => hook.result.current.toggle('l1'))
    hook.rerender({ classId: 'c2', initialHidden: [] })
    hook.rerender({ classId: 'c1', initialHidden: ['l1'] })
    await act(async () => calls[0].reject())

    expect(shown(hook.result)).toEqual(['l2', 'l3'])
    expect(hook.result.current.failedLessonId).toBeNull()
  })
})
