/**
 * Unit tests: syncOAuthLoginSecretHook
 *
 * Tests that the beforeChange hook properly syncs oauthLoginSecretEnc when
 * password is reset via admin panel.
 *
 * P0 — OAuth users get locked out after admin password reset
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'

import { syncOAuthLoginSecretHook } from '@/server/payload/collections/Users/hooks/syncOAuthLoginSecret-hook'
import { encrypt, decrypt } from '@/infra/auth/oauth_crypto'

// Mock PAYLOAD_SECRET for tests
vi.mock('@/infra/auth/oauth_crypto', async () => {
  const actual = await vi.importActual('@/infra/auth/oauth_crypto')
  return {
    ...actual,
    encrypt: vi.fn((plain: string) => `encrypted:${plain}`),
    decrypt: vi.fn((encrypted: string) => encrypted.replace('encrypted:', '')),
  }
})

// Helper to create minimal CollectionBeforeChangeHook args
const createHookArgs = (overrides: Record<string, unknown> = {}) => {
  return {
    data: {},
    req: {
      payload: {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
        },
      },
    },
    operation: 'update' as const,
    originalDoc: {},
    collection: { config: { slug: 'users' } },
    context: {},
    ...overrides,
  }
}

describe('syncOAuthLoginSecretHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('OAuth user password sync', () => {
    it('should encrypt new password and update oauthLoginSecretEnc when password changes', async () => {
      const originalSecret = 'original-oauth-secret-123'
      const newPassword = 'new-admin-password-456'

      const hookArgs = createHookArgs({
        operation: 'update',
        data: { password: newPassword },
        originalDoc: {
          hash: 'hashed-old-password',
          salt: 'old-salt',
          oauthLoginSecretEnc: encrypt(originalSecret),
        },
      })

      const result = await syncOAuthLoginSecretHook(
        hookArgs as Parameters<CollectionBeforeChangeHook>[0],
      )

      expect(result.oauthLoginSecretEnc).toBeDefined()
      expect(result.oauthLoginSecretEnc).toBe(`encrypted:${newPassword}`)
    })

    it('should NOT update oauthLoginSecretEnc when password field is not present', async () => {
      const originalSecret = 'original-oauth-secret-123'
      const originalEncrypted = encrypt(originalSecret)

      const hookArgs = createHookArgs({
        operation: 'update',
        data: { name: 'Updated Name' }, // password not being changed
        originalDoc: {
          hash: 'hashed-old-password',
          salt: 'old-salt',
          oauthLoginSecretEnc: originalEncrypted,
        },
      })

      const result = await syncOAuthLoginSecretHook(
        hookArgs as Parameters<CollectionBeforeChangeHook>[0],
      )

      // oauthLoginSecretEnc should not be modified
      expect(result.oauthLoginSecretEnc).toBeUndefined()
    })

    it('should be no-op when oauthLoginSecretEnc does not exist (email-only user)', async () => {
      const hookArgs = createHookArgs({
        operation: 'update',
        data: { password: 'new-password' },
        originalDoc: {
          hash: 'hashed-old-password',
          salt: 'old-salt',
          // No oauthLoginSecretEnc - email-only user
        },
      })

      const result = await syncOAuthLoginSecretHook(
        hookArgs as Parameters<CollectionBeforeChangeHook>[0],
      )

      // oauthLoginSecretEnc should not be set
      expect(result.oauthLoginSecretEnc).toBeUndefined()
    })
  })

  describe('Operation type guards', () => {
    it('should return data unchanged on create operations', async () => {
      const hookArgs = createHookArgs({
        operation: 'create',
        data: { email: 'new@example.com', password: 'password123' },
        originalDoc: {},
      })

      const result = await syncOAuthLoginSecretHook(
        hookArgs as Parameters<CollectionBeforeChangeHook>[0],
      )

      // Should return data unchanged - no oauthLoginSecretEnc should be set on create
      expect(result.oauthLoginSecretEnc).toBeUndefined()
    })

    it('should process update operations normally', async () => {
      const hookArgs = createHookArgs({
        operation: 'update',
        data: { password: 'new-password' },
        originalDoc: {
          oauthLoginSecretEnc: encrypt('old-secret'),
        },
      })

      const result = await syncOAuthLoginSecretHook(
        hookArgs as Parameters<CollectionBeforeChangeHook>[0],
      )

      expect(result.oauthLoginSecretEnc).toBeDefined()
    })
  })

  describe('Edge cases', () => {
    it('should handle missing originalDoc fields gracefully', async () => {
      const hookArgs = createHookArgs({
        operation: 'update',
        data: { password: 'new-password' },
        originalDoc: {
          // Missing hash and salt - but oauthLoginSecretEnc exists
          oauthLoginSecretEnc: encrypt('some-secret'),
        },
      })

      // Should not throw
      const result = await syncOAuthLoginSecretHook(
        hookArgs as Parameters<CollectionBeforeChangeHook>[0],
      )

      // Should still update oauthLoginSecretEnc
      expect(result.oauthLoginSecretEnc).toBeDefined()
    })

    it('should handle undefined data.password gracefully', async () => {
      const hookArgs = createHookArgs({
        operation: 'update',
        data: {}, // No password field
        originalDoc: {
          hash: 'some-hash',
          salt: 'some-salt',
          oauthLoginSecretEnc: encrypt('some-secret'),
        },
      })

      const result = await syncOAuthLoginSecretHook(
        hookArgs as Parameters<CollectionBeforeChangeHook>[0],
      )

      // Should return data unchanged
      expect(result.oauthLoginSecretEnc).toBeUndefined()
    })
  })
})
