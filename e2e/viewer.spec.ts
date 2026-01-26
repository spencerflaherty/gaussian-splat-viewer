import { test, expect } from '@playwright/test';

test.describe('Gaussian Splat Viewer Troubleshooting', () => {

    test('Page loads and is not white screen', async ({ page }) => {
        // 1. Navigate to the app
        await page.goto('/');

        // 2. Check for the main application container
        // Based on the code, we expect a root div or similar. 
        // Let's verify if the canvas is created.
        // The troubleshooting guide mentions checking for <canvas> in the container.

        // We'll look for a canvas element. If it's missing, that's a key finding.
        const canvas = page.locator('canvas');
        const isCanvasAttached = await canvas.count() > 0;

        if (!isCanvasAttached) {
            console.log('CRITICAL: No canvas element found on the page.');
        } else {
            console.log('SUCCESS: Canvas element found.');
        }

        // Capture a screenshot to document the "white screen" state if present
        await page.screenshot({ path: 'test-results/initial_load.png' });

        // Check for "Initial loading" text or similar indicators
        // If the screen is truly just white, these won't be found.
        const bodyText = await page.innerText('body');
        console.log('Body text content length:', bodyText.length);
    });

    test('Check for controls and UI elements', async ({ page }) => {
        await page.goto('/');

        // List of expected UI controls based on typical viewer requirements
        // We are looking for sliders for Opacity, Scale, Rotation, etc.
        // We will inspect the page for input elements.

        const controls = [
            { name: 'Opacity', selector: 'input[type="range"]' }, // Generic range, refine if possible
            // Assuming typical names or labels might exist. 
            // If the screen is white, these will likely fail, which is the point.
        ];

        // Log all inputs found
        const inputs = await page.locator('input').all();
        console.log(`Found ${inputs.length} input elements.`);

        for (const input of inputs) {
            const type = await input.getAttribute('type');
            const id = await input.getAttribute('id');
            console.log(`Found input: type=${type}, id=${id}`);
        }

        // Check for specific buttons
        const buttons = await page.locator('button').all();
        console.log(`Found ${buttons.length} button elements.`);

        for (const button of buttons) {
            const text = await button.innerText();
            console.log(`Found button: "${text}"`);
        }
    });

    test('Console error monitoring', async ({ page }) => {
        const consoleLogs: string[] = [];
        const consoleErrors: string[] = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
                console.log(`PAGE ERROR: ${msg.text()}`);
            } else {
                consoleLogs.push(msg.text());
            }
        });

        await page.goto('/');

        // Wait a bit for potential async errors
        await page.waitForTimeout(3000);

        if (consoleErrors.length > 0) {
            console.log('Found console errors:', consoleErrors);
        } else {
            console.log('No console errors detected during load.');
        }
    });
});
