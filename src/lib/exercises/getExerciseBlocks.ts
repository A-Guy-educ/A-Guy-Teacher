/**
 * @fileType utility
 * @domain exercises
 * @pattern section-blocks-resolver
 * @ai-summary Resolves the flat block list for an exercise by preferring populated child sections (in playlist or `section.order` order) and falling back to the legacy `exercise.content.blocks`. This is the single read-path for exercise blocks in the web app — every renderer / consumer goes through here so we can swap the Admin aggregator off once prod has baked.
 */

import type { ContentBlock } from '@/infra/types/exercise'
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
 * Resolve the flat list of blocks for an exercise.
 *
 * Resolution order:
 *   1. If the exercise has a non-empty playlist (from `exercise.blocks`) AND
 *      populated child sections (`exercise.sections`), emit each listed
 *      section's `content.blocks` in playlist order. Sections that aren't
 *      populated (string-only ids, or missing from the array) are silently
 *      skipped — the playlist is the authoritative order.
 *   2. If the exercise has populated sections but no playlist, emit them in
 *      `section.order` ascending (then undefined orders at the end).
 *   3. Otherwise fall back to `exercise.content.blocks` (covers all
 *      legacy / not-yet-migrated exercises — the Admin aggregator currently
 *      back-fills this field, but we don't depend on it; also kicks in when
 *      `sections` is set but no entry is populated, per the issue's "fall back
 *      to content.blocks when sections don't [exist]" wording).
 *
 * Returns `[]` when nothing is found, never `undefined`.
 */
export function getExerciseBlocks(exercise: Exercise | null | undefined): ContentBlock[] {
  if (!exercise) return []

  const playlist = parsePlaylist(exercise.blocks)
  const populated = populatedSections(exercise.sections)

  // Path 1: playlist + populated sections → playlist order.
  if (playlist.length > 0 && populated) {
    const out: ContentBlock[] = []
    for (const entry of playlist) {
      const id = playlistSectionId(entry)
      if (!id) continue
      const section = findPopulatedSection(populated, id)
      if (!section) continue
      out.push(...getSectionBlocks(section))
    }
    if (out.length > 0) return out
  }

  // Path 2: populated sections, no playlist → section.order ascending.
  if (populated) {
    const sorted = [...populated].sort((a, b) => {
      const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY
      const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY
      return ao - bo
    })
    const out: ContentBlock[] = []
    for (const section of sorted) {
      out.push(...getSectionBlocks(section))
    }
    if (out.length > 0) return out
  }

  // Path 3: legacy fallback — read `exercise.content.blocks` as-is.
  const content = exercise.content
  if (Array.isArray(content)) return content
  if (content && Array.isArray(content.blocks)) return content.blocks
  return []
}
