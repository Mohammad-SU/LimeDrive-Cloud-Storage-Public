import { expect, BrowserContext, Page } from '@playwright/test';

const TEST_USERNAME = 'TEST_USER'
const TEST_EMAIL = 'TEST@EXAMPLE.COM'
const TEST_PASSWORD = process.env.TEST_PASSWORD as string

export async function checkAuthCookies(context: BrowserContext) {
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(cookie => cookie.name === 'limedrive_session');
    const xsrfTokenCookie = cookies.find(cookie => cookie.name === 'XSRF-TOKEN');

    expect(sessionCookie).toBeDefined();
    expect(xsrfTokenCookie).toBeDefined();
}

export async function registerUser(page: Page, context: BrowserContext, email: string, username: string, password: string) {
    await page.goto('/auth')

    await page.click('button:has-text("Create an account")')

    await page.fill('#email-register', email)
    await page.fill('#username-register', username)
    await page.fill('#password-register', password)
    await page.fill('#password-confirmation', password)

    await page.click('button[type="submit"]')

    await expect(page.locator('.Toast')).toContainText('Processing registration')

    await page.waitForURL('/LimeDrive')

    await checkAuthCookies(context)
}

export async function loginUser(page: Page, context: BrowserContext, usernameOrEmail: string, password: string, skipResult: boolean = false) {
    await page.goto('/auth')

    await page.fill('#username-or-email-login', usernameOrEmail)
    await page.fill('#password-login', password)
    await page.click('button[type="submit"]')

    if (!skipResult) {
        await waitForLoginResult(page)

        await checkAuthCookies(context)
    }
}

export async function registerTestUser(page: Page, context: BrowserContext) {
    if (!TEST_PASSWORD) {
        throw new Error('Missing required environment variable for authentication')
    }

    await registerUser(page, context, TEST_EMAIL, TEST_USERNAME, TEST_PASSWORD)

    await page.click('.consent-checkbox')

    await page.click('.modal-primary-btn')

    if (!await waitForToastResult(page, 'Saving your consent choice', 'Consent choice saved successfully', 'Failed to save consent choice')) {
        throw new Error('Failed to save consent choice')
    }
}

export async function loginTestUser(page: Page, context: BrowserContext, skipResult: boolean = false, useEmail: boolean = false) {
    if (!TEST_PASSWORD) {
        throw new Error('Missing required environment variable for authentication')
    }

    await loginUser(page, context, useEmail ? TEST_EMAIL : TEST_USERNAME, TEST_PASSWORD, skipResult)
}

export async function waitForActionResult(
    processingAction: () => Promise<any>,
    successAction: () => Promise<any>,
    failAction: () => Promise<any>
): Promise<boolean> {
    try {
        await processingAction()
        
        const result = await Promise.race([
            successAction().then(() => 'success'),
            failAction().then(() => 'failure')
        ])

        switch (result) {
            case 'success':
                return true
            case 'failure':
                return false
            default:
                console.error('Action timed out or encountered an unexpected state.')
                return false
        }
    } catch (error) {
        console.error('Error during action:', error)
        return false
    }
}

export async function waitForToastResult(
    page: Page,
    processingMessage: string,
    successMessage: string,
    failMessage: string
): Promise<boolean> {
    return waitForActionResult(
        () => page.waitForSelector(`.Toast:has-text("${processingMessage}")`),
        () => page.waitForSelector(`.Toast:has-text("${successMessage}")`),
        () => page.waitForSelector(`.Toast:has-text("${failMessage}")`)
    )
}

export async function waitForLoginResult(page: Page): Promise<boolean> {
    return waitForActionResult(
        () => page.waitForSelector('.Toast:has-text("Processing login details")'),
        () => page.waitForURL('/LimeDrive'),
        () => page.waitForSelector('.Toast:has-text("Invalid login details.")')
    )
}
