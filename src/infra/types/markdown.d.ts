/**
 * @fileType utility
 * @domain types
 * @pattern markdown-types
 * @ai-summary Module augmentation enabling `import.meta.url` resolution for .md files in the app bundle. Only applies to files processed by the bundler (Vite/Next.js); do not assume these are present in Payload's server runtime.
 */
declare module '*.md' {
  const content: string
  export default content
}
