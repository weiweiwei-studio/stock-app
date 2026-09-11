import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assignMissingGarmentIds,
    formatGarmentId,
    hasGarmentIds,
    normalizeStyleSku,
    normalizeStyleSkuCatalog
} from './sku-utils.js';

test('normalizes the existing stockist SKU format', () => {
    assert.equal(normalizeStyleSku(' 2btm005-c '), '2BTM005C');
    assert.equal(formatGarmentId('2btm005', 7), '2BTM005-007');
});

test('assigns one permanent ID to every physical garment', () => {
    const source = [{ url: 'one' }, { url: 'two' }, { url: '' }];
    const result = assignMissingGarmentIds(source, '2BTM005', 4);

    assert.deepEqual(result.photos.map(photo => photo.garmentId), [
        '2BTM005-005',
        '2BTM005-006',
        '2BTM005-007'
    ]);
    assert.equal(result.nextCounter, 7);
    assert.equal(source[0].garmentId, undefined);
});

test('preserves sold and existing garment IDs while allocating only missing IDs', () => {
    const result = assignMissingGarmentIds([
        { garmentId: '2BTM005-002', status: 'Sold', soldPrice: 299 },
        { status: 'Available' }
    ], '2BTM005', 8);

    assert.equal(result.photos[0].garmentId, '2BTM005-002');
    assert.equal(result.photos[0].status, 'Sold');
    assert.equal(result.photos[0].soldPrice, 299);
    assert.equal(result.photos[1].garmentId, '2BTM005-009');
    assert.equal(result.nextCounter, 9);
});

test('advances a stale counter beyond existing IDs', () => {
    const result = assignMissingGarmentIds([
        {},
        { garmentId: '2BTM005-012' }
    ], '2BTM005', 3);

    assert.equal(result.photos[0].garmentId, '2BTM005-013');
    assert.equal(result.nextCounter, 13);
});

test('refuses IDs that belong to another Style SKU', () => {
    assert.throws(
        () => assignMissingGarmentIds([{ garmentId: '2TOP011-001' }], '2BTM005', 0),
        /不一致/
    );
});

test('refuses duplicate existing garment IDs', () => {
    assert.throws(() => assignMissingGarmentIds([
        { garmentId: '2TOP011-001' },
        { garmentId: '2TOP011-001' }
    ], '2TOP011', 1), /重複 Garment ID/);
});

test('normalizes catalog entries and keeps the latest label', () => {
    assert.deepEqual(normalizeStyleSkuCatalog([
        { sku: '2top011', name: 'Old' },
        { sku: '2TOP011', name: 'Ari Top' },
        '2bag008'
    ]), [
        { sku: '2BAG008', name: '' },
        { sku: '2TOP011', name: 'Ari Top' }
    ]);
});

test('detects whether a batch already has permanent IDs', () => {
    assert.equal(hasGarmentIds([{ url: '' }, { garmentId: '2DRS012-001' }]), true);
    assert.equal(hasGarmentIds([{ url: '' }]), false);
});
