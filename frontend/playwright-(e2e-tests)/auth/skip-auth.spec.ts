import { test, expect, Page, BrowserContext } from '@playwright/test'
import { checkAuthCookies } from '../utils'

const skipAuth = async (page: Page, context: BrowserContext) => {
    await page.click('button.skip-btn')

    await expect(page.locator('.Toast')).toContainText('Generating an account for you')

    await page.waitForURL('/LimeDrive');

    await checkAuthCookies(context)
}

test.describe('Skip auth', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/auth')
    })

    test('skip login', async ({ page, context }) => {
        await skipAuth(page, context)
    })

    test('skip register', async ({ page, context }) => {
        await page.click('button:has-text("Create an account")')
        
        await skipAuth(page, context)
    
        // Would usually only be visible after user registration and generation, not login
        await expect(page.locator('.initial-modal')).toBeVisible()
    })
})