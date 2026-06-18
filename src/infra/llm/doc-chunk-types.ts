/**
 * Shared types for documentation chunks
 * Used by both the doc-search module and the chunk generation script
 *
 * @ai-summary Both the DocSearch class and the generate-doc-chunks.ts script must agree on this shape. If you add a field here, update both consumers. priority is a number (higher = more important) used by DocSearch's relevance scoring.
 */

export interface DocChunk {
  id: string
  title: string
  content: string
  keywords: string[]
  category: string
  sourceFile: string
  startLine?: number
  endLine?: number
  priority: number // Higher = more important
}

export interface DocChunks {
  chunks: DocChunk[]
  metadata: {
    generatedAt: string
    totalChunks: number
    sourceFiles: string[]
  }
}
