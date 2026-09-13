import assert from 'node:assert/strict';
import test from 'node:test';
import { getSystemBackupFilename, makeSystemBackup, SYSTEM_BACKUP_FORMAT } from './backup-utils.js';

test('complete backup preserves active, archived, sold, history and settings data', () => {
    const soldPhoto = { garmentId: '2DRS012-006', status: 'Sold', soldPrice: 188, history: [{ type: 'sold' }] };
    const items = [
        { id: 'z-active', quantity: 1, photos: [soldPhoto] },
        { id: 'a-archived', archived: true, quantity: 2, photos: [{ garmentId: 'A-1' }, { garmentId: 'A-2' }] }
    ];
    const backup = makeSystemBackup({
        stockItems: items,
        settingsConfig: { styleSkus: [{ sku: '2DRS012' }], popupEvent: { name: 'Common Rare' } },
        garmentCounters: { counters: { '2DRS012': 6 } },
        createdAt: new Date('2026-09-13T12:34:56Z')
    });

    assert.equal(backup.format, SYSTEM_BACKUP_FORMAT);
    assert.deepEqual(backup.counts, { stockItems: 2, activeItems: 1, archivedItems: 1, garments: 3 });
    assert.deepEqual(backup.data.stockItems.map(item => item.id), ['a-archived', 'z-active']);
    assert.deepEqual(items.map(item => item.id), ['z-active', 'a-archived']);
    assert.equal(backup.data.stockItems[1].photos[0].history[0].type, 'sold');
    assert.equal(backup.data.settings.garmentCounters.counters['2DRS012'], 6);
});

test('backup filename contains a portable UTC timestamp', () => {
    assert.equal(getSystemBackupFilename(new Date('2026-09-13T12:34:56Z')), 'weiweiwei-system-backup-2026-09-13T12-34-56Z.json');
});
