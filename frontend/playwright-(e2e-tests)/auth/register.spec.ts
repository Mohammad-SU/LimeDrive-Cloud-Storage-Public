import { test, expect } from '@playwright/test'
import { nanoid } from 'nanoid'
import { registerUser } from '../utils'

test.describe('Register', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/auth')
        await page.click('button:has-text("Create an account")')
    })

    test('successful register', async ({ page, context }) => {
        const testId = nanoid(12);
        const email = `${testId}@example.com`
        const username = `user-${testId}`
        const password = nanoid(12)

        await registerUser(page, context, email, username, password)

        // Would usually only be visible after user registration and generation, not login
        await expect(page.locator('.initial-modal')).toBeVisible()
    })

    test('shows error for invalid email', async ({ page }) => {    
        const testId = nanoid();
        const invalidEmail = `invalidEmail-${testId}`
        const username = `user-${testId}`
        const password = nanoid(12)

        await page.fill('#email-register', invalidEmail)
        await page.fill('#username-register', username)
        await page.fill('#password-register', password)
        await page.fill('#password-confirmation', password)
    
        await page.click('button[type="submit"]')
    
        await expect(page.locator('.Toast')).toContainText('Invalid email format.')
    })

})