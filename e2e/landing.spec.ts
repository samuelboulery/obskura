import { expect, test } from '@playwright/test'

test.describe('landing', () => {
  test('un seul titre, le corps réel de la requête choisie', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveText('Un prompt. Plusieurs regards.')

    const body = page.getByLabel('Corps de la requête envoyée à GPT Image 2.5 Sunburst')
    await expect(body).toContainText('"model": "gpt-image-2.5-sunburst"')
    await expect(body).toContainText('Une bulle de savon')

    await page.getByText('Une comète traverse', { exact: false }).first().click()
    await expect(body).toContainText('Une comète traverse')
  })

  test('changer de modèle retire les réglages ignorés', async ({ page }) => {
    await page.goto('/')
    const section = page.locator('#elagage')
    await section.getByText('GPT Image 2', { exact: true }).click()
    await expect(section.locator('pre.json')).toContainText('"size": "1536x864"')
    await expect(section.locator('pre.json')).not.toContainText('"seed"')
    await expect(section.locator('.ignored-list')).toContainText('seed')
  })

  test('le curseur de comparaison répond au clavier', async ({ page }) => {
    await page.goto('/')
    const slider = page.locator('#comparaison input[type=range]')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue('51')
  })

  test('la scène passe en mode vivant quand WebGL2 répond', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.landing')).toHaveAttribute('data-mode', 'live')
  })

  test("« Ouvrir l'app » mène à l'app", async ({ page }) => {
    await page.goto('/')
    await page.getByRole('banner').getByRole('link', { name: "Ouvrir l'app" }).click()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.locator('textarea')).toBeVisible()
  })
})

test.describe('mouvement réduit', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test("séquence fixe : l'image d'après est visible sans transition", async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.landing')).toHaveAttribute('data-mode', 'static')
    const after = page.locator('.after-frame img')
    await after.scrollIntoViewIfNeeded()
    await expect(after).toBeVisible()
    await expect(after).toHaveCSS('opacity', '1')
  })
})
