/**
 * @fileType utility
 * @domain ui
 * @pattern svg-normalization
 * @ai-summary Adds a viewBox to an SVG when the author omitted one, so the SVG scales predictably inside responsive containers.
 */

/**
 * Inject a `viewBox` into an SVG root tag when one is missing.
 *
 * WHY: Author-uploaded SVGs frequently declare only `width` / `height` and
 * omit `viewBox`. When such an SVG is rendered inside a container that forces
 * a different display size (e.g. Next.js `<Image>` with declared dimensions
 * plus `max-w-full h-auto`), browsers have no rule for mapping the SVG's
 * internal coordinates into the resized box — text and shapes drift out of
 * position. Deriving a viewBox from the intrinsic width/height makes the SVG
 * scale as a coherent unit at any display size.
 *
 * Behaviour:
 *  - No `<svg>` tag found → returned unchanged.
 *  - Root tag already has a `viewBox` → returned unchanged.
 *  - `width` or `height` missing / non-numeric → returned unchanged (nothing
 *    we can safely infer).
 *  - Otherwise → returns the SVG with `viewBox="0 0 <width> <height>"`
 *    inserted onto the root tag.
 *
 * The function is intentionally string-based (regex on the root tag) rather
 * than DOM-based so it runs on the server and does not depend on `window`.
 */
export function ensureSvgViewBox(svg: string): string {
  const openTagMatch = svg.match(/<svg\b[^>]*>/i)
  if (!openTagMatch) return svg

  const openTag = openTagMatch[0]
  if (/\bviewBox\s*=/i.test(openTag)) return svg

  const width = openTag.match(/\bwidth\s*=\s*["']?([\d.]+)/i)?.[1]
  const height = openTag.match(/\bheight\s*=\s*["']?([\d.]+)/i)?.[1]
  if (!width || !height) return svg

  const patchedTag = openTag.replace(/<svg\b/i, `<svg viewBox="0 0 ${width} ${height}"`)
  return svg.replace(openTag, patchedTag)
}
