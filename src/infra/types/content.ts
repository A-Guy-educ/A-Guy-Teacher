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
  pageAccessType?: string | null
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
}

export interface Product {
  id: string
  title: string
  name?: string | null
  slug?: string | null
  description?: string | null
  isActive?: boolean | null
  price?: number | null
  currency?: string | null
  billingType?: string | null
  interval?: string | null
  items?: Array<string | ProductItem> | null
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

export interface Footer {
  navItems?: unknown[] | null
  variants?: Array<{ locale?: string | null; navItems?: unknown[] | null }> | null
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
