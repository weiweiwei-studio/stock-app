import { POPUP_SALES_EVENT, getSoldCurrency } from './sales-utils.js';

export function formatSingaporeDate(value) {
    if (!value) return '';
    const date = value.seconds !== undefined ? new Date(value.seconds * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const part = type => parts.find(candidate => candidate.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
}

export function collectPopupSales(items = [], normalizePhotos = item => item.photos || []) {
    const records = [];
    items.forEach(item => {
        normalizePhotos(item).forEach((photo, photoIndex) => {
            if (photo.status !== 'Sold' || photo.saleEvent !== POPUP_SALES_EVENT || getSoldCurrency(photo) !== 'SGD') return;
            const amount = Number(photo.soldPrice);
            records.push({
                itemId: item.id || '',
                photoIndex,
                garmentId: photo.garmentId || '',
                styleSku: item.styleSku || '',
                itemName: item.itemName || '',
                category: item.category || '',
                soldDate: formatSingaporeDate(photo.soldAt),
                soldPrice: Number.isFinite(amount) && amount >= 0 ? amount : 0,
                paymentMethod: photo.paymentMethod || 'Not recorded',
                salesNote: photo.salesNote || '',
                soldLocation: photo.soldLocation || '',
                originalLocations: Array.isArray(photo.locations) ? [...photo.locations] : []
            });
        });
    });
    return records.sort((a, b) => b.soldDate.localeCompare(a.soldDate) || a.garmentId.localeCompare(b.garmentId));
}

export function filterPopupSales(records = [], filters = {}) {
    const startDate = String(filters.startDate || '');
    const endDate = String(filters.endDate || '');
    const paymentMethod = String(filters.paymentMethod || 'all');
    return records.filter(record => {
        if (startDate && (!record.soldDate || record.soldDate < startDate)) return false;
        if (endDate && (!record.soldDate || record.soldDate > endDate)) return false;
        if (paymentMethod !== 'all' && record.paymentMethod !== paymentMethod) return false;
        return true;
    });
}

export function summarizePopupSales(records = []) {
    const summary = { count: records.length, total: 0, average: 0, byDate: {}, byPayment: {} };
    records.forEach(record => {
        const amount = Number(record.soldPrice) || 0;
        summary.total += amount;
        const date = record.soldDate || 'Date not recorded';
        const payment = record.paymentMethod || 'Not recorded';
        summary.byDate[date] ||= { count: 0, total: 0 };
        summary.byPayment[payment] ||= { count: 0, total: 0 };
        summary.byDate[date].count++;
        summary.byDate[date].total += amount;
        summary.byPayment[payment].count++;
        summary.byPayment[payment].total += amount;
    });
    summary.average = summary.count ? summary.total / summary.count : 0;
    return summary;
}

function csvCell(value) {
    let text = String(value ?? '');
    if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

export function buildPopupSalesCsv(records = []) {
    const headers = ['Sold Date', 'Garment ID', 'Style SKU', 'Product', 'Category', 'Sold Price (SGD)', 'Payment Method', 'Sales Note', 'Sold Location', 'Original Location'];
    const rows = records.map(record => [
        record.soldDate,
        record.garmentId,
        record.styleSku,
        record.itemName,
        record.category,
        record.soldPrice.toFixed(2),
        record.paymentMethod,
        record.salesNote,
        record.soldLocation,
        record.originalLocations.join(' + ')
    ]);
    return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
