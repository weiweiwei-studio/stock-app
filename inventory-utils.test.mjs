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
        createBlankPhoto('JB Studio'),
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
            /只能移除.*沒有照片/
        );
    }
});

test('resizing protects empty units assigned outside the current origin studio', () => {
    const protectedLocations = [
        ['Online'],
        ['Bev C'],
        ['PNG Studio'],
        [],
        ['JB Studio', 'Online']
    ];

    for (const locations of protectedLocations) {
        const assignedUnit = { ...createBlankPhoto('JB Studio'), locations };
        assert.equal(isRemovableEmptyPhoto(assignedUnit, 'JB Studio'), false);
        assert.throws(
            () => resizeItemPhotos([assignedUnit, { ...assignedUnit }], 1, 'JB Studio'),
            /只能移除.*沒有照片/
        );
    }
});

test('resizing uses the stored origin before a same-save studio relocation', () => {
    const storedOrigin = 'JB Studio';
    const newOrigin = 'PNG Studio';
    const photos = [
        createBlankPhoto(storedOrigin),
        { ...createBlankPhoto(storedOrigin), url: 'https://example.com/item.webp' }
    ];

    const resized = resizeItemPhotos(photos, 1, storedOrigin);
    const relocated = resized.map(photo => ({
        ...photo,
        locations: photo.locations.map(location => location === storedOrigin ? newOrigin : location)
    }));

    assert.equal(relocated.length, 1);
    assert.deepEqual(relocated[0].locations, [newOrigin]);
    assert.equal(relocated[0].url, 'https://example.com/item.webp');
});

test('resizing protects every supported history and pricing field', () => {
    const protectedPhotos = [
        { ...createBlankPhoto(), thumbnailUrl: 'https://example.com/thumb.webp' },
        { ...createBlankPhoto(), originalUrl: 'https://example.com/original.jpg' },
        { ...createBlankPhoto(), migratedAt: 1 },
        { ...createBlankPhoto(), soldAt: new Date('2026-01-01') },
        { ...createBlankPhoto(), soldPrice: 0 },
        { ...createBlankPhoto(), specificPrice: 0 }
    ];

    for (const photo of protectedPhotos) {
        assert.equal(isRemovableEmptyPhoto(photo, 'JB Studio'), false);
    }
});

test('invalid quantities fall back to one without mutating source data', () => {
    const source = [createBlankPhoto('JB Studio'), createBlankPhoto('JB Studio')];
    const resized = resizeItemPhotos(source, 'not-a-number', 'JB Studio');

    assert.equal(resized.length, 1);
    assert.equal(source.length, 2);
});

test('empty available units remain removable', () => {
    assert.equal(isRemovableEmptyPhoto(createBlankPhoto('JB Studio'), 'JB Studio'), true);
    assert.equal(isRemovableEmptyPhoto(createBlankPhoto('PNG Studio'), 'PNG Studio'), true);
});
