export const GARMENT_HISTORY_LIMIT = 50;

function cleanLocations(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean))];
}

export function sameLocations(left, right) {
    const a = cleanLocations(left).sort();
    const b = cleanLocations(right).sort();
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function appendGarmentHistory(history, event, now = Date.now()) {
    const existing = Array.isArray(history) ? history.filter(entry => entry && typeof entry === 'object') : [];
    const next = {
        type: String(event?.type || '').trim(),
        at: Number(event?.at) || now,
        fromLocations: cleanLocations(event?.fromLocations),
        toLocations: cleanLocations(event?.toLocations),
        saleEvent: String(event?.saleEvent || '').trim(),
        soldCurrency: String(event?.soldCurrency || '').trim(),
        soldPrice: Number.isFinite(Number(event?.soldPrice)) ? Number(event.soldPrice) : null,
        paymentMethod: String(event?.paymentMethod || '').trim(),
        note: String(event?.note || '').trim()
    };
    if (!next.type) return existing.slice(-GARMENT_HISTORY_LIMIT);
    return [...existing, next].slice(-GARMENT_HISTORY_LIMIT);
}

export function describeGarmentHistory(entry = {}) {
    const from = cleanLocations(entry.fromLocations).join(' + ') || '未分配';
    const to = cleanLocations(entry.toLocations).join(' + ') || '未分配';
    if (entry.type === 'location') return `位置：${from} → ${to}`;
    if (entry.type === 'sold') return `售出：${entry.soldCurrency || ''} ${entry.soldPrice ?? '-'}${entry.saleEvent ? ` · ${entry.saleEvent}` : ''}`.trim();
    if (entry.type === 'sale_corrected') return `更正售出资料：${entry.soldCurrency || ''} ${entry.soldPrice ?? '-'}`.trim();
    if (entry.type === 'sale_reversed') {
        const sale = entry.soldCurrency || entry.soldPrice !== null && entry.soldPrice !== undefined
            ? `（原销售：${entry.soldCurrency || ''} ${entry.soldPrice ?? '-'}${entry.saleEvent ? ` · ${entry.saleEvent}` : ''}）`
            : '';
        return `取消售出，返回库存${sale}`;
    }
    return entry.note || entry.type || '更新';
}
