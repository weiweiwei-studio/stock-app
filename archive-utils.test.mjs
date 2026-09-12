import assert from 'node:assert/strict';
import test from 'node:test';

import {
    isArchived,
    isLocationReferenced,
    isStyleSkuReferenced,
    partitionStockItems
} from './archive-utils.js';

test('legacy and restored records remain active without a migration', () => {
    assert.equal(isArchived({ id: 'legacy' }), false);
    assert.equal(isArchived({ id: 'restored', archived: false, archivedAt: null }), false);
});

test('recognizes both the explicit archive flag and timestamped archive records', () => {
    assert.equal(isArchived({ archived: true, archivedAt: null }), true);
    assert.equal(isArchived({ archivedAt: { seconds: 123 } }), true);
});

test('partitions archived records out of the active operational data set', () => {
    const legacy = { id: 'legacy' };
    const active = { id: 'active', archived: false };
    const archived = { id: 'archived', archived: true };

    assert.deepEqual(partitionStockItems([legacy, archived, active]), {
        active: [legacy, active],
        archived: [archived]
    });
});

test('settings references include archived work orders', () => {
    const items = [{
        archived: true,
        studio: 'Tokyo Stockist',
        styleSku: 'custom-001',
        photos: [{ locations: ['Singapore Popup'] }]
    }];

    assert.equal(isStyleSkuReferenced(items, 'CUSTOM-001'), true);
    assert.equal(isLocationReferenced(items, 'Tokyo Stockist'), true);
    assert.equal(isLocationReferenced(items, 'Singapore Popup'), true);
    assert.equal(isLocationReferenced(items, 'Unused Location'), false);
});
