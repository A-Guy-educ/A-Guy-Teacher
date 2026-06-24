import { expect, test } from '@playwright/test'

/**
 * Regression test for issue #332: Disable Ask button on /study route.
 *
 * On the /study page, the Ask button should be visually grayed out and non-interactive.
 * Students should not be able to navigate to /ask from within a study session.
 *
 * @tags @navigation @regression
 */
test.describe('NavigationBar Ask Button', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state
    await page.goto('/study')
    await page.evaluate(() => localStorage.clear())
  })

  test('Ask button should be disabled on /study route', async ({ page }) => {
    await page.goto('/study')
    await page.waitForLoadState('domcontentloaded')

    // Find the Ask button - it has the MessageCircle icon and "Ask" text
    const askButton = page.locator('button').filter({ hasText: /ask/i }).first()

    // Verify button exists
    await expect(askButton).toBeVisible()

    // Verify disabled attribute is present
    await expect(askButton).toBeDisabled()

    // Verify cursor-not-allowed class is applied
    await expect(askButton).toHaveClass(/cursor-not-allowed/)

    // Verify opacity-50 class is applied
    await expect(askButton).toHaveClass(/opacity-50/)
  })

  test('Ask button should be enabled on other routes', async ({ page }) => {
    // Test on /practice route
    await page.goto('/practice')
    await page.waitForLoadState('domcontentloaded')

    const askButton = page.locator('button').filter({ hasText: /ask/i }).first()
    await expect(askButton).toBeVisible()
    await expect(askButton).toBeEnabled()

    // Test on /ask route
    await page.goto('/ask')
    await page.waitForLoadState('domcontentloaded')

    await expect(askButton).toBeVisible()
    await expect(askButton).toBeEnabled()

    // Test on /test route
    await page.goto('/test')
    await page.waitForLoadState('domcontentloaded')

    await expect(askButton).toBeVisible()
    await expect(askButton).toBeEnabled()
  })

  test('Ask button should not navigate on /study route', async ({ page }) => {
    await page.goto('/study')
    await page.waitForLoadState('domcontentloaded')

    const askButton = page.locator('button').filter({ hasText: /ask/i }).first()

    // Click the disabled ask button
    await askButton.click()

    // Verify we stayed on /study
    await expect(page).toHaveURL(/\/study/)
  })
})
