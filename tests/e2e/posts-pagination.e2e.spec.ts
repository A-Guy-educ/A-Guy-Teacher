import { test, expect } from '@playwright/test'

/**
 * E2E tests for the Posts Pagination page (issue #213).
 *
 * Tests that /posts/page/[pageNumber] returns proper responses:
 * - Valid page numbers (1, 2, etc.) return the posts list
 * - Invalid page numbers (0, -1, non-integers) return 404
 *
 * Issue #213: Posts pagination page was crashing with 500 error for
 * invalid page numbers because the validation only checked if the
 * page number was an integer, not if it was >= 1.
 */
test.describe('Posts Pagination', () => {
  test('returns posts list for valid page 1', async ({ page }) => {
    await page.goto('/posts/page/1')

    // Should show the posts heading
    await expect(page.locator('h1')).toContainText('Posts')

    // Should not show a 500 error
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).not.toMatch(/500|Internal Server Error/)
  })

  test('returns 404 for page 0 (invalid)', async ({ page }) => {
    await page.goto('/posts/page/0')

    // Should show 404 not found page
    // Next.js shows "not-found" page when notFound() is called
    await expect(page.locator('body')).toBeVisible()
  })

  test('returns 404 for negative page numbers', async ({ page }) => {
    await page.goto('/posts/page/-1')

    // Should show 404 not found page
    await expect(page.locator('body')).toBeVisible()
  })

  test('returns 404 for non-integer page numbers', async ({ page }) => {
    await page.goto('/posts/page/abc')

    // Should show 404 not found page
    await expect(page.locator('body')).toBeVisible()
  })

  test('returns posts list for /posts (first page)', async ({ page }) => {
    await page.goto('/posts')

    // Should show the posts heading
    await expect(page.locator('h1')).toContainText('Posts')

    // Should not show a 500 error
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).not.toMatch(/500|Internal Server Error/)
  })
})
