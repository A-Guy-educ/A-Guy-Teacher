/**
 * @fileType utility
 * @domain exercises
 * @pattern section-blocks-resolver
 * @ai-summary Resolves the block list for an exercise. The flat `getExerciseBlocks()` keeps the legacy single-array read-path (own blocks first, then each populated section's blocks in playlist or `section.order` order). `getExerciseBlockGroups()` is the group-aware variant that tags each chunk with its section index, so renderers can prefix localized "section a / section b" headers. Both helpers cover the legacy `exercise.content.blocks` fallback when no populated sections exist.
 */

import type { ContentBlock, ExerciseBlockGroup } from '@/infra/types/exercise'
import type { Exercise, ExercisePlaylistEntry, Section } from '@/infra/types/content'

/**
 * Pull the inner `blocks` array out of a Section's `content` field. Tolerates
 * either the legacy `ContentBlock[]` shape or the wrapper `{ blocks: [...] }`
 * shape. Returns `[]` when the section has no blocks.
 */
function getSectionBlocks(section: Section): ContentBlock[] {
  const content = section.content
  if (Array.isArray(content)) return content
  if (content && Array.isArray(content.blocks)) return content.blocks
  return []
}

/**
 * Read `exercise.content.blocks` in either the legacy `ContentBlock[]` shape
 * or the `{ blocks: ContentBlock[] }` wrapper. Returns `[]` when missing or
 * in an unrecognised shape.
 */
function getContentBlocks(content: Exercise['content']): ContentBlock[] {
  if (Array.isArray(content)) return content
  if (content && Array.isArray(content.blocks)) return content.blocks
  return []
}

/**
 * Parse `exercise.blocks` into a usable playlist. Tolerates both the raw JSON
 * string (Admin stores it as a textarea) and the already-parsed array. Returns
 * `[]` for missing/garbage values.
 */
function parsePlaylist(raw: Exercise['blocks']): ExercisePlaylistEntry[] {
  if (Array.isArray(raw)) return raw as ExercisePlaylistEntry[]
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ExercisePlaylistEntry[]) : []
  } catch {
    return []
  }
}

/**
 * Return the section id for a playlist entry, or `null` if it isn't a
 * `sectionRef` or has no resolvable id.
 */
function playlistSectionId(entry: ExercisePlaylistEntry): string | null {
  if (!entry || entry.blockType !== 'sectionRef') return null
  const ref = entry.section
  if (typeof ref === 'string' && ref.length > 0) return ref
  if (ref && typeof ref === 'object') {
    const id = (ref as { id?: unknown }).id
    if (typeof id === 'string' && id.length > 0) return id
  }
  return null
}

/**
 * Reduce `exercise.sections` to only populated `Section` objects. Returns
 * `null` when none of the entries are populated — caller should treat that as
 * "no sections to resolve" and fall back to `exercise.content.blocks` per the
 * issue's spec.
 */
function populatedSections(sections: Exercise['sections']): Section[] | null {
  if (!Array.isArray(sections) || sections.length === 0) return null
  const populated = sections.filter(
    (entry): entry is Section =>
      !!entry && typeof entry === 'object' && typeof entry.id === 'string',
  )
  return populated.length > 0 ? populated : null
}

/**
 * Return the populated `Section` whose id matches the given playlist id.
 * Skips string-only entries — they don't carry block content.
 */
function findPopulatedSection(sections: Section[], id: string): Section | null {
  for (const entry of sections) {
    if (entry.id === id) return entry
  }
  return null
}

/**
 * Order populated sections for rendering. Mirrors the legacy logic exactly:
 * playlist order (`exercise.blocks` sectionRef entries) takes priority; if no
 * playlist is present (or no entry is a `sectionRef`), fall back to
 * `section.order` ascending with undefined orders pushed to the end.
 */
function orderedPopulatedSections(
  playlist: ExercisePlaylistEntry[],
  populated: Section[],
): Section[] {
  const sectionRefEntries = playlist.filter((entry) => entry?.blockType === 'sectionRef')
  if (sectionRefEntries.length > 0) {
    const ordered: Section[] = []
    for (const entry of sectionRefEntries) {
      const id = playlistSectionId(entry)
      if (!id) continue
      const section = findPopulatedSection(populated, id)
      if (section && !ordered.includes(section)) ordered.push(section)
    }
    if (ordered.length > 0) return ordered
  }
  return [...populated].sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY
    const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY
    return ao - bo
  })
}

/**
 * Resolve the section groups for an exercise. Each populated section becomes
 * one group with `sectionIndex` starting at 0 (the letter label renderers
 * derive from this). The exercise's own `content.blocks` is intentionally
 * NOT included here — it is the caller's job to prepend it as the
 * `sectionIndex: null` group so the "own blocks first" ordering matches the
 * issue's spec.
 */
function resolveSectionGroups(exercise: Exercise): ExerciseBlockGroup[] {
  const playlist = parsePlaylist(exercise.blocks)
  const populated = populatedSections(exercise.sections)
  if (!populated) return []
  const ordered = orderedPopulatedSections(playlist, populated)
  return ordered.map((section, idx) => ({
    blocks: getSectionBlocks(section),
    sectionIndex: idx,
  }))
}

/**
 * Resolve the grouped block list for an exercise, in the order the renderer
 * must display them:
 *
 *   1. The exercise's own `content.blocks` (if any), tagged with
 *      `sectionIndex: null` so the renderer omits the section header.
 *   2. Each populated section's `content.blocks`, tagged with `sectionIndex`
 *      0, 1, 2, ... in the same order `getExerciseBlocks()` already uses
 *      (playlist order from `exercise.blocks` sectionRef entries, falling
 *      back to `section.order` ascending).
 *
 * Empty own blocks yield no leading group (matches the legacy "no section
 * header prefix" requirement for exercises whose only blocks live in
 * sections). Sections that resolve to empty block lists are still emitted —
 * a section header with no body is fine, and it preserves the index-to-letter
 * mapping across the rest of the exercise.
 *
 * Returns `[]` when the exercise is missing or has no blocks anywhere.
 */
export function getExerciseBlockGroups(
  exercise: Exercise | null | undefined,
): ExerciseBlockGroup[] {
  if (!exercise) return []

  const ownBlocks = getContentBlocks(exercise.content)
  const groups: ExerciseBlockGroup[] = []

  if (ownBlocks.length > 0) {
    groups.push({ blocks: ownBlocks, sectionIndex: null })
  }

  groups.push(...resolveSectionGroups(exercise))
  return groups
}

/**
 * Resolve the flat list of blocks for an exercise — own `content.blocks`
 * first, then each populated section's `content.blocks` in playlist or
 * `section.order` order.
 *
 * When the exercise has no populated sections at all (legacy shape), the
 * exercise's own `content.blocks` is returned as-is. When sections exist but
 * none are populated (string-only ids or missing entries), we still keep
 * `content.blocks` so exercises mid-migration keep rendering instead of
 * going blank.
 *
 * Returns `[]` when nothing is found, never `undefined`.
 */
export function getExerciseBlocks(exercise: Exercise | null | undefined): ContentBlock[] {
  const groups = getExerciseBlockGroups(exercise)
  if (groups.length === 0) {
    // No populated sections (string-only ids or absent). Preserve the legacy
    // raw passthrough so mid-migration exercises still render.
    if (!exercise) return []
    return getContentBlocks(exercise.content)
  }
  const out: ContentBlock[] = []
  for (const group of groups) {
    out.push(...group.blocks)
  }
  return out
}
