import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { initialProductionFields, malaysiaDate } from './work-order-utils.js';

const now = new Date('2026-11-05T02:00:00Z');
test('initial production status validates actual and scheduled dates', () => {
    assert.deepEqual(initialProductionFields('To Make', '', now), { status: 'To Make', makingAt: null });
    assert.equal(initialProductionFields('To Make', '2026-12-01', now).makingAt.toISOString(), '2026-11-30T16:00:00.000Z');
    assert.equal(initialProductionFields('Making', '2026-11-05', now).status, 'Making');
    for (const [status, date] of [['Making', ''], ['Making', '2026-11-06'], ['Ready', '2026-11-01'], ['To Make', '2026-02-30'], ['To Make', 'invalid']]) {
        assert.throws(() => initialProductionFields(status, date, now));
    }
});

test('Malaysia calendar day survives UTC boundaries and Firestore timestamps', () => {
    assert.equal(malaysiaDate('2026-11-04T16:01:00Z'), '2026-11-05');
    const fields = initialProductionFields('Making', '2026-11-05', now);
    assert.equal(malaysiaDate({ seconds: fields.makingAt.getTime() / 1000 }), '2026-11-05');
});

test('new work orders atomically save production fields and reset the next form', async () => {
    const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
    const nodes = new Map([
        ['new-item-status', { value: 'Making' }],
        ['new-item-making-date', { value: '2026-11-01' }],
        ['btn-submit', { disabled: false }]
    ]);
    const writes = [], errors = [];
    const values = new Map(Object.entries({ initialStatus: 'Making', makingDate: '2026-11-01', originStudio: 'JB Studio', styleSku: '2BTM005', category: 'BOTTOM', quantity: '1' }));
    const context = {
        window: {}, document: { getElementById: id => nodes.get(id), querySelector: () => ({ files: [] }) },
        FormData: class { get(key) { return values.get(key) ?? ''; } },
        initialProductionFields, malaysiaDate,
        reconcileNewItemPhotos: () => [{ status: 'Available' }],
        normalizeStyleSku: value => value, normalizeStyleSkuCatalog: value => value,
        appSettings: { styleSkus: [{ sku: '2BTM005', category: 'BOTTOM' }] },
        doc: (...args) => args, collection: (...args) => args, dbFirestore: {}, serverTimestamp: () => 'SERVER_TIME',
        allocateGarmentIdsFromCounter: () => ({ counters: { '2BTM005': 1 }, styleSku: '2BTM005', photos: [{ garmentId: '2BTM005-001' }] }),
        runTransaction: async (_, callback) => callback({ get: async () => ({ exists: () => false }), set: (ref, data) => writes.push(data) }),
        alert: message => errors.push(message), console: { error() {} }
    };
    runInNewContext(app.slice(app.indexOf('window.syncNewProductionFields ='), app.indexOf('window.openEditModal =')), context);
    let closed = 0;
    context.window.closeModal = () => { closed++; };
    const event = { preventDefault() {}, target: { reset() {
        nodes.get('new-item-status').value = 'To Make';
        nodes.get('new-item-making-date').value = '';
    } } };
    await context.window.handleAddItem(event);
    assert.equal(errors.length, 0);
    assert.equal(writes.length, 2);
    assert.equal(writes[1].status, 'Making');
    assert.equal(malaysiaDate(writes[1].makingAt), '2026-11-01');
    assert.equal(writes[1]._version, 1);
    assert.equal(writes[1].photos[0].garmentId, '2BTM005-001');
    assert.equal(closed, 1);
    assert.equal(nodes.get('new-item-status').value, 'To Make');
    assert.equal(nodes.get('new-item-making-date').value, '');
    assert.equal(nodes.get('new-item-making-date').required, false);
    assert.equal(nodes.get('new-item-making-date').max, '');

    values.set('makingDate', '');
    await context.window.handleAddItem(event);
    assert.equal(writes.length, 2);
    assert.equal(errors.length, 1);
    assert.equal(closed, 1);
    assert.equal(nodes.get('btn-submit').disabled, false);
});
