import assert from 'node:assert/strict';
import test from 'node:test';
import { appendGarmentHistory, describeGarmentHistory, GARMENT_HISTORY_LIMIT, sameLocations } from './garment-history-utils.js';

test('location comparison ignores order and duplicate values', () => {
    assert.equal(sameLocations(['Online', 'JB Studio'], ['JB Studio', 'Online', 'Online']), true);
    assert.equal(sameLocations(['JB Studio'], ['PNG Studio']), false);
});

test('history is append-only, normalized and bounded', () => {
    let history = [];
    for (let index = 0; index < GARMENT_HISTORY_LIMIT + 5; index++) {
        history = appendGarmentHistory(history, { type: 'location', fromLocations: ['JB Studio'], toLocations: ['PNG Studio'] }, index + 1);
    }
    assert.equal(history.length, GARMENT_HISTORY_LIMIT);
    assert.equal(history[0].at, 6);
    assert.equal(history.at(-1).at, GARMENT_HISTORY_LIMIT + 5);
});

test('history descriptions cover movement and sale corrections', () => {
    assert.equal(describeGarmentHistory({ type: 'location', fromLocations: ['JB Studio'], toLocations: ['PNG Studio', 'Online'] }), '位置：JB Studio → PNG Studio + Online');
    assert.equal(describeGarmentHistory({ type: 'sale_corrected', soldCurrency: 'SGD', soldPrice: 220 }), '更正售出资料：SGD 220');
});
