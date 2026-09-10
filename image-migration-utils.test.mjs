import test from 'node:test';
import assert from 'node:assert/strict';
import { MIGRATION_BATCH_SIZE, collectMigrationState, makeBackupPayload } from './image-migration-utils.js';

const normalizePhotos = item => item.photos || [];

test('finds only legacy photos that still need thumbnails', () => {
    const state = collectMigrationState([
        { id: 'a', photos: [{ url: 'old.jpg' }, { url: 'new.webp', thumbnailUrl: 'thumb.webp' }] },
        { id: 'b', photos: [{ url: '' }] }
    ], normalizePhotos);
    assert.equal(state.totalPhotos, 2);
    assert.equal(state.optimizedPhotos, 1);
    assert.deepEqual(state.pending, [{ itemId: 'a', photoIdx: 0, sourceUrl: 'old.jpg' }]);
});

test('tracks reversible migrated photos', () => {
    const state = collectMigrationState([
        { id: 'a', photos: [{ url: 'full.webp', thumbnailUrl: 'thumb.webp', originalUrl: 'old.jpg', migratedAt: 123 }] }
    ], normalizePhotos);
    assert.equal(state.rollback.length, 1);
    assert.equal(state.rollback[0].migratedAt, 123);
    assert.equal(MIGRATION_BATCH_SIZE, 10);
});

test('creates a timestamped backup payload without changing item data', () => {
    const items = [{ id: 'a', photos: [{ url: 'old.jpg' }] }];
    const payload = makeBackupPayload(items, new Date('2026-09-10T12:00:00.000Z'));
    assert.equal(payload.format, 'weiweiwei-stock-photo-backup-v1');
    assert.equal(payload.createdAt, '2026-09-10T12:00:00.000Z');
    assert.equal(payload.stockItems, items);
});
