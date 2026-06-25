/**
 * @fileType utility
 * @domain types
 * @pattern env-types
 * @ai-summary NodeJS global ProcessEnv augmentation for server-only environment variables. Variables without NEXT_PUBLIC_ are server-only — leaking them to the client bundle is a security risk. Do not add client-safe vars here; add them to next.config.mjs env instead.
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URL: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string

      // Analytics (only keys/tokens - presence enables the platform)
      NEXT_PUBLIC_GA4_MEASUREMENT_ID?: string
      NEXT_PUBLIC_MIXPANEL_TOKEN?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
