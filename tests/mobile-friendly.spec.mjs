import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.goto('/index.html');
});

test('login and primary navigation fit a phone viewport', async ({ page }) => {
    await expect(page.locator('#auth-screen')).toBeVisible();
    await expect(page.locator('#login-email')).toBeInViewport();
    await expect(page.locator('#login-password')).toBeInViewport();
    await expect(page.locator('#login-button')).toBeInViewport();

    const loginButton = await page.locator('#login-button').boundingBox();
    expect(loginButton?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
    });

    await expect(page.locator('nav .sm\\:hidden')).toBeVisible();
    await expect(page.locator('nav .sm\\:flex')).toBeHidden();

    const mobileButtons = page.locator('nav .sm\\:hidden button:not(.hidden)');
    await expect(mobileButtons).toHaveCount(3);
    for (const button of await mobileButtons.all()) {
        const box = await button.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }

    const hasViewportOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasViewportOverflow).toBe(false);
});

test('legacy SKU migration controls remain usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('view-settings')?.classList.remove('hidden');
    });

    const preview = page.locator('#sku-migration-preview');
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toBeInViewport();
    for (const selector of ['#sku-migration-scan-button', '#sku-migration-backup-button', '#sku-migration-run-button']) {
        const box = await page.locator(selector).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('inventory product filter remains usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('view-dashboard')?.classList.add('hidden');
        document.getElementById('view-allocation')?.classList.remove('hidden');
    });

    const styleSkuFilter = page.locator('#alloc-filter-style-sku');
    await expect(styleSkuFilter).toBeVisible();
    const box = await styleSkuFilter.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    const search = page.locator('#allocation-garment-search');
    await expect(search).toBeVisible();
    expect((await search.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#allocation-page-numbers-mobile')).toBeVisible();
    await expect(page.locator('#allocation-page-numbers-desktop')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('legacy Garment ID migration controls remain usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('view-settings')?.classList.remove('hidden');
    });

    const preview = page.locator('#garment-id-preview');
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toBeInViewport();
    for (const selector of ['#garment-id-scan-button', '#garment-id-backup-button', '#garment-id-run-button']) {
        const box = await page.locator(selector).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});
