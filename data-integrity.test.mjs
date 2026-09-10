import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EDIT_CONFLICT_CODE,
    assertVersion,
    deriveItemStatus,
    getVersion,
    nextVersion
} from './data-integrity.js';

test('legacy records start at version zero and increment safely', () => {
    assert.equal(getVersion({}), 0);
    assert.equal(getVersion({ _version: 4 }), 4);
    assert.equal(nextVersion({ _version: 4 }), 5);
});

test('stale edits are rejected instead of overwriting newer data', () => {
    assert.doesNotThrow(() => assertVersion({ _version: 2 }, 2));
    assert.throws(
        () => assertVersion({ _version: 3 }, 2),
        error => error.code === EDIT_CONFLICT_CODE
    );
});

test('item status is derived from the latest photo states', () => {
    assert.equal(deriveItemStatus([{ status: 'Available' }]), 'Ready');
    assert.equal(deriveItemStatus([{ status: 'Sold' }, { status: 'Available' }]), 'Partial Sold');
    assert.equal(deriveItemStatus([{ status: 'Sold' }, { status: 'Sold' }]), 'Sold');
});
