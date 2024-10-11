import { test, expect, Locator, BrowserContext, Page } from '@playwright/test'
import { nanoid } from 'nanoid'
import { waitForToastResult } from '../utils'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Serialise these tests since the tests after Upload need an uploaded file to be successful, which the Upload test will provide
test.describe.serial('Successful single upload, preview, and delete flow (plaintext)', () => {
    let tempFilePath: string
    let tempFileName: string
    let fileContent: string
    let fileInMainListLocator: Locator // Can use this flexibly due to lazy evaluation
    let context: BrowserContext
    let page: Page

    test.beforeAll(async ({ browser }) => { // Leave in hook
        // Create a new context that will be shared across all tests - prevent loading screen from happening before each test in the flow
        context = await browser.newContext()

        const originalFileName = 'plaintext.txt'
        const originalFilePath = `test-files/${originalFileName}`

        // Create a temp file with nano id, to prevent name conflicts with future tests.
        tempFileName = `${nanoid()}_${originalFileName}`
        tempFilePath = path.join(os.tmpdir(), tempFileName)
        fileContent = fs.readFileSync(originalFilePath, 'utf-8')
        fs.writeFileSync(tempFilePath, fileContent)
    })

    test.beforeEach(async () => {
        page = await context.newPage()
        await page.goto('/LimeDrive')
        // Use .File to get the actual File element and not a child in it
        fileInMainListLocator = page.locator(`.AllFiles .File:has(.name-text-cont:text("${tempFileName}"))`)
    })

    test.afterAll(async () => {
        await context.close()
        fs.unlinkSync(tempFilePath)
    })

    test('Upload', async () => {
        // Wait since loading data may take time since this is the first test after the new context
        await page.locator('button.new-btn').waitFor({ state: 'visible' }) 

        // Opens dropdown for file upload btn
        await page.click('button.new-btn') 
        
        const fileChooserPromise = page.waitForEvent('filechooser')
        await page.click('button.file-upload-btn')
        const fileChooser = await fileChooserPromise
        
        await fileChooser.setFiles(tempFilePath)

        await expect(page.locator('.UploadList')).toContainText(tempFileName)

        // Successful upload after waiting
        await page.locator(`.UploadList .file-info:has([data-test-id="uploaded: ${tempFileName}"])`)
            .waitFor({ state: 'visible'})

        await expect(fileInMainListLocator).toBeVisible()
    })

    test('Preview', async () => {
        await fileInMainListLocator.dblclick()

        await expect(page.locator('.FileViewerHeader .file-name-cont')).toContainText(tempFileName)

        const textPreview = page.locator('.FileViewer .text-preview')

        await textPreview.waitFor({ state: 'visible' })

        await expect(textPreview).toContainText(fileContent)

        // Close so that Delete test can access the file list
        await page.locator('.FileViewerHeader .close-btn').click()
    })

    test('Delete', async () => { // Also acts as cleanup if successful
        // Ensure the name-text-cont isn't clicked (which could otherwise open the file instead of selecting it)
        await fileInMainListLocator.click({ position: { x: 3, y: 3 } }) 

        await page.locator('.DeleteBtn').click()

        await expect(page.locator('.delete-modal')).toContainText(tempFileName)

        await page.locator('.delete-modal .modal-primary-btn').click()

        if (!await waitForToastResult(page, 'Deleting file', 'File deleted successfully', 'Failed to delete file')) {
            throw new Error('Failed to delete file')
        }

        await expect(fileInMainListLocator).not.toBeVisible()
    })
})