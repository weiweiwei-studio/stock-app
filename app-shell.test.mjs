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
