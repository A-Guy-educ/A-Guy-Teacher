import { describe, expect, it } from 'vitest'

import { getExerciseBlocks } from '@/lib/exercises/getExerciseBlocks'
import type { ContentBlock } from '@/infra/types/exercise'
import type { Exercise, Section } from '@/infra/types/content'

const block = (id: string): ContentBlock => ({ id, type: 'rich_text', value: id })

const section = (id: string, order: number, blocks: ContentBlock[]): Section => ({
  id,
  order,
  content: { blocks },
})

describe('getExerciseBlocks', () => {
  it('returns sections in playlist order when both playlist and populated sections exist', () => {
    const exercise: Exercise = {
      id: 'ex1',
      blocks: JSON.stringify([
        { blockType: 'sectionRef', section: 's2' },
        { blockType: 'sectionRef', section: 's1' },
        { blockType: 'exerciseRef', exercise: 'ex-other' },
      ]),
      sections: [
        section('s1', 10, [block('s1-a'), block('s1-b')]),
        section('s2', 20, [block('s2-a')]),
      ],
    }

    expect(getExerciseBlocks(exercise).map((b) => b.id)).toEqual(['s2-a', 's1-a', 's1-b'])
  })

  it('falls back to section.order ascending when playlist is empty', () => {
    const exercise: Exercise = {
      id: 'ex1',
      blocks: [],
      sections: [
        section('s3', 30, [block('s3-a')]),
        section('s1', 10, [block('s1-a'), block('s1-b')]),
        section('s2', 20, [block('s2-a')]),
      ],
    }

    expect(getExerciseBlocks(exercise).map((b) => b.id)).toEqual(['s1-a', 's1-b', 's2-a', 's3-a'])
  })

  it('puts sections without an order at the end when sorting by section.order', () => {
    const exercise: Exercise = {
      id: 'ex1',
      blocks: [],
      sections: [
        section('s-no-order', undefined as unknown as number, [block('end')]),
        section('s2', 20, [block('mid')]),
        section('s1', 10, [block('first')]),
      ],
    }

    expect(getExerciseBlocks(exercise).map((b) => b.id)).toEqual(['first', 'mid', 'end'])
  })

  it('falls back to exercise.content.blocks when there are no sections', () => {
    const exercise: Exercise = {
      id: 'ex1',
      content: { blocks: [block('c1'), block('c2')] },
    }

    expect(getExerciseBlocks(exercise).map((b) => b.id)).toEqual(['c1', 'c2'])
  })

  it('returns [] when nothing is present', () => {
    expect(getExerciseBlocks({ id: 'ex1' }).map((b) => b.id)).toEqual([])
    expect(getExerciseBlocks(null).map((b) => b.id)).toEqual([])
    expect(getExerciseBlocks(undefined).map((b) => b.id)).toEqual([])
  })

  it('falls back to exercise.content.blocks when sections exist but no entry is populated', () => {
    // String-only ids in `sections` are not the populated Section shape. Per
    // the issue's "fall back to content.blocks when sections don't" wording,
    // when no entry in `sections` is a populated Section, we treat it as
    // "no sections" and serve the legacy content.blocks path.
    const exercise: Exercise = {
      id: 'ex1',
      blocks: JSON.stringify([{ blockType: 'sectionRef', section: 'missing' }]),
      sections: ['missing'] as unknown as Array<string | Section>,
      content: { blocks: [block('legacy')] },
    }

    expect(getExerciseBlocks(exercise).map((b) => b.id)).toEqual(['legacy'])
  })

  it('tolerates playlist as a parsed array (not just a JSON string)', () => {
    const exercise: Exercise = {
      id: 'ex1',
      blocks: [{ blockType: 'sectionRef', section: 's1' }],
      sections: [section('s1', 1, [block('s1-a')])],
    }

    expect(getExerciseBlocks(exercise).map((b) => b.id)).toEqual(['s1-a'])
  })

  it('accepts populated `section` reference object in playlist entries', () => {
    const exercise: Exercise = {
      id: 'ex1',
      blocks: JSON.stringify([{ blockType: 'sectionRef', section: { id: 's1' } }]),
      sections: [section('s1', 1, [block('s1-a')])],
    }

    expect(getExerciseBlocks(exercise).map((b) => b.id)).toEqual(['s1-a'])
  })
})
