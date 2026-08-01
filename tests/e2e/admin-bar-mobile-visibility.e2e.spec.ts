/**
 * Bug #1821: Admin bar exposed on mobile frontend viewport
 *
 * Expected: Admin bar should be hidden on mobile viewports (< 640px)
 * Actual: Admin bar is visible on mobile viewports due to sm:hidden being
 *         applied incorrectly (sm:hidden hides at 640px+ but we want it hidden below 640px)
 *
 * @tags @bug
 */
import { expect, test } from '@playwright/test'

import { getSeedPayload } from './helpers/seed'

import {
  cleanupTestUsers,
  createTestUser,
  generateTestUserEmail,
  type TestUser,
} from './helpers/auth'

async function authenticateAsAdmin(page: import('@playwright/test').Page, user: TestUser) {
  const payload = await getSeedPayload()
  const loginResult = await payload.login({
    collection: 'users',
    data: {
      email: user.email,
      password: user.password,
    },
  })

  if (loginResult && 'token' in loginResult && loginResult.token) {
    await page.context().addCookies([
      {
        name: 'payload-token',
        value: loginResult.token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])
  }
}

test.describe('Admin Bar Mobile Visibility', () => {
  // Learning pages are behind a session — middleware sends anonymous visitors
  // to the login page, where none of the elements under test exist.
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('admin-bar-mobile-vis'),
      password: 'TestPassword123!',
    })
  })

  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test('admin bar wrapper is hidden on mobile viewport (375px)', async ({ page }) => {
    // Create admin user
    const adminUser = await createTestUser(
      {
        email: generateTestUserEmail('admin-bar-mobile'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    // Authenticate
    await authenticateAsAdmin(page, adminUser)

    // Set mobile viewport (375px - below sm breakpoint of 640px)
    await page.setViewportSize({ width: 375, height: 812 })

    // Navigate to frontend page
    await page.goto('/courses')
    await page.waitForLoadState('networkidle')

    // The admin bar is a div with py-2 bg-foreground text-background
    // After fix: it should have 'hidden sm:block' so it's hidden on mobile
    const adminBar = page
      .locator('div[class*="bg-foreground"][class*="text-background"][class*="py-2"]')
      .first()

    // The admin bar should NOT be visible on mobile
    const isVisible = await adminBar.isVisible().catch(() => false)
    expect(isVisible).toBe(false)
  })

  test('admin bar wrapper is visible on desktop viewport (1280px)', async ({ page }) => {
    // Create admin user
    const adminUser = await createTestUser(
      {
        email: generateTestUserEmail('admin-bar-desktop'),
        password: 'AdminPass123!',
      },
      'admin',
    )

    // Authenticate
    await authenticateAsAdmin(page, adminUser)

    // Set desktop viewport (1280px - above sm breakpoint of 640px)
    await page.setViewportSize({ width: 1280, height: 720 })

    // Navigate to frontend page
    await page.goto('/courses')
    await page.waitForLoadState('networkidle')

    // After fix (hidden sm:block), admin bar should be visible on desktop
    const adminBar = page
      .locator('div[class*="bg-foreground"][class*="text-background"][class*="py-2"]')
      .first()

    const isVisible = await adminBar.isVisible().catch(() => false)
    expect(isVisible).toBe(true)
  })
})
