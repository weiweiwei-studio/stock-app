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
