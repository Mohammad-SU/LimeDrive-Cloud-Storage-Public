import { test, expect, Page, BrowserContext } from '@playwright/test'
import { nanoid } from 'nanoid'
import { checkAuthCookies, waitForLoginResult, loginTestUser, registerTestUser } from '../utils'

const loginWithRetry = async (page: Page, context: BrowserContext, isUsernameLogin: boolean) => {
    await loginTestUser(page, context, true, !isUsernameLogin);

    // If login fails, register the user and retry the login
    if (!await waitForLoginResult(page)) {
        await registerTestUser(page, context);
    
        // Clear auth cookies that are set after register
        await context.clearCookies();
    
        await page.reload();
    
        // Retry login
        await loginTestUser(page, context, true, !isUsernameLogin);
    }

    await checkAuthCookies(context);
}

test.describe('Login', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/auth')
    })

    test('successful login with username', async ({ page, context }) => {
        await loginWithRetry(page, context, true);
    });
    
    test('successful login with email', async ({ page, context }) => {
        await loginWithRetry(page, context, false);
    });

    test('shows error for invalid details', async ({ page }) => {    
        const testId = nanoid(); // Highly unlikely for a username to correspond with this due to low collision chance
        const password = nanoid(12)

        await page.fill('#username-or-email-login', testId)
        await page.fill('#password-login', password)
    
        await page.click('button[type="submit"]')
    
        if (!await waitForLoginResult(page)) {
            await expect(page.locator('.Toast')).toContainText('Invalid login details.')
        }
    })
})