import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, app, tailwindConfig] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./app.js', import.meta.url), 'utf8'),
    readFile(new URL('./tailwind.config.cjs', import.meta.url), 'utf8')
]);

test('index loads the application from one external module', () => {
    const moduleScripts = [...html.matchAll(/<script\b([^>]*)type=["']module["']([^>]*)>([\s\S]*?)<\/script>/gi)];

    assert.equal(moduleScripts.length, 1);
    assert.match(moduleScripts[0][0], /\bsrc=["']\.\/app\.js["']/i);
    assert.equal(moduleScripts[0][3].trim(), '');
});

test('external module retains the application bootstrap and Firebase imports', () => {
    assert.match(app, /from "https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.1\/firebase-app\.js"/);
    assert.match(app, /onAuthStateChanged\(auth,/);
    assert.match(app, /window\.switchView\s*=/);
    assert.match(app, /function renderActiveView\(/);
});

test('Tailwind scans both the HTML shell and JavaScript templates', () => {
    assert.match(tailwindConfig, /content:\s*\[[^\]]*['"]\.\/index\.html['"][^\]]*['"]\.\/app\.js['"][^\]]*\]/s);
});

test('new work orders derive the product name from category-filtered Style SKUs', () => {
    assert.doesNotMatch(html, /name=["']itemName["']/);
    assert.match(html, /id=["']new-item-category["'][^>]*updateNewItemSkuOptions/);
    assert.match(html, /id=["']new-item-styleSku["']/);
    assert.match(app, /itemName:\s*styleEntry\.name\s*\|\|\s*styleSku/);
    assert.match(app, /styleEntry\.category\s*!==\s*form\.get\(['"]category['"]\)/);
});

test('PDF export applies the allocation category filter', () => {
    assert.match(app, /const catFilter = document\.getElementById\(['"]alloc-filter-category['"]\)\.value/);
    assert.match(app, /filterAllocationItemsByCategory\([\s\S]*?catFilter,[\s\S]*?resolveCategory/);
    assert.match(html, /匯出目前篩選結果 PDF/);
});

test('allocation and PDF export preserve product filtering after category migration', () => {
    assert.match(html, /id=["']alloc-filter-style-sku["']/);
    assert.match(app, /prepareAllocationPage\(\{[\s\S]*?styleSkuFilter,/);
    assert.match(app, /filterAllocationItemsByStyleSku\(categoryItems, styleSkuFilter, normalizeStyleSku\)/);
});

test('inventory provides direct Garment ID search and exact-piece rendering', () => {
    assert.match(html, /id=["']allocation-garment-search["']/);
    assert.match(app, /photoMatchesGarmentSearch\(p, garmentIdSearch\)/);
    assert.match(app, /编号搜索会暂时忽略其他筛选/);
    assert.match(app, /locPhotos = photos\.filter\(photo => photoMatchesGarmentSearch/);
});

test('production and inventory use linked canonical Category and Style SKU filters', () => {
    assert.match(html, /id=["']prod-filter-category["'][^>]*handleCategoryFilterChange\('prod'\)/);
    assert.match(html, /id=["']prod-filter-style-sku["'][^>]*handleStyleSkuFilterChange\('prod'\)/);
    assert.match(html, /id=["']alloc-filter-category["'][^>]*handleCategoryFilterChange\('alloc'\)/);
    assert.match(app, /const canonicalCatalog = normalizeStyleSkuCatalog\(appSettings\.styleSkus\)/);
    assert.doesNotMatch(html, /onclick=["']window\.addSetting\('categories'\)/);
});

test('editing an unmatched legacy item preserves its original category', () => {
    assert.match(app, /const selectedCategory = normalizeStyleSkuCategory\(document\.getElementById\(['"]edit-category['"]\)\.value\)/);
    assert.match(app, /category: requestedStyleEntry\?\.category \|\| selectedCategory \|\| item\.category \|\| ['"]/);
});

test('production and inventory expose numbered pagination containers', () => {
    for (const prefix of ['production', 'allocation']) {
        assert.match(html, new RegExp(`id=["']${prefix}-page-numbers-mobile["']`));
        assert.match(html, new RegExp(`id=["']${prefix}-page-numbers-desktop["']`));
    }
    assert.match(app, /buildPaginationItems\(currentPage, totalPages, maxItems\)/);
    assert.match(app, /window\.goToPage\s*=/);
});

test('legacy SKU migration requires a backup and version-protected updates', () => {
    assert.match(html, /id=["']sku-migration-backup-button["']/);
    assert.match(html, /id=["']sku-migration-run-button["'][^>]*disabled/);
    assert.match(app, /makeSkuMigrationBackup\(db, legacySkuPlan\)/);
    assert.match(app, /assertVersion\(latestItem, row\.version\)/);
    assert.match(app, /garmentIdsMatchSku\(normalizePhotos\(latestItem\), row\.target\.sku\)/);
});

test('legacy Garment ID migration is backup-first and transaction protected', () => {
    assert.match(html, /id=["']garment-id-backup-button["'][^>]*disabled/);
    assert.match(html, /id=["']garment-id-run-button["'][^>]*disabled/);
    assert.match(app, /makeGarmentIdMigrationBackup\(db, garmentIdMigrationPlan\)/);
    assert.match(app, /assertVersion\(latestItem, row\.version\)/);
    assert.match(app, /normalizeStyleSku\(latestItem\.styleSku\) !== row\.sku/);
    assert.match(app, /transaction\.update\(itemRef, \{\s*photos: allocation\.photos,\s*_version:/);
});
