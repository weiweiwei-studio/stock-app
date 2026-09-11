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
    assert.match(app, /filterAllocationItemsByCategory\([\s\S]*?catFilter,[\s\S]*?getCleanCategory/);
    assert.match(html, /匯出目前篩選結果 PDF/);
});

test('allocation and PDF export preserve product filtering after category migration', () => {
    assert.match(html, /id=["']alloc-filter-style-sku["']/);
    assert.match(app, /prepareAllocationPage\(\{[\s\S]*?styleSkuFilter,/);
    assert.match(app, /filterAllocationItemsByStyleSku\(categoryItems, styleSkuFilter, normalizeStyleSku\)/);
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
