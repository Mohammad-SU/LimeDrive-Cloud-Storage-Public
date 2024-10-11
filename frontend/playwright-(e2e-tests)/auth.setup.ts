import { test as setup } from '@playwright/test'
import { checkAuthCookies, registerTestUser, loginTestUser, waitForLoginResult } from './utils'
import * as path from 'path'

const authFile = path.join(process.cwd(), 'playwright/.auth/user.json') // For some reason it needed to be this path (seemingly one directory up)

setup('authenticate', async ({ page, context }) => {
    async function attemptLogin() {
        await loginTestUser(page, context, true)
        return await waitForLoginResult(page)
    }

    let loginSuccess = await attemptLogin()
    
    if (!loginSuccess) {
        // If login fails, proceed with registration
        // Cookies are set here after success
        await registerTestUser(page, context)
    }

    await page.waitForURL('/LimeDrive')

    await checkAuthCookies(context)

    await context.storageState({ path: authFile })
})