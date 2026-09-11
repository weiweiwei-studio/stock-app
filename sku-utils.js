export const DEFAULT_STYLE_SKUS = [
    { sku: '2ACC001', name: 'Regular - ori' },
    { sku: '2ACC001A', name: 'Regular - patchwork' },
    { sku: '2ACC002', name: 'XL - ori' },
    { sku: '2ACC002A', name: 'XL - patchwork' },
    { sku: '2ACC004', name: 'Round collar' },
    { sku: '2ACC007', name: 'Sailor collar' },
    { sku: '2ACC009A', name: 'Socks - short' },
    { sku: '2ACC009B', name: 'Socks - midi' },
    { sku: '2ACC009C', name: 'Socks - long' },
    { sku: '2ACC011', name: 'Starry scarf' },
    { sku: '2ACC012', name: 'Baby bonnet - single' },
    { sku: '2ACC012A', name: 'Baby bonnet - double' },
    { sku: '2ACC013', name: 'Demon bonnet - single' },
    { sku: '2ACC013A', name: 'Demon bonnet - double' },
    { sku: '2BAG008', name: 'Bow bag' },
    { sku: '2BTM002', name: 'Short wrap skirt - ori' },
    { sku: '2BTM002C', name: 'Short wrap skirt - custom' },
    { sku: '2BTM002P', name: 'Short wrap skirt - plus size' },
    { sku: '2BTM005', name: 'Long wrap skirt - ori' },
    { sku: '2BTM005C', name: 'Long wrap skirt - custom' },
    { sku: '2BTM005P', name: 'Long wrap skirt - plus size' },
    { sku: '2BTM008', name: 'Belt skirt - ori' },
    { sku: '2BTM008C', name: 'Belt skirt - custom' },
    { sku: '2BTM008P', name: 'Belt skirt - plus size' },
    { sku: '2DRS012', name: 'Clairo dress' },
    { sku: '2DRS014', name: 'Double Mood Apron' },
    { sku: '2TOP009', name: 'Camisole top/dress' },
    { sku: '2TOP011', name: 'Ari Top' },
    { sku: '2TOP012', name: 'Hawaii Shirt' }
];

export function normalizeStyleSku(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeStyleSkuCatalog(values = []) {
    const catalog = new Map();
    for (const value of values) {
        const sku = normalizeStyleSku(typeof value === 'string' ? value : value?.sku);
        if (!sku) continue;
        const name = String(typeof value === 'string' ? '' : value?.name || '').trim();
        catalog.set(sku, { sku, name });
    }
    return [...catalog.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

export function formatGarmentId(styleSku, sequence) {
    const sku = normalizeStyleSku(styleSku);
    const number = Number.parseInt(sequence, 10);
    if (!sku) throw new Error('請先選擇有效的 Style SKU。');
    if (!Number.isInteger(number) || number < 1) throw new Error('Garment 流水號必須大於 0。');
    return `${sku}-${String(number).padStart(3, '0')}`;
}

export function assignMissingGarmentIds(photos, styleSku, currentCounter = 0) {
    const sku = normalizeStyleSku(styleSku);
    if (!sku) throw new Error('請先選擇 Style SKU。');

    let nextCounter = Number.isInteger(Number(currentCounter)) && Number(currentCounter) >= 0
        ? Number(currentCounter)
        : 0;
    const sourcePhotos = Array.isArray(photos) ? photos : [];
    const seen = new Set();
    const idPrefix = `${sku}-`;
    for (const photo of sourcePhotos) {
        const garmentId = String(photo?.garmentId || '').trim().toUpperCase();
        if (!garmentId) continue;
        if (!garmentId.startsWith(idPrefix)) {
            throw new Error(`Garment ID ${garmentId} 與 Style SKU ${sku} 不一致。`);
        }
        if (seen.has(garmentId)) throw new Error(`發現重複 Garment ID：${garmentId}`);
        seen.add(garmentId);
        const existingSequence = Number.parseInt(garmentId.slice(idPrefix.length), 10);
        if (Number.isInteger(existingSequence)) nextCounter = Math.max(nextCounter, existingSequence);
    }

    const nextPhotos = sourcePhotos.map(photo => {
        const garmentId = String(photo?.garmentId || '').trim().toUpperCase();
        if (garmentId) return { ...photo, garmentId };

        do {
            nextCounter += 1;
        } while (seen.has(formatGarmentId(sku, nextCounter)));
        const allocatedId = formatGarmentId(sku, nextCounter);
        seen.add(allocatedId);
        return { ...photo, garmentId: allocatedId };
    });

    return { photos: nextPhotos, nextCounter };
}

export function hasGarmentIds(photos = []) {
    return Array.isArray(photos) && photos.some(photo => String(photo?.garmentId || '').trim());
}
