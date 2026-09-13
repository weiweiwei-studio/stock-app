import assert from 'node:assert/strict';
import test from 'node:test';
import { computeDashboardStats, photoMatchesDashboardKpi } from './dashboard-utils.js';

const normalizePhotos = item => item.photos;
const category = value => value;

test('dashboard separates production, available, attention and sold pieces', () => {
    const items = [
        { status: 'Making', category: 'Top', photos: [{ status: 'Available', locations: ['JB Studio'] }, { status: 'Available', locations: ['JB Studio'] }] },
        { status: 'Ready', category: 'Dress', photos: [
            { status: 'Available', locations: ['PNG Studio'] },
            { status: 'Available', locations: ['PNG Studio', 'Online'] },
            { status: 'Available', locations: [] },
            { status: 'Sold', locations: ['Singapore Popup'] }
        ] }
    ];
    const stats = computeDashboardStats(items, normalizePhotos, category, ['JB Studio', 'PNG Studio', 'Online', 'Singapore Popup']);
    assert.deepEqual(
        { total: stats.total, available: stats.available, production: stats.production, studio: stats.studio, unallocated: stats.unallocated, sold: stats.sold },
        { total: 6, available: 2, production: 2, studio: 1, unallocated: 1, sold: 1 }
    );
    assert.equal(stats.location['JB Studio'], 0);
    assert.equal(stats.location['PNG Studio'], 1);
    assert.equal(stats.location.Online, 1);
});

test('dashboard KPI lists use the same operational definitions', () => {
    const ready = { status: 'Ready' };
    const making = { status: 'Making' };
    assert.equal(photoMatchesDashboardKpi(ready, { status: 'Available', locations: ['Online'] }, 'Available'), true);
    assert.equal(photoMatchesDashboardKpi(making, { status: 'Available', locations: ['JB Studio'] }, 'Available'), false);
    assert.equal(photoMatchesDashboardKpi(making, { status: 'Available', locations: ['JB Studio'] }, 'Production'), true);
    assert.equal(photoMatchesDashboardKpi(ready, { status: 'Available', locations: [] }, 'Unallocated'), true);
});
