import { expect, test } from '@playwright/test'

/**
 * Regression test for issue #595: Enable Ask button on /study route.
 *
 * On the /study page, the Ask button should be fully enabled and interactive.
 * Students should be able to navigate to /ask from within a study session.
 *
 * @tags @navigation @regression
 */
test.describe('NavigationBar Ask Button', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state
    await page.goto('/study')
    await page.evaluate(() => localStorage.clear())
  })

  test('Ask button should be enabled on /study route', async ({ page }) => {
    await page.goto('/study')
    await page.waitForLoadState('domcontentloaded')

    // Find the Ask button - it has the MessageCircle icon and "Ask" text
    const askButton = page.locator('button').filter({ hasText: /ask/i }).first()

    // Verify button exists
    await expect(askButton).toBeVisible()

    // Verify button is enabled (not disabled)
    await expect(askButton).toBeEnabled()

    // Verify no cursor-not-allowed class
    await expect(askButton).not.toHaveClass(/cursor-not-allowed/)

    // Verify no opacity-50 class
    await expect(askButton).not.toHaveClass(/opacity-50/)
  })

  test('Ask button should navigate from /study to /ask', async ({ page }) => {
    await page.goto('/study')
    await page.waitForLoadState('domcontentloaded')

    const askButton = page.locator('button').filter({ hasText: /ask/i }).first()

    // Click the enabled ask button
    await askButton.click()

    // Verify we navigated to /ask
    await expect(page).toHaveURL(/\/ask/)
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
})
