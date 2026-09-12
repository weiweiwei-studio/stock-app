import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildPaginationItems,
    filterAllocationItemsByCategory,
    filterAllocationItemsByStyleSku,
    normalizeGarmentIdSearch,
    paginate,
    photoMatchesAllocationFilter,
    photoMatchesGarmentSearch,
    prepareAllocationPage
} from './view-utils.js';

const normalizePhotos = item => item.photos;
const cleanCategory = value => value;

test('allocation export category filter excludes other inventory', () => {
    const items = [
        { itemName: 'Clairo Dress', category: 'Clairo Dress' },
        { itemName: 'Ari Top', category: 'Ari Top' }
    ];

    assert.deepEqual(
        filterAllocationItemsByCategory(items, 'Clairo Dress', item => cleanCategory(item.category)),
        [items[0]]
    );
    assert.equal(filterAllocationItemsByCategory(items, 'all', item => cleanCategory(item.category)), items);
});

test('builds compact numbered pagination for start, middle and end pages', () => {
    assert.deepEqual(buildPaginationItems(1, 3), [1, 2, 3]);
    assert.deepEqual(buildPaginationItems(2, 20, 7), [1, 2, 3, 4, 5, 'ellipsis', 20]);
    assert.deepEqual(buildPaginationItems(10, 20, 7), [1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
    assert.deepEqual(buildPaginationItems(20, 20, 7), [1, 'ellipsis', 16, 17, 18, 19, 20]);
    assert.deepEqual(buildPaginationItems(10, 20, 5), [1, 'ellipsis', 10, 'ellipsis', 20]);
});

test('normalizes and prefix-matches permanent Garment IDs', () => {
    assert.equal(normalizeGarmentIdSearch(' 2drs012 -018 '), '2DRS012-018');
    assert.equal(normalizeGarmentIdSearch('../2drs012-018'), '2DRS012-018');
    assert.equal(photoMatchesGarmentSearch({ garmentId: '2DRS012-018' }, '2drs012-01'), true);
    assert.equal(photoMatchesGarmentSearch({ garmentId: '2DRS012-018' }, '2TOP011'), false);
});

test('allocation Style SKU filter keeps one product across a broad category', () => {
    const items = [
        { styleSku: '2DRS012', category: 'DRESS' },
        { styleSku: '2DRS014', category: 'DRESS' }
    ];
    assert.deepEqual(
        filterAllocationItemsByStyleSku(items, '2drs012', value => String(value || '').toUpperCase()),
        [items[0]]
    );
});

test('paginate clamps invalid and out-of-range pages', () => {
    const items = Array.from({ length: 52 }, (_, index) => index);
    assert.deepEqual(paginate(items, -2, 25).items, items.slice(0, 25));
    assert.equal(paginate(items, 99, 25).currentPage, 3);
    assert.deepEqual(paginate(items, 99, 25).items, items.slice(50));
});

test('paginate returns a stable empty result', () => {
    assert.deepEqual(paginate([], 4, 25), {
        currentPage: 1,
        totalItems: 0,
        totalPages: 1,
        items: []
    });
});

test('allocation filters distinguish sold, unallocated and locations', () => {
    const sold = { status: 'Sold', locations: ['Online'] };
    const unallocated = { status: 'Available', locations: [] };
    const jb = { status: 'Available', locations: ['JB Studio', 'Online'] };

    assert.equal(photoMatchesAllocationFilter(sold, 'Sold'), true);
    assert.equal(photoMatchesAllocationFilter(sold, 'all'), false);
    assert.equal(photoMatchesAllocationFilter(unallocated, 'Unallocated'), true);
    assert.equal(photoMatchesAllocationFilter(jb, 'JB Studio'), true);
    assert.equal(photoMatchesAllocationFilter(jb, 'PNG Studio'), false);
});

test('allocation pagination preserves the full matching piece count', () => {
    const items = [
        {
            status: 'Partial Sold',
            category: 'Top',
            photos: [
                { status: 'Available', locations: ['JB Studio'] },
                { status: 'Sold', locations: ['Online'] }
            ]
        },
        {
            status: 'Ready',
            category: 'Top',
            photos: [{ status: 'Available', locations: ['JB Studio'] }]
        },
        {
            status: 'Ready',
            category: 'Dress',
            photos: [{ status: 'Available', locations: ['PNG Studio'] }]
        }
    ];

    const result = prepareAllocationPage({
        items,
        categoryFilter: 'Top',
        locationFilter: 'JB Studio',
        requestedPage: 1,
        normalizePhotos,
        resolveCategory: item => cleanCategory(item.category),
        pageSize: 1
    });

    assert.equal(result.totalItems, 2);
    assert.equal(result.totalPages, 2);
    assert.equal(result.items.length, 1);
    assert.equal(result.totalMatchingPieces, 2);
});

test('all inventory keeps sold batches but counts only unsold pieces', () => {
    const items = [
        {
            status: 'Sold',
            category: 'Top',
            photos: [{ status: 'Sold', locations: ['Online'] }]
        },
        {
            status: 'Partial Sold',
            category: 'Top',
            photos: [
                { status: 'Available', locations: ['JB Studio'] },
                { status: 'Sold', locations: ['Online'] }
            ]
        }
    ];

    const result = prepareAllocationPage({
        items,
        categoryFilter: 'all',
        locationFilter: 'all',
        requestedPage: 1,
        normalizePhotos,
        resolveCategory: item => cleanCategory(item.category)
    });

    assert.equal(result.totalItems, 2);
    assert.equal(result.totalMatchingPieces, 1);
});

test('Garment ID search bypasses browsing filters and counts only matching pieces', () => {
    const items = [{
        status: 'Sold', styleSku: '2DRS012', category: 'Dress',
        photos: [
            { garmentId: '2DRS012-018', status: 'Sold', locations: ['Singapore Popup'] },
            { garmentId: '2DRS012-019', status: 'Available', locations: ['PNG Studio'] }
        ]
    }];
    const result = prepareAllocationPage({
        items,
        categoryFilter: 'TOP',
        styleSkuFilter: '2TOP011',
        garmentIdSearch: '2drs012-018',
        locationFilter: 'JB Studio',
        requestedPage: 9,
        normalizePhotos,
        resolveCategory: item => item.category
    });
    assert.equal(result.totalItems, 1);
    assert.equal(result.totalMatchingPieces, 1);
    assert.equal(result.currentPage, 1);
    assert.equal(result.searchQuery, '2DRS012-018');
});
