/**
 * Shared Storage Configuration
 * Single source of truth for local media paths.
 */
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const MEDIA_SUBDIR = path.resolve(dirname, '../../../public/media')

/**
 * Absolute path to local media storage directory
 */
export const MEDIA_STORAGE_DIR = MEDIA_SUBDIR

/**
 * Public URL path prefix for media files
 */
export const MEDIA_PUBLIC_URL = '/api/media/file'

/**
 * Resolve absolute filesystem path for a media file
 */
export function resolveMediaFilePath(filename: string): string {
  if (!filename) {
    throw new Error('Filename is required to resolve media path')
  }
  return path.resolve(MEDIA_STORAGE_DIR, filename)
}

/**
 * Resolve public URL for a media file
 * Supports both absolute URLs (with baseUrl) and relative URLs (fallback)
 */
export function resolveMediaPublicUrl(filename: string, baseUrl?: string): string {
  if (!filename) {
    throw new Error('Filename is required to resolve media URL')
  }
  const base = baseUrl || process.env.NEXT_PUBLIC_SERVER_URL
  if (base) {
    // Absolute URL (preferred for serverless)
    return `${base}${MEDIA_PUBLIC_URL}/${filename}`
  }
  // Fallback to relative URL (local dev only)
  return `${MEDIA_PUBLIC_URL}/${filename}`
}
