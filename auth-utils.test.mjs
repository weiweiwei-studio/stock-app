import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_EMAIL, getAuthErrorMessage, isAuthorizedAdmin } from './auth-utils.js';

test('authorizes only the configured admin email', () => {
    assert.equal(isAuthorizedAdmin({ email: ADMIN_EMAIL }), true);
    assert.equal(isAuthorizedAdmin({ email: 'HEYWEIWEIWEIMY@GMAIL.COM' }), true);
    assert.equal(isAuthorizedAdmin({ email: 'rie@example.com' }), false);
    assert.equal(isAuthorizedAdmin(null), false);
});

test('returns a safe localized authentication error', () => {
    assert.equal(getAuthErrorMessage('auth/invalid-credential'), 'Email 或密碼錯誤。');
    assert.equal(getAuthErrorMessage('unknown'), '登入失敗，請確認帳號與密碼後重試。');
});
