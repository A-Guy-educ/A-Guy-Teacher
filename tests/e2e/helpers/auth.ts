/**
 * Test helpers for authentication and user management.
 *
 * These used to drive Payload's Local API. Payload was removed from the
 * project, which left every helper here throwing on import — and with it every
 * browser test that needs a signed-in user. They now use the same functions the
 * application itself uses to create users and issue sessions, so a test session
 * is a real one rather than a lookalike.
 */
import { Page } from '@playwright/test'

import { getContentDb, objectIdFromString } from '@/infra/db/content-db'
import {
  AUTH_COOKIE_NAME,
  createPasswordUser,
  findUserByEmail,
  loginWithPassword,
} from '@/infra/auth/web-auth'

export interface TestUser {
  email: string
  password: string
  id?: string
}

// Registry to track test users created during E2E tests for cleanup
const testUserRegistry: Set<string> = new Set()

/**
 * Generate a unique test user email
 */
export function generateTestUserEmail(prefix = 'e2e-test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@example.com`
}

async function setRole(userId: string, role: 'admin' | 'student'): Promise<void> {
  const db = await getContentDb()
  await db.collection('users').updateOne({ _id: objectIdFromString(userId) } as never, {
    $set: { role, updatedAt: new Date() },
  })
}

/**
 * Create a test user, or reuse one that already exists, and register it for
 * cleanup. Passwords are hashed by `createPasswordUser`, exactly as a real
 * signup would.
 */
export async function createTestUser(
  user: TestUser,
  role: 'admin' | 'student' = 'student',
): Promise<TestUser> {
  const existing = await findUserByEmail(user.email)

  if (existing) {
    const id = String(existing._id)
    if (existing.role !== role) await setRole(id, role)
    testUserRegistry.add(id)
    return { ...user, id }
  }

  const created = await createPasswordUser({
    name: user.email.split('@')[0] || 'Test User',
    email: user.email,
    password: user.password,
  })

  if (!created) throw new Error(`Could not create test user ${user.email}`)

  const id = created.user.id
  if (created.user.role !== role) await setRole(id, role)
  testUserRegistry.add(id)

  return { ...user, id }
}

/**
 * Authenticate a user via signup page
 * This creates the user if they don't exist and logs them in
 */
export async function authenticateViaSignup(page: Page, user: TestUser): Promise<void> {
  // Navigate to signup page
  await page.goto('/signup')
  await page.waitForLoadState('networkidle')

  // Wait for form to be visible
  await page.waitForSelector('input[name="name"]', { timeout: 10000 })

  // Fill signup form
  await page.fill('input[name="name"]', user.email.split('@')[0])
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.fill('input[name="confirmPassword"]', user.password)

  // Submit form - wait for navigation or error
  await Promise.race([
    page.waitForURL(/\//, { timeout: 15000 }), // Success: redirect to home
    page
      .waitForSelector('text=/account created|already exists|error/i', { timeout: 5000 })
      .catch(() => null), // Error message
  ])

  // Check if we're on home page (success) or still on signup (might be error)
  const currentUrl = page.url()
  if (!currentUrl.includes('/signup')) {
    // Successfully redirected
    return
  }

  // If still on signup page, check for error - might be duplicate email
  const errorText = await page.locator('body').textContent()
  if (errorText?.includes('already exists') || errorText?.includes('already registered')) {
    // User exists, will need to login instead
    throw new Error('User already exists')
  }

  // Wait a bit more for redirect
  await page.waitForTimeout(2000)
  if (!page.url().includes('/signup')) {
    return
  }

  throw new Error('Signup failed - still on signup page')
}

/**
 * Sign a user in by minting a real session and setting its cookie.
 *
 * More reliable than driving the login form, and it exercises the same token
 * the application issues — so a session that would not work in the browser
 * does not work here either.
 */
export async function authenticateViaAPI(page: Page, user: TestUser): Promise<void> {
  const session = await loginWithPassword(user.email, user.password)
  if (!session?.token) throw new Error('Invalid credentials')

  await page.context().addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: session.token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false, // localhost doesn't need secure
      sameSite: 'Lax',
    },
  ])

  const cookies = await page.context().cookies()
  if (!cookies.some((cookie) => cookie.name === AUTH_COOKIE_NAME)) {
    throw new Error('Failed to set auth cookie')
  }
}

/**
 * Authenticate a user via admin login
 * @deprecated Use authenticateViaAPI instead - more reliable
 */
export async function authenticateViaAdminLogin(page: Page, user: TestUser): Promise<void> {
  return authenticateViaAPI(page, user)
}

/**
 * Delete a test user and the rows that hang off it.
 *
 * Best-effort: a failure here should not fail the test that already passed.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  if (!userId) return

  try {
    const db = await getContentDb()
    const userIds = [userId, objectIdFromString(userId)]

    await db.collection('memory_items').deleteMany({ userId: { $in: userIds } } as never)
    await db.collection('conversations').deleteMany({ user: { $in: userIds } } as never)
    await db.collection('users').deleteOne({ _id: objectIdFromString(userId) } as never)

    testUserRegistry.delete(userId)
  } catch (error) {
    console.warn(`Failed to delete test user ${userId}:`, error)
  }
}

/**
 * Clean up all registered test users
 * Call this in afterAll hooks
 */
export async function cleanupTestUsers(): Promise<void> {
  const userIds = Array.from(testUserRegistry)
  testUserRegistry.clear()

  await Promise.all(userIds.map((id) => deleteTestUser(id)))
}

/** Middleware picks Hebrew by default, so tests see the same content users do. */
async function setHebrewLocale(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'NEXT_LOCALE',
      value: 'he',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

/**
 * Get or create a test user and sign them in.
 *
 * Falls back to the signup form if minting a session fails — usually because
 * the account exists from an earlier run with a different password.
 */
export async function setupAuthenticatedUser(
  page: Page,
  user: TestUser,
  role: 'admin' | 'student' = 'student',
): Promise<TestUser> {
  const testUser = await createTestUser(user, role)

  try {
    await authenticateViaAPI(page, testUser)
  } catch {
    await authenticateViaSignup(page, testUser)
  }

  await setHebrewLocale(page)
  return testUser
}
