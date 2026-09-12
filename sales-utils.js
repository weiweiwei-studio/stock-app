export const POPUP_SALES_CHANNEL = 'Popup';
export const POPUP_SALES_EVENT = 'Common Rare Singapore · Sep 2026';

export function getSoldCurrency(photo = {}) {
    return String(photo.soldCurrency || 'MYR').trim().toUpperCase() === 'SGD' ? 'SGD' : 'MYR';
}

export function formatSoldMoney(value, currency = 'MYR') {
    if (value === null || value === undefined || value === '') return '-';
    return `${String(currency).toUpperCase() === 'SGD' ? 'SGD ' : 'RM'}${value}`;
}

export function getPopupSoldLocation(locations = []) {
    const values = Array.isArray(locations) ? locations.filter(Boolean) : [];
    return values.find(location => String(location).toUpperCase() !== 'ONLINE') || 'Singapore Popup';
}
