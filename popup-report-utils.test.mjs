import assert from 'node:assert/strict';
import test from 'node:test';

import { POPUP_SALES_EVENT } from './sales-utils.js';
import { buildPopupSalesCsv, buildSalesCsv, collectAllSales, collectPopupSales, filterPopupSales, filterSales, formatSingaporeDate, getSalesReportEventDateRange, summarizePopupSales, summarizeSalesByCurrency } from './popup-report-utils.js';

const items = [{
    id: 'batch-1', styleSku: '2DRS012', itemName: 'Clairo Dress', category: 'DRESS', photos: [
        { status: 'Sold', garmentId: '2DRS012-001', soldCurrency: 'SGD', soldPrice: 320, soldAt: { seconds: Date.parse('2026-09-18T08:00:00Z') / 1000 }, paymentMethod: 'PayNow', saleEvent: POPUP_SALES_EVENT, soldLocation: 'Singapore Popup', locations: ['Online'], salesNote: 'First day', url: 'https://example.com/full.jpg', thumbnailUrl: 'https://example.com/thumb.jpg' },
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

test('selects a configurable popup event without losing the legacy event', () => {
    const custom = [{
        id: 'batch-2', photos: [
            { status: 'Sold', soldCurrency: 'SGD', soldPrice: 100, salesChannel: 'Popup', saleEvent: 'KL Fairy Market' },
            { status: 'Sold', soldCurrency: 'SGD', soldPrice: 200, salesChannel: 'Popup', saleEvent: POPUP_SALES_EVENT }
        ]
    }];
    assert.equal(collectPopupSales(custom, item => item.photos, 'KL Fairy Market').length, 1);
    assert.equal(collectPopupSales(custom, item => item.photos, POPUP_SALES_EVENT).length, 1);
    assert.equal(collectPopupSales(custom, item => item.photos, '').length, 2);
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

test('collects legacy MYR and popup SGD sales without mixing currencies', () => {
    const records = collectAllSales(items);
    assert.equal(records.length, 3);
    assert.equal(records.find(record => record.garmentId === '2DRS012-003').soldCurrency, 'MYR');
    assert.equal(filterSales(records, { scope: 'event', eventName: POPUP_SALES_EVENT }).length, 2);
    assert.equal(filterSales(records, { scope: 'popup' }).length, 2);
    assert.equal(filterSales(records, { scope: 'all', currency: 'MYR' }).length, 1);

    const summary = summarizeSalesByCurrency(records);
    assert.deepEqual(summary.currencies.SGD, { count: 2, total: 600, average: 300 });
    assert.deepEqual(summary.currencies.MYR, { count: 1, total: 499, average: 499 });
});

test('unified sales CSV includes currency, channel and event with formula protection', () => {
    const records = collectAllSales(items);
    records[0].salesNote = '=HYPERLINK("bad")';
    const csv = buildSalesCsv(records);
    assert.match(csv, /"Currency","Sales Channel","Sale Event"/);
    assert.match(csv, /"SGD","Popup"/);
    assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
    assert.match(csv, /"Image URL"/);
    assert.match(csv, /"https:\/\/example\.com\/full\.jpg"/);
});

test('unified sales records preserve thumbnail and full image references', () => {
    const record = collectAllSales(items).find(candidate => candidate.garmentId === '2DRS012-001');
    assert.equal(record.thumbnailUrl, 'https://example.com/thumb.jpg');
    assert.equal(record.imageUrl, 'https://example.com/full.jpg');
});

test('currency breakdown preserves zero-price sales instead of hiding them', () => {
    const summary = summarizeSalesByCurrency([{ soldCurrency: 'SGD', soldPrice: 0, soldDate: '2026-09-20', paymentMethod: 'Cash' }]);
    assert.equal(summary.currencies.SGD.count, 1);
    assert.equal(summary.byDate['2026-09-20'].SGDCount, 1);
    assert.equal(summary.byPayment.Cash.SGD, 0);
});

test('historical event selection never inherits the active popup date range', () => {
    const activeEvent = { name: POPUP_SALES_EVENT, startDate: '2026-09-18', endDate: '2026-09-20' };
    assert.deepEqual(getSalesReportEventDateRange(POPUP_SALES_EVENT, activeEvent), {
        startDate: '2026-09-18',
        endDate: '2026-09-20'
    });
    assert.deepEqual(getSalesReportEventDateRange('Older Popup', activeEvent), {
        startDate: '',
        endDate: ''
    });
});
