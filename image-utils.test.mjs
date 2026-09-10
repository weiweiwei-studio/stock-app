import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_LIMITS, calculateContainDimensions, validateImageFile } from './image-utils.js';

test('keeps small images at their original dimensions', () => {
    assert.deepEqual(calculateContainDimensions(800, 600, 1800), { width: 800, height: 600 });
});

test('resizes landscape and portrait images without distortion', () => {
    assert.deepEqual(calculateContainDimensions(4000, 3000, 1800), { width: 1800, height: 1350 });
    assert.deepEqual(calculateContainDimensions(3000, 4000, 360), { width: 270, height: 360 });
});

test('rejects invalid dimensions', () => {
    assert.throws(() => calculateContainDimensions(Number.NaN, 100, 360), /尺寸無效/);
    assert.throws(() => calculateContainDimensions(100, 0, 360), /尺寸無效/);
});

test('rejects invalid and oversized uploads', () => {
    assert.throws(() => validateImageFile({ type: 'application/pdf', size: 100 }), /有效的圖片/);
    assert.throws(() => validateImageFile({ type: 'image/svg+xml', size: 100 }), /有效的圖片/);
    assert.throws(() => validateImageFile({ type: 'image/jpeg', size: IMAGE_LIMITS.maxUploadBytes + 1 }), /30MB/);
    assert.doesNotThrow(() => validateImageFile({ type: 'image/jpeg', size: 1024 }));
});
