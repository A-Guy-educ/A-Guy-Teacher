import { describe, expect, it } from 'vitest'

import { sectionsLookupStage } from '@/server/repos/queries/exercises-with-sections'

describe('sectionsLookupStage', () => {
  it('joins from exercises._id → sections.exercise (reverse relationship)', () => {
    // Exercises have no `sections` field of their own — sections back-point to
    // their parent via `section.exercise`. Joining `localField: 'sections'`
    // matches nothing and silently drops every section on the floor, leaving
    // the renderer with only the exercise's own `content.blocks`.
    expect(sectionsLookupStage()).toEqual({
      $lookup: {
        from: 'sections',
        localField: '_id',
        foreignField: 'exercise',
        as: 'sections',
      },
    })
  })
})
