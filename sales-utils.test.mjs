import assert from 'node:assert/strict';
import test from 'node:test';

import { formatSoldMoney, getPopupSoldLocation, getSoldCurrency } from './sales-utils.js';

test('legacy sales remain MYR while popup sales display SGD', () => {
    assert.equal(getSoldCurrency({ soldPrice: 299 }), 'MYR');
    assert.equal(getSoldCurrency({ soldPrice: 189, soldCurrency: 'SGD' }), 'SGD');
    assert.equal(formatSoldMoney(299, 'MYR'), 'RM299');
    assert.equal(formatSoldMoney(189, 'SGD'), 'SGD 189');
    assert.equal(formatSoldMoney(0, 'SGD'), 'SGD 0');
});

test('popup sale keeps the physical location instead of Online', () => {
    assert.equal(getPopupSoldLocation(['Singapore Popup', 'Online']), 'Singapore Popup');
    assert.equal(getPopupSoldLocation(['Online']), 'Singapore Popup');
});
