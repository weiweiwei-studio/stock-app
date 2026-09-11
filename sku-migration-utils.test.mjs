import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLegacySkuPlan, garmentIdsMatchSku, makeSkuMigrationBackup } from './sku-migration-utils.js';

const catalog = [
    { category: 'DRESS', name: 'Clairo Dress', sku: '2DRS012' },
    { category: 'DRESS', name: 'Same Name', sku: '2DRS001' },
    { category: 'DRESS', name: 'Same Name', sku: '2DRS002' },
    { category: 'TOP', name: 'Ari Top', sku: '2TOP011' }
];
const photos = item => item.photos || [];

test('matches legacy SKU stored as the old product name', () => {
    const [row] = buildLegacySkuPlan([{ id: 'a', itemName: '2DRS012', category: 'Dress' }], catalog, photos);
    assert.equal(row.status, 'ready');
    assert.equal(row.target.sku, '2DRS012');
    assert.equal(row.reason, 'sku-in-old-field');
});

test('matches only unique canonical names and leaves duplicate names manual', () => {
    const [unique, duplicate] = buildLegacySkuPlan([
        { id: 'a', itemName: 'clairo-dress' },
        { id: 'b', itemName: 'Same Name' }
    ], catalog, photos);
    assert.equal(unique.target.sku, '2DRS012');
    assert.equal(unique.reason, 'unique-name');
    assert.equal(duplicate.status, 'manual');
    assert.deepEqual(duplicate.candidates.map(entry => entry.sku), ['2DRS001', '2DRS002']);
});

test('uses a consistent garment ID prefix but blocks conflicting IDs', () => {
    const [safe, blocked] = buildLegacySkuPlan([
        { id: 'a', itemName: '', photos: [{ garmentId: '2TOP011-003' }] },
        { id: 'b', styleSku: '2DRS012', photos: [{ garmentId: '2TOP011-004' }] }
    ], catalog, photos);
    assert.equal(safe.target.sku, '2TOP011');
    assert.equal(safe.reason, 'garment-id');
    assert.equal(blocked.status, 'blocked');
    assert.equal(garmentIdsMatchSku([{ garmentId: '2TOP011-004' }], '2DRS012'), false);
});

test('keeps unknown records manual instead of guessing', () => {
    const [row] = buildLegacySkuPlan([{ id: 'a', itemName: 'Unknown sample' }], catalog, photos);
    assert.equal(row.status, 'manual');
    assert.equal(row.target, undefined);
});

test('blocks contradictory existing SKU and product-name evidence', () => {
    const [row] = buildLegacySkuPlan([{
        id: 'a',
        styleSku: '2TOP011',
        itemName: '2DRS012'
    }], catalog, photos);
    assert.equal(row.status, 'blocked');
    assert.match(row.message, /互相衝突/);
});

test('keeps correct records unchanged and includes sold records in backup', () => {
    const items = [{ id: 'sold', status: 'Sold', styleSku: '2DRS012', itemName: 'Clairo Dress', category: 'DRESS' }];
    const plan = buildLegacySkuPlan(items, catalog, photos);
    assert.equal(plan[0].status, 'unchanged');
    const backup = makeSkuMigrationBackup(items, plan, new Date('2026-09-11T00:00:00Z'));
    assert.equal(backup.stockItems[0].status, 'Sold');
    assert.equal(backup.format, 'weiweiwei-legacy-sku-backup-v1');
});
