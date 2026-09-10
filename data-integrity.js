export const EDIT_CONFLICT_CODE = 'edit-conflict';

export function getVersion(item) {
    const version = Number(item?._version);
    return Number.isInteger(version) && version >= 0 ? version : 0;
}

export function nextVersion(item) {
    return getVersion(item) + 1;
}

export function assertVersion(item, expectedVersion) {
    if (getVersion(item) !== expectedVersion) {
        const error = new Error('資料已被另一個使用者更新，請關閉視窗後重新開啟再修改。');
        error.code = EDIT_CONFLICT_CODE;
        throw error;
    }
}

export function deriveItemStatus(photos) {
    if (!Array.isArray(photos) || photos.length === 0) return 'Ready';
    const allSold = photos.every(photo => photo.status === 'Sold');
    const anySold = photos.some(photo => photo.status === 'Sold');
    return allSold ? 'Sold' : (anySold ? 'Partial Sold' : 'Ready');
}
