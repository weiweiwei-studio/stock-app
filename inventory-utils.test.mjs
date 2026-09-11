import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createBlankPhoto,
    isRemovableEmptyPhoto,
    reconcileNewItemPhotos,
    resizeItemPhotos
} from './inventory-utils.js';

test('new items pad photos to match the requested quantity', () => {
    const uploaded = [{ url: 'https://example.com/one.webp', status: 'Available', locations: ['JB Studio'] }];
    const photos = reconcileNewItemPhotos(uploaded, 3, 'PNG Studio');

    assert.equal(photos.length, 3);
    assert.equal(photos[0].url, uploaded[0].url);
    assert.deepEqual(photos.slice(1), [
        createBlankPhoto('PNG Studio'),
        createBlankPhoto('PNG Studio')
    ]);
    assert.notEqual(photos[0], uploaded[0]);
});

test('uploaded photo count wins when it exceeds requested quantity', () => {
    const uploaded = [
        { url: 'https://example.com/one.webp' },
        { url: 'https://example.com/two.webp' },
        { url: 'https://example.com/three.webp' }
    ];

    assert.equal(reconcileNewItemPhotos(uploaded, 1, 'JB Studio').length, 3);
});

test('resizing upward creates empty units at the selected studio', () => {
    const photos = resizeItemPhotos([], 2, 'PNG Studio');

    assert.deepEqual(photos, [
        createBlankPhoto('PNG Studio'),
        createBlankPhoto('PNG Studio')
    ]);
});

test('resizing downward removes only empty units and preserves meaningful units', () => {
    const sold = { url: '', status: 'Sold', soldPrice: 120, locations: ['Online'] };
    const photographed = { url: 'https://example.com/item.webp', status: 'Available', locations: ['JB Studio'] };
    const photos = [
        createBlankPhoto('JB Studio'),
        sold,
        createBlankPhoto('PNG Studio'),
        photographed
    ];

    assert.deepEqual(resizeItemPhotos(photos, 2, 'JB Studio'), [sold, photographed]);
});

test('resizing refuses to discard photos, sales, notes, or individual prices', () => {
    const protectedPhotos = [
        { ...createBlankPhoto(), url: 'https://example.com/item.webp' },
        { ...createBlankPhoto(), status: 'Sold' },
        { ...createBlankPhoto(), notes: 'VIP reserve' },
        { ...createBlankPhoto(), specificPrice: 88 }
    ];

    for (const photo of protectedPhotos) {
        assert.equal(isRemovableEmptyPhoto(photo), false);
        assert.throws(
            () => resizeItemPhotos([photo, { ...photo }], 1, 'JB Studio'),
            /只能移除沒有照片/
        );
    }
});

test('empty available units remain removable', () => {
    assert.equal(isRemovableEmptyPhoto(createBlankPhoto()), true);
});
