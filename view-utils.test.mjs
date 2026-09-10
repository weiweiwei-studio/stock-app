import test from 'node:test';
import assert from 'node:assert/strict';
import {
    paginate,
    photoMatchesAllocationFilter,
    prepareAllocationPage
} from './view-utils.js';

const normalizePhotos = item => item.photos;
const cleanCategory = value => value;

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
        cleanCategory,
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
        cleanCategory
    });

    assert.equal(result.totalItems, 2);
    assert.equal(result.totalMatchingPieces, 1);
});
