export const ADMIN_EMAIL = 'heyweiweiweimy@gmail.com';

export function isAuthorizedAdmin(user) {
    return Boolean(user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL);
}

export function getAuthErrorMessage(code) {
    const messages = {
        'auth/invalid-credential': 'Email 或密碼錯誤。',
        'auth/invalid-email': 'Email 格式不正確。',
        'auth/missing-password': '請輸入密碼。',
        'auth/too-many-requests': '登入嘗試次數過多，請稍後再試。',
        'auth/user-disabled': '此帳號已被停用。',
        'auth/network-request-failed': '網路連線失敗，請檢查連線後重試。'
    };
    return messages[code] || '登入失敗，請確認帳號與密碼後重試。';
}
