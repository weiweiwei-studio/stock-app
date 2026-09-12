export const POPUP_SALES_CHANNEL = 'Popup';
export const POPUP_SALES_EVENT = 'Common Rare Singapore · Sep 2026';
export const POPUP_SALES_LOCATION = 'Singapore Common Rare Popup · Sep 2026';

export function getSoldCurrency(photo = {}) {
    return String(photo.soldCurrency || 'MYR').trim().toUpperCase() === 'SGD' ? 'SGD' : 'MYR';
}

export function formatSoldMoney(value, currency = 'MYR') {
    if (value === null || value === undefined || value === '') return '-';
    return `${String(currency).toUpperCase() === 'SGD' ? 'SGD ' : 'RM'}${value}`;
}

export function getPopupSoldLocation(locations = []) {
    const values = Array.isArray(locations) ? locations.filter(Boolean) : [];
    return values.find(isSingaporePopupLocation) || POPUP_SALES_LOCATION;
}

export function isSingaporePopupLocation(location) {
    const normalized = String(location || '').trim().toUpperCase();
    return normalized.includes('SINGAPORE') && (normalized.includes('POPUP') || normalized.includes('POP UP'));
}

export function hasSingaporePopupLocation(locations = []) {
    return Array.isArray(locations) && locations.some(isSingaporePopupLocation);
}
