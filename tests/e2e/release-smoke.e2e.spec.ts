import { expect, test } from '@playwright/test'

test.describe('Release smoke', () => {
  test('health endpoint reports a ready application', async ({ request }) => {
    const response = await request.get('/api/health')

    expect(response.ok()).toBe(true)
  })

  test('homepage renders without a server error', async ({ page }) => {
    const response = await page.goto('/')

    expect(response?.ok()).toBe(true)
    await expect(page.locator('body')).toBeVisible()
  })
})
