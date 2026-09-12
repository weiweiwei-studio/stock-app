import assert from 'node:assert/strict';
import test from 'node:test';

import { getRemainingTimeout, mapWithConcurrency, summarizeCurrentLocations } from './pdf-export-utils.js';

test('maps images concurrently while preserving their original order', async () => {
    let active = 0;
    let maxActive = 0;
    const progress = [];
    const result = await mapWithConcurrency([30, 5, 15, 1], async value => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, value));
        active -= 1;
        return value * 2;
    }, 2, (completed, total) => progress.push([completed, total]));

    assert.deepEqual(result, [60, 10, 30, 2]);
    assert.equal(maxActive, 2);
    assert.deepEqual(progress.at(-1), [4, 4]);
});

test('uses a per-image timeout without exceeding the overall deadline', () => {
    assert.equal(getRemainingTimeout(Date.now() - 1), 0);
    assert.ok(getRemainingTimeout(Date.now() + 100, 8000) <= 100);
    assert.ok(getRemainingTimeout(Date.now() + 10000, 8000) <= 8000);
});

test('handles an empty image list without starting a worker', async () => {
    let called = false;
    assert.deepEqual(await mapWithConcurrency([], async () => { called = true; }), []);
    assert.equal(called, false);
});

test('summarizes each garment by its current location without double counting', () => {
    assert.deepEqual(summarizeCurrentLocations([
        { status: 'Available', locations: ['PNG Studio'] },
        { status: 'Available', locations: ['PNG Studio'] },
        { status: 'Available', locations: ['JB Studio', 'Online'] },
        { status: 'Sold', locations: ['Singapore Popup'] },
        { status: 'Available', locations: [] }
    ]), [
        { label: 'PNG Studio', count: 2 },
        { label: 'JB Studio + Online', count: 1 },
        { label: 'Sold', count: 1 },
        { label: '未分配', count: 1 }
    ]);
});
