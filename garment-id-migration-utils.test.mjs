import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assignLegacyGarmentIds,
    buildGarmentIdMigrationPlan,
    makeGarmentIdMigrationBackup,
    parseGarmentId
} from './garment-id-migration-utils.js';

const catalog = [
    { category: 'DRESS', name: 'Clairo Dress', sku: '2DRS012' },
    { category: 'TOP', name: 'Ari Top', sku: '2TOP011' }
];

test('finds missing IDs and continues after the global maximum for each SKU', () => {
    const plan = buildGarmentIdMigrationPlan([
        { id: 'old', styleSku: '2DRS012', photos: [{ garmentId: '2DRS012-017' }] },
        { id: 'target', styleSku: '2DRS012', quantity: 2 }
    ], catalog);
    assert.equal(plan[0].status, 'unchanged');
    assert.deepEqual(plan[1], {
        itemId: 'target', itemName: '', sku: '2DRS012', version: 0,
        pieceCount: 2, missingCount: 2, maximumSequence: 17,
        status: 'ready', message: '可安全补上 2 个编号'
    });
});

test('blocks invalid, mismatched and globally duplicated existing IDs', () => {
    const plan = buildGarmentIdMigrationPlan([
        { id: 'bad', styleSku: '2DRS012', photos: [{ garmentId: '2DRS012-ABC' }, {}] },
        { id: 'wrong', styleSku: '2DRS012', photos: [{ garmentId: '2TOP011-001' }, {}] },
        { id: 'dup-a', styleSku: '2DRS012', photos: [{ garmentId: '2DRS012-009' }] },
        { id: 'dup-b', styleSku: '2DRS012', photos: [{ garmentId: '2DRS012-009' }, {}] }
    ], catalog);
    assert.match(plan[0].message, /格式无效/);
    assert.match(plan[1].message, /不一致/);
    assert.equal(plan[2].status, 'blocked');
    assert.equal(plan[3].status, 'blocked');
});

test('preserves every existing field and allocates only missing IDs', () => {
    const item = {
        styleSku: '2DRS012', status: 'Partial Sold',
        photos: [
            { garmentId: '2DRS012-004', status: 'Sold', soldPrice: 499, custom: 'keep' },
            { status: 'Available', locations: ['PNG Studio'], url: 'image.jpg' }
        ]
    };
    const result = assignLegacyGarmentIds(item, 8, 12);
    assert.deepEqual(result.photos[0], item.photos[0]);
    assert.deepEqual(result.photos[1], {
        ...item.photos[1], garmentId: '2DRS012-013'
    });
    assert.equal(result.nextCounter, 13);
});

test('preserves explicit per-piece Sold data while adding IDs', () => {
    const result = assignLegacyGarmentIds({
        styleSku: '2DRS012', status: 'Sold',
        photos: [{ status: 'Sold', soldPrice: 399, soldAt: '2026-01-01', locations: ['Singapore Popup'] }]
    }, 0, 0);
    assert.deepEqual(result.photos, [{
        garmentId: '2DRS012-001', status: 'Sold', soldPrice: 399,
        soldAt: '2026-01-01', locations: ['Singapore Popup']
    }]);
});

test('blocks sold records without explicit per-piece lifecycle and backs them up', () => {
    const items = [
        { id: 'sold', styleSku: '2DRS012', status: 'Sold', quantity: 2, soldPrice: 799 },
        { id: 'partial', styleSku: '2DRS012', status: 'Partial Sold', photo: 'legacy.jpg' }
    ];
    const plan = buildGarmentIdMigrationPlan(items, catalog);
    assert.equal(plan[0].status, 'blocked');
    assert.equal(plan[1].status, 'blocked');
    assert.match(plan[0].message, /明确逐件状态/);
    assert.throws(() => assignLegacyGarmentIds(items[0]), /明确逐件状态/);
    const backup = makeGarmentIdMigrationBackup(items, plan, new Date('2026-09-12T00:00:00Z'));
    assert.equal(backup.stockItems[0].status, 'Sold');
    assert.equal(backup.format, 'weiweiwei-garment-id-backup-v1');
});

test('parses only strict positive permanent IDs', () => {
    assert.deepEqual(parseGarmentId('2drs012-007'), { garmentId: '2DRS012-007', sku: '2DRS012', sequence: 7 });
    assert.equal(parseGarmentId('2DRS012-ABC'), null);
    assert.equal(parseGarmentId('2DRS012-000'), null);
});
