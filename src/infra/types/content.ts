/**
 * @fileType utility
 * @domain types
 * @pattern content-model
 * @ai-summary Core content-domain types mirroring Payload collections (Course, Lesson, Exercise, etc.). These are hand-written shapes used throughout the app — they drift from the generated Payload types over time. Keep them minimal; prefer importing generated types where Payload owns the schema.
 */

import type { ContentBlock } from './exercise'

export type ContentLocale = 'en' | 'he'

export const CONTENT_LOCALES = ['en', 'he'] as const
export const DEFAULT_CONTENT_LOCALE: ContentLocale = 'he'

export function isValidContentLocale(value: string): value is ContentLocale {
  return CONTENT_LOCALES.includes(value as ContentLocale)
}

export interface Media {
  id: string
  type?: string | null
  alt?: string | null
  url?: string | null
  filename?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
  filesize?: number | null
  updatedAt?: string | null
  mediaType?: 'image' | 'video' | 'audio' | 'pdf' | 'svg' | 'document' | 'external' | 'other' | null
  externalUrl?: string | null
  embedUrl?: string | null
  poster?: string | Media | null
}

export interface Meta {
  title?: string | null
  description?: string | null
  image?: string | Media | null
}

export interface Hero {
  type?: 'none' | 'highImpact' | 'mediumImpact' | 'lowImpact' | string | null
  links?: unknown[] | null
  richText?: unknown
  media?: string | Media | null
}

export interface Page {
  id: string
  title?: string | null
  slug?: string | null
  hero?: Hero | null
  layout?: unknown[] | null
  defaultBlockSpacing?: string | null
  meta?: Meta | null
  updatedAt?: string | null
}

export interface Category {
  id?: string | null
  title?: string | null
}

export interface Post {
  id: string
  title?: string | null
  slug?: string | null
  content?: unknown
  categories?: Category[] | null
  relatedPosts?: Array<Post | string | null> | null
  heroImage?: string | Media | null
  meta?: Meta | null
  updatedAt?: string | null
}

export type ContentStatus = 'none' | 'soon' | 'justAdded' | 'custom' | null

export interface Course {
  id: string
  title: string
  slug?: string | null
  description?: string | null
  courseLabel?: string | null
  order?: number | null
  status?: string | null
  isActive?: boolean | null
  contentStatus?: ContentStatus
  contentStatusVisible?: boolean | null
  contentStatusExpiresAt?: string | null
  contentStatusLabel?: string | null
  accessType?: string | null
  formulaSheet?: string | FormulaSheet | null
  categories?: Category[] | null
  meta?: Meta | null
}

export interface Chapter {
  id: string
  title: string
  slug?: string | null
  description?: string | null
  chapterLabel?: string | null
  course?: string | Course | null
  order?: number | null
  status?: string | null
  isActive?: boolean | null
}

export interface Lesson {
  id: string
  title: string
  slug?: string | null
  chapter?: string | Chapter | null
  order?: number | null
  description?: string | null
  type?: 'learning' | 'practice' | 'exam' | string | null
  lessonType?: string | null
  lessonContentType?: string | null
  accessType?: string | null
  lessonContextText?: string | null
  contentFiles?: Array<string | Media> | null
  visibleRenderers?: string[] | null
  content?: unknown
  blocks?: unknown
  media?: string | Media | null
  formulaSheet?: string | FormulaSheet | null
  status?: string | null
  isActive?: boolean | null
  contentStatus?: ContentStatus
  contentStatusExpiresAt?: string | null
  contentStatusLabel?: string | null
  tenant?: string | Tenant | null
  meta?: Meta | null
  prerequisites?: Array<string | Lesson> | null
}

/**
 * Minimal lesson info needed to render a prerequisite row with a link.
 */
export interface LessonPrerequisite {
  id: string
  title: string
  slug: string
  chapterSlug: string
  courseSlug: string
}

export interface Exercise {
  id: string
  title?: string | null
  slug?: string | null
  lesson?: string | Lesson | null
  content?: ContentBlock[] | { blocks?: ContentBlock[] | null } | null
  media?: Array<string | Media> | null
  difficulty?: string | null
  order?: number | null
  showQuestionNumbering?: boolean | null
}

export interface ContentPage {
  id: string
  title?: string | null
  slug?: string | null
  content?: unknown
  layout?: unknown[] | null
  body?: unknown
}

export interface FormulaSheet {
  id: string
  title?: string | null
  locale?: ContentLocale | null
  contentType?: 'pdf' | 'richText' | 'blocks' | string | null
  content?: unknown
  file?: string | Media | null
  pdfFile?: string | Media | null
  bodyBlocks?: Array<Record<string, unknown>> | null
}

export interface ProductItem {
  id: string
  title?: string | null
  description?: string | null
  price?: number | null
  type?: 'lesson' | 'feature' | null
  featureKey?: string | null
  lesson?: { title?: string | null } | null
}

/**
 * Lightweight populated shapes returned by the product query after expanding
 * the `course` and `feature` relationships on the inline contents blocks.
 * Kept narrow on purpose — the storefront only needs display fields.
 */
export interface ProductCourseRef {
  id: string
  title?: string | null
  slug?: string | null
}

export interface ProductFeatureRef {
  id: string
  key?: string | null
  label?: string | null
  type?: 'numeric' | 'boolean' | string | null
  isSilent?: boolean | null
}

/**
 * New product composition shape (post-Task-A in admin). Replaces the legacy
 * `items: ProductItem[]` field. Each block is either a courseBlock (grants
 * access to a course) or a featureBlock (grants a feature entitlement).
 */
export type ProductContentBlock =
  | {
      blockType: 'courseBlock'
      course: ProductCourseRef | string
      lessonTypes?: Array<'learning' | 'practice' | 'exam'> | null
    }
  | {
      blockType: 'featureBlock'
      feature: ProductFeatureRef | string
      limit?: number | null
      period?: 'day' | 'lifetime' | null
    }

/**
 * Single source of truth for "is this relation populated?" — used by BOTH the
 * server-side populator (skip re-fetching) and the client-side renderer
 * (skip rendering bare-id blocks). Checks `'id' in value` because every
 * populated doc has an `id` after `serializeDoc` runs, regardless of what
 * other fields the projection happened to include. Any narrower predicate
 * (e.g. checking 'title' / 'label') breaks if someone changes the projection.
 *
 * The check is intentionally structural rather than nominal. We trust this
 * because the only producers of these objects today are `serializeDoc` (server
 * side, inside this repo) and the storefront renderer (consumer only, never
 * mutates). If a future caller ever feeds user-supplied JSON through this
 * predicate, tighten the contract — until then, structural is fine.
 */
export function isPopulatedCourseRef(value: unknown): value is ProductCourseRef {
  // Tighter than `'id' in value` — also requires the id to actually be a
  // string. Pure structural-key checks would let `{ id: null }` through and
  // make the type narrowing unsound. Cheap defensive guard for the day this
  // predicate is pointed at JSON we don't fully control.
  return !!value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'
}

export function isPopulatedFeatureRef(value: unknown): value is ProductFeatureRef {
  return !!value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'
}

/**
 * Storefront classification. Drives the split between the big featured cards
 * (Section 1) and the disabled "בקרוב" compact grid (Section 2) on /products.
 *
 * - 'active' → buyable now, featured card with "לרכישה מיידית" CTA
 * - 'soon'   → not yet available, compact grid with disabled "בקרוב" button
 * - 'free'   → free product; same compact-grid treatment as soon
 * - null/missing with isActive=false → also treated as soon
 */
export type ProductStatus = 'active' | 'soon' | 'free' | null

export const ACTIVE_PRODUCT_STATUS: ProductStatus = 'active'

export interface Product {
  id: string
  title: string
  name?: string | null
  slug?: string | null
  description?: string | null
  isActive?: boolean | null
  /**
   * Storefront status. See ProductStatus. When null and isActive is true, the
   * storefront treats the product as 'active' (backward compatible with
   * pre-#718 data where only isActive existed).
   */
  status?: ProductStatus
  price?: number | null
  currency?: string | null
  billingType?: string | null
  interval?: string | null
  /**
   * Legacy field — pre-Task-A schema used a flat ProductItems[] join. Newer
   * products use `contents` instead, and the storefront no longer RENDERS
   * `items` anywhere.
   *
   * Caveat: still read by `src/app/api/payments/checkout/route.ts` via
   * `resolveProductItems(product.items)` to compute
   * `transaction.metadata.{itemIds,featureKeys}`. That metadata is
   * informational only — admin's webhook handler grants entitlements by
   * walking `product.contents` directly, not by reading the metadata — so
   * the field being empty on new-shape products doesn't break enrollment.
   * But the call site exists. Migrate it to `contents` (or just drop the
   * metadata fields entirely) before removing `items` here.
   */
  items?: Array<string | ProductItem> | null
  contents?: ProductContentBlock[] | null
  meta?: Meta | null
}

export interface Transaction {
  id: string
  amount?: number | null
  currency?: string | null
  status?: string | null
  provider?: string | null
  createdAt?: string | null
}

export interface User {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  roles?: string[] | null
  collection?: string
}

export interface Header {
  navItems?: unknown[] | null
  variants?: Array<{ locale?: string | null; navItems?: unknown[] | null }> | null
}

export interface FooterMeta {
  image?: string | Media | null
  titleColumn?: string | null
  subtitleColumn?: string | null
  introColumn?: string | null
  contact?: {
    email?: string | null
    phone?: string | null
    address?: string | null
  } | null
}

export interface Footer {
  navItems?: unknown[] | null
  variants?: Array<{ locale?: string | null; navItems?: unknown[] | null }> | null
  meta?: FooterMeta | null
  text?: string | null
}

export interface CallToActionBlock {
  id?: string | null
  links?: unknown[] | null
  richText?: unknown
}

export interface Tenant {
  id: string
  slug?: string | null
  name?: string | null
}

export type Config = any
export type ContextExtraction = any
export type Conversation = any
export type ExerciseAsset = any
export type Form = any
export type FormSubmission = any
export type GuestSession = any
export type MemoryItem = any
export type PricingPlan = any
export type Prompt = any
export type Redirect = { from: string; to?: { url?: string | null } | null }
export type Search = any
export type UserSetting = any
