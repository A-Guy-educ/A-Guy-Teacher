import { expect, test } from '@playwright/test'

import { loginAsStudent } from './helpers/verification-fixtures'

test.describe('Persona Selection', () => {
  test('selected persona card does not shift layout of other cards', async ({ page }) => {
    // Login as student to access persona selection
    await loginAsStudent(page)

    // Navigate to persona selection page
    await page.goto('/onboarding/persona')
    await page.waitForLoadState('domcontentloaded')

    // Wait for persona cards to load
    const personaCards = page.locator('[role="radio"]')
    await expect(personaCards.first()).toBeVisible({ timeout: 10000 })

    const cardCount = await personaCards.count()
    if (cardCount < 2) {
      test.skip(true, 'Need at least 2 persona cards for layout test')
      return
    }

    // Get initial bounding boxes of all cards
    const initialBoxes = await personaCards.evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect()
        return { height: rect.height, top: rect.top }
      }),
    )

    // Select the first persona
    await personaCards.first().click()
    await page.waitForTimeout(300) // Allow layout to settle

    // Get bounding boxes after selection
    const afterSelectBoxes = await personaCards.evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect()
        return { height: rect.height, top: rect.top }
      }),
    )

    // Verify that unselected cards (cards 1+) maintain their top positions
    // They should not shift due to the selected card's badge
    for (let i = 1; i < cardCount; i++) {
      const initial = initialBoxes[i]
      const afterSelect = afterSelectBoxes[i]

      // Unselected cards should not shift vertically
      expect(afterSelect.top).toBe(initial.top)
    }

    // Verify the selected card has the badge
    const selectedCard = personaCards.first()
    await expect(selectedCard.locator('text=/נבחר|selected/i')).toBeVisible()
  })
})
