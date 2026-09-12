import assert from 'node:assert/strict';
import test from 'node:test';

import { POPUP_SALES_EVENT } from './sales-utils.js';
import { buildPopupSalesCsv, collectPopupSales, filterPopupSales, formatSingaporeDate, summarizePopupSales } from './popup-report-utils.js';

const items = [{
    id: 'batch-1', styleSku: '2DRS012', itemName: 'Clairo Dress', category: 'DRESS', photos: [
        { status: 'Sold', garmentId: '2DRS012-001', soldCurrency: 'SGD', soldPrice: 320, soldAt: { seconds: Date.parse('2026-09-18T08:00:00Z') / 1000 }, paymentMethod: 'PayNow', saleEvent: POPUP_SALES_EVENT, soldLocation: 'Singapore Popup', locations: ['Online'], salesNote: 'First day' },
        { status: 'Sold', garmentId: '2DRS012-002', soldCurrency: 'SGD', soldPrice: 280, soldAt: { seconds: Date.parse('2026-09-19T08:00:00Z') / 1000 }, paymentMethod: 'Card', saleEvent: POPUP_SALES_EVENT, locations: ['Singapore Popup'] },
        { status: 'Sold', garmentId: '2DRS012-003', soldCurrency: 'MYR', soldPrice: 499, saleEvent: POPUP_SALES_EVENT },
        { status: 'Available', garmentId: '2DRS012-004', soldCurrency: 'SGD', soldPrice: 200, saleEvent: POPUP_SALES_EVENT }
    ]
}];

test('collects only completed SGD sales for the Singapore popup event', () => {
    const records = collectPopupSales(items);
    assert.equal(records.length, 2);
    assert.equal(records[0].garmentId, '2DRS012-002');
    assert.deepEqual(records[1].originalLocations, ['Online']);
});

test('filters popup sales by inclusive Singapore date and payment method', () => {
    const records = collectPopupSales(items);
    assert.deepEqual(filterPopupSales(records, { startDate: '2026-09-19', endDate: '2026-09-19' }).map(record => record.garmentId), ['2DRS012-002']);
    assert.deepEqual(filterPopupSales(records, { paymentMethod: 'PayNow' }).map(record => record.garmentId), ['2DRS012-001']);
});

test('summarizes count, SGD totals, daily totals and payment totals', () => {
    const summary = summarizePopupSales(collectPopupSales(items));
    assert.equal(summary.count, 2);
    assert.equal(summary.total, 600);
    assert.equal(summary.average, 300);
    assert.deepEqual(summary.byPayment.PayNow, { count: 1, total: 320 });
    assert.deepEqual(summary.byDate['2026-09-19'], { count: 1, total: 280 });
});

test('exports safe CSV content and prevents spreadsheet formulas', () => {
    const records = collectPopupSales(items);
    records[0].salesNote = ' =IMPORTXML("bad")';
    const csv = buildPopupSalesCsv(records);
    assert.match(csv, /"Sold Price \(SGD\)"/);
    assert.match(csv, /"' =IMPORTXML\(""bad""\)"/);
    assert.match(csv, /"2DRS012-001"/);
});

test('formats timestamps in Singapore time', () => {
    assert.equal(formatSingaporeDate({ seconds: Date.parse('2026-09-17T16:30:00Z') / 1000 }), '2026-09-18');
    assert.equal(formatSingaporeDate('invalid'), '');
});
