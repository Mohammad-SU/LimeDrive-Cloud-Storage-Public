import { PlaywrightTestConfig } from '@playwright/test'
// Don't need dotenv as npm run test uses doppler which seems to add the env vars to process.env

const unauthenticatedTests = ['auth/**']

const config: PlaywrightTestConfig = {
    use: {
        baseURL: 'https://localhost:5173',
        // trace: process.env.CI ? 'off' : 'retain-on-failure', // Some tests may timeout with this on, possibly due to high resource consumption
        ignoreHTTPSErrors: process.env.CI ? true : false, // For now leave this as had issues in GitHub Actions runner with cert
    },
    testDir: './tests',
    fullyParallel: true,
    timeout: 1 * 60 * 1000,
    expect: { timeout: 15000 },
    projects: [
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
        },
        {
            name: 'authenticated',
            use: {
                storageState: './playwright/.auth/user.json',
            },
            dependencies: ['setup'],
            testIgnore: unauthenticatedTests,
        },
        {
            name: 'unauthenticated',
            testMatch: unauthenticatedTests,
        },
    ],
}

export default config