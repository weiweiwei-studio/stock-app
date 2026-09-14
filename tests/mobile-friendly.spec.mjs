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
        document.getElementById('data-maintenance-panel').open = true;
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

test('production filters stack without horizontal overflow on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('view-dashboard')?.classList.add('hidden');
        document.getElementById('view-production')?.classList.remove('hidden');
    });

    const panel = page.locator('#production-filter-panel');
    await expect(panel).toBeVisible();
    for (const selector of ['#prod-filter-maker', '#prod-filter-category', '#prod-filter-style-sku', '#prod-filter-status']) {
        const control = page.locator(selector);
        await expect(control).toBeInViewport();
        const box = await control.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('inventory export actions stack without horizontal overflow on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('view-dashboard')?.classList.add('hidden');
        document.getElementById('view-allocation')?.classList.remove('hidden');
    });

    for (const selector of ['#btn-export-pdf', '#alloc-summary-badge']) {
        const element = page.locator(selector);
        await expect(element).toBeVisible();
        const box = await element.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('legacy Garment ID migration controls remain usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('view-settings')?.classList.remove('hidden');
        document.getElementById('data-maintenance-panel').open = true;
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
    const cancelButton = page.locator('#btn-cancel-sold');
    expect((await cancelButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => {
        const status = document.getElementById('sold-save-status');
        if (status) {
            status.textContent = '未写入 Firebase：请确认网络后重试。';
            status.className = 'mt-3 rounded p-2 text-xs font-bold bg-red-50 text-red-700';
        }
    });
    await expect(page.locator('#sold-save-status')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('complete backup control remains usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('view-dashboard')?.classList.add('hidden');
        document.getElementById('view-settings')?.classList.remove('hidden');
    });

    const button = page.locator('#system-backup-button');
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
    expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#system-backup-status')).toBeVisible();
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
    await expect(page.locator('#popup-report-event')).toBeVisible();
    await expect(page.locator('#sales-report-scope')).toBeVisible();
    await expect(page.locator('#sales-report-currency')).toBeVisible();
    for (const selector of ['#sales-report-scope', '#sales-report-currency']) {
        expect((await page.locator(selector).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const exportButton = page.locator('#popup-report-export-button');
    expect((await exportButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('sales report thumbnails and image preview remain usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        const modal = document.getElementById('popup-sales-report-modal');
        modal?.classList.remove('hidden');
        modal?.classList.add('flex');
        const list = document.getElementById('popup-report-list');
        if (list) {
            list.innerHTML = '<div class="flex items-start gap-3 rounded border p-3"><button class="sales-report-thumbnail h-24 w-[72px] flex-shrink-0 rounded border">Image</button><div class="min-w-0 flex-1 break-words">2DRS012-001 · Clairo Dress · Singapore Popup</div></div>';
        }
    });

    const thumbnail = page.locator('.sales-report-thumbnail');
    await thumbnail.scrollIntoViewIfNeeded();
    const box = await thumbnail.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => document.getElementById('image-viewer-modal')?.classList.remove('hidden'));
    await expect(page.locator('#image-viewer-modal')).toBeVisible();
    const layers = await page.evaluate(() => ({
        report: Number.parseInt(getComputedStyle(document.getElementById('popup-sales-report-modal')).zIndex, 10),
        image: Number.parseInt(getComputedStyle(document.getElementById('image-viewer-modal')).zIndex, 10)
    }));
    expect(layers.image).toBeGreaterThan(layers.report);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('garment history and sold-item correction actions remain usable on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('detail-modal')?.classList.remove('hidden');
        document.getElementById('btn-return-stock')?.classList.remove('hidden');
        document.getElementById('detail-history').innerHTML = Array.from({ length: 8 }, (_, index) => `<div>History ${index + 1}</div>`).join('');
        window.__returnStockTapped = false;
        window.returnSoldItemToStock = () => { window.__returnStockTapped = true; };
    });

    const history = page.locator('#detail-history');
    await history.scrollIntoViewIfNeeded();
    await expect(history).toBeInViewport();
    for (const selector of ['#btn-toggle-sold', '#btn-return-stock', '#btn-save-detail']) {
        const box = await page.locator(selector).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    const returnButton = page.locator('#btn-return-stock');
    await returnButton.scrollIntoViewIfNeeded();
    await returnButton.tap();
    expect(await page.evaluate(() => window.__returnStockTapped)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('visible item-detail actions share the available tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 844 });
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        document.getElementById('detail-modal')?.classList.remove('hidden');
        document.getElementById('btn-return-stock')?.classList.add('hidden');
    });

    const soldBox = await page.locator('#btn-toggle-sold').boundingBox();
    const saveBox = await page.locator('#btn-save-detail').boundingBox();
    expect(Math.abs((soldBox?.width ?? 0) - (saveBox?.width ?? 0))).toBeLessThanOrEqual(1);
    expect((saveBox?.x ?? 0) + (saveBox?.width ?? 0)).toBeLessThanOrEqual(768);
});

test('sale reversal confirmation is visible and actionable in Chromium', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        const modal = document.getElementById('sale-reversal-modal');
        modal?.classList.remove('hidden');
        modal?.classList.add('flex');
        window.__saleReversalChoice = '';
        window.closeSaleReversalConfirmation = () => {
            window.__saleReversalChoice = 'cancelled';
            modal?.classList.add('hidden');
        };
        window.confirmReturnSoldItemToStock = () => { window.__saleReversalChoice = 'confirmed'; };
    });

    const modal = page.locator('#sale-reversal-modal');
    await expect(modal).toBeVisible();
    for (const selector of ['#btn-cancel-sale-reversal', '#btn-confirm-sale-reversal']) {
        const box = await page.locator(selector).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#btn-confirm-sale-reversal').tap();
    expect(await page.evaluate(() => window.__saleReversalChoice)).toBe('confirmed');
    await page.evaluate(() => {
        const status = document.getElementById('sale-reversal-status');
        status.textContent = '未能取消售出，资料尚未写入。';
        status.className = 'mt-3 rounded p-2 text-xs font-bold bg-red-50 text-red-700';
    });
    await expect(page.locator('#sale-reversal-status')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('item detail modal scrolls to its actions on a phone', async ({ page }) => {
    await page.evaluate(() => {
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        const modal = document.getElementById('detail-modal');
        modal?.classList.remove('hidden');
        const image = document.getElementById('detail-img');
        if (image) {
            image.classList.remove('hidden');
            image.style.width = '280px';
            image.style.height = '280px';
        }
        const locations = document.getElementById('detail-location-options');
        if (locations) locations.innerHTML = Array.from({ length: 10 }, (_, index) => `<button class="min-h-[44px]">Location ${index + 1}</button>`).join('');
    });

    const panel = page.locator('#detail-modal-panel');
    const scrollState = await panel.evaluate(element => {
        element.scrollTop = element.scrollHeight;
        return { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop };
    });
    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
    expect(scrollState.scrollTop).toBeGreaterThan(0);
    await expect(page.locator('#btn-save-detail')).toBeInViewport();
    await expect(page.locator('#btn-toggle-sold')).toBeInViewport();
});
