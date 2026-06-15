/**
 * @fileType types
 * @domain exercises
 * @ai-summary Shared types for the LaTeX parser output: LatexToken (lexer output), ParseResult/Warning/Error (pipeline result), and ExerciseGroup/MultiExerciseResult (multi-exercise grouping).
 */

import type { ContentBlock } from '@/infra/types/exercise'

export interface ParseWarning {
  line: number
  message: string
  rawLatex: string
}

export interface ParseError {
  line: number
  message: string
  rawLatex: string
}

export interface ParseResult {
  blocks: ContentBlock[]
  warnings: ParseWarning[]
  errors: ParseError[]
}

export interface ExerciseGroup {
  title: string
  number: number
  blocks: ContentBlock[]
}

export interface MultiExerciseResult {
  exercises: ExerciseGroup[]
  warnings: ParseWarning[]
  errors: ParseError[]
}

export interface LatexToken {
  type: 'environment' | 'command' | 'text' | 'math'
  value: string
  line: number
  children?: LatexToken[]
  name?: string // environment name or command name
}
