import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, inlineString, safeImageUrl } from './security-utils.js';

test('escapes text and attributes before HTML rendering', () => {
    assert.equal(escapeHtml(`<img src=x onerror="alert('x')">`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
});

test('creates a quoted and escaped inline handler argument', () => {
    assert.equal(inlineString(`a');alert(1)//`), '&quot;a&#39;);alert(1)//&quot;');
});

test('allows only HTTPS image URLs', () => {
    assert.equal(safeImageUrl('javascript:alert(1)'), '');
    assert.equal(safeImageUrl('http://example.com/a.jpg'), '');
    assert.equal(safeImageUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg');
    assert.equal(safeImageUrl('data:image/png;base64,aGVsbG8='), 'data:image/png;base64,aGVsbG8=');
    assert.equal(safeImageUrl('data:image/svg+xml;base64,PHN2Zz4='), '');
});
