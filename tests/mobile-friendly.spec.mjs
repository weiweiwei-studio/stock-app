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
    await expect(page.locator('#allocation-page-numbers-mobile')).toHaveCSS('display', 'flex');
    await expect(page.locator('#allocation-page-numbers-desktop')).toHaveCSS('display', 'none');
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

test('archive recovery panel remains usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('view-settings')?.classList.remove('hidden');
    });

    const panel = page.locator('#archived-items-panel');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeInViewport();
    const summary = panel.locator('summary');
    expect((await summary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('archived item detail modal remains usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('archived-detail-modal')?.classList.remove('hidden');
    });

    const modal = page.locator('#archived-detail-modal');
    await expect(modal).toBeInViewport();
    const closeButton = modal.getByRole('button', { name: '关闭封存工单详情' });
    expect((await closeButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('Singapore popup sale form remains usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('sold-modal')?.classList.remove('hidden');
    });

    const modal = page.locator('#sold-modal');
    await expect(modal).toBeInViewport();
    await expect(page.locator('#sold-price-input')).toHaveAttribute('inputmode', 'decimal');
    await expect(page.locator('#sold-payment-method')).toBeVisible();
    await expect(page.locator('#popup-sale-mode')).toBeVisible();
    const confirmButton = page.locator('#btn-confirm-sold');
    expect((await confirmButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('Singapore popup sales report remains usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        const modal = document.getElementById('popup-sales-report-modal');
        modal?.classList.remove('hidden');
        modal?.classList.add('flex');
    });

    const modal = page.locator('#popup-sales-report-modal');
    await expect(modal).toBeInViewport();
    await expect(page.locator('#popup-report-start-date')).toBeVisible();
    await expect(page.locator('#popup-report-payment')).toBeVisible();
    const exportButton = page.locator('#popup-report-export-button');
    expect((await exportButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});
