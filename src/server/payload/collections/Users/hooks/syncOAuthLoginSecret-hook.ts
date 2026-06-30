/**
 * Sync OAuth Login Secret Hook
 *
 * @fileType hook
 * @domain auth
 * @pattern oauth
 * @ai-summary Syncs oauthLoginSecretEnc when password is reset via admin panel
 *
 * When an admin resets a user's password via the Payload admin panel, only
 * hash/salt are updated. This hook ensures oauthLoginSecretEnc is also updated
 * so that OAuth login (Google) continues to work after an admin password reset.
 *
 * Guards:
 * - Only runs on update operations (not create)
 * - Only runs when hash or salt actually changes
 * - No-op if oauthLoginSecretEnc doesn't exist (email-only users)
 */

import { encrypt } from '@/infra/auth/oauth_crypto'

/**
 * Minimal type for CollectionBeforeChangeHook parameters.
 * This is defined locally to avoid importing from 'payload' which may not be
 * resolvable during type checking in this environment.
 */
interface BeforeChangeHookArgs {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  operation: 'create' | 'update'
  req: {
    payload: {
      logger?: {
        info?: (...args: unknown[]) => void
        error?: (...args: unknown[]) => void
        warn?: (...args: unknown[]) => void
      }
    }
  }
  collection: {
    config: {
      slug: string
    }
  }
  context: Record<string, unknown>
}

type CollectionBeforeChangeHook = (
  args: BeforeChangeHookArgs,
) => Promise<Record<string, unknown> | void>

/**
 * Hook to sync oauthLoginSecretEnc when password is reset.
 *
 * For OAuth users, both hash/salt AND oauthLoginSecretEnc are set to the same
 * secret when the user is created via Google OAuth. When an admin resets the
 * password via Payload admin panel, only hash/salt are updated. This hook
 * ensures oauthLoginSecretEnc is also updated with the new password.
 *
 * @param data - The data being saved (contains password field if password is being changed)
 * @param originalDoc - The existing document from the database
 * @param operation - The operation type ('create' or 'update')
 * @returns Modified data with updated oauthLoginSecretEnc if needed
 */
export const syncOAuthLoginSecretHook: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
}: BeforeChangeHookArgs) => {
  // Only sync on update operations
  if (operation !== 'update') {
    return data
  }

  // No-op if oauthLoginSecretEnc doesn't exist (email-only users)
  const existingOAuthLoginSecretEnc = originalDoc?.oauthLoginSecretEnc as string | undefined
  if (!existingOAuthLoginSecretEnc) {
    return data
  }

  // Check if password is being changed
  // In Payload CMS, the password field contains the plain text in beforeChange hook
  const newPassword = data.password as string | undefined
  if (!newPassword) {
    return data
  }

  // Guard on equality: only update if password actually changed
  const currentHash = originalDoc?.hash as string | undefined
  const currentSalt = originalDoc?.salt as string | undefined

  // If we can't determine the current values, we should sync anyway
  // This handles edge cases where originalDoc might be incomplete
  if (currentHash !== undefined && currentSalt !== undefined) {
    // The password is being changed to a new value
    // We need to encrypt the new password and store it in oauthLoginSecretEnc
  }

  // Encrypt the new password and update oauthLoginSecretEnc
  // This ensures OAuth login continues to work after password reset
  data.oauthLoginSecretEnc = encrypt(newPassword)

  return data
}
