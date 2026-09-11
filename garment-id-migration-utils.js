import { formatGarmentId, normalizeStyleSku, normalizeStyleSkuCatalog } from './sku-utils.js';

export const GARMENT_ID_MIGRATION_BATCH_SIZE = 50;

function rawPieces(item = {}) {
    if (Array.isArray(item.photos) && item.photos.length > 0) return item.photos;
    if (item.photo !== undefined && item.photo !== null && item.photo !== '') return [item.photo];
    const quantity = Number.parseInt(item.quantity, 10);
    return Array.from({ length: Number.isInteger(quantity) && quantity > 0 ? quantity : 0 }, () => null);
}

function existingGarmentId(piece) {
    return typeof piece === 'object' && piece !== null
        ? String(piece.garmentId || '').trim().toUpperCase()
        : '';
}

export function parseGarmentId(value) {
    const normalized = String(value || '').trim().toUpperCase();
    const match = normalized.match(/^([A-Z0-9]+)-(\d+)$/);
    if (!match || Number(match[2]) < 1) return null;
    return { garmentId: normalized, sku: normalizeStyleSku(match[1]), sequence: Number(match[2]) };
}

export function buildGarmentIdMigrationPlan(items = [], catalog = []) {
    const validSkus = new Set(normalizeStyleSkuCatalog(catalog).map(entry => entry.sku));
    const occurrences = new Map();
    const maximumBySku = new Map();

    for (const item of items) {
        for (const piece of rawPieces(item)) {
            const garmentId = existingGarmentId(piece);
            if (!garmentId) continue;
            if (!occurrences.has(garmentId)) occurrences.set(garmentId, []);
            occurrences.get(garmentId).push(item.id);
            const parsed = parseGarmentId(garmentId);
            if (parsed) maximumBySku.set(parsed.sku, Math.max(maximumBySku.get(parsed.sku) || 0, parsed.sequence));
        }
    }

    return items.map(item => {
        const sku = normalizeStyleSku(item.styleSku);
        const pieces = rawPieces(item);
        const ids = pieces.map(existingGarmentId);
        const missingCount = ids.filter(id => !id).length;
        const base = {
            itemId: item.id,
            itemName: String(item.itemName || '').trim(),
            sku,
            version: Number.isInteger(Number(item._version)) && Number(item._version) >= 0 ? Number(item._version) : 0,
            pieceCount: pieces.length,
            missingCount,
            maximumSequence: maximumBySku.get(sku) || 0
        };

        if (!sku || !validSkus.has(sku)) return { ...base, status: 'blocked', message: '缺少有效 Style SKU' };
        if (pieces.length === 0) return { ...base, status: 'blocked', message: '没有可编号的实体数量' };

        for (const garmentId of ids.filter(Boolean)) {
            const parsed = parseGarmentId(garmentId);
            if (!parsed) return { ...base, status: 'blocked', message: `Garment ID 格式无效：${garmentId}` };
            if (parsed.sku !== sku) return { ...base, status: 'blocked', message: `Garment ID 与 Style SKU 不一致：${garmentId}` };
            if ((occurrences.get(garmentId) || []).length > 1) return { ...base, status: 'blocked', message: `发现重复 Garment ID：${garmentId}` };
        }

        if (missingCount === 0) return { ...base, status: 'unchanged', message: '每件商品已有永久编号' };
        if (item.status === 'Partial Sold' && !Array.isArray(item.photos)) {
            return { ...base, status: 'blocked', message: '旧 Partial Sold 工单缺少逐件资料，无法安全判断' };
        }
        return { ...base, status: 'ready', message: `可安全补上 ${missingCount} 个编号` };
    });
}

function materializePiece(piece, item) {
    if (typeof piece === 'object' && piece !== null) return { ...piece };
    const sold = item.status === 'Sold';
    const base = {
        url: typeof piece === 'string' ? piece : '',
        thumbnailUrl: '',
        status: sold ? 'Sold' : 'Available',
        locations: sold ? [] : [item.originStudio || 'JB Studio'],
        notes: '',
        soldPrice: sold ? (item.soldPrice ?? null) : null,
        soldAt: sold ? (item.soldAt || null) : null,
        specificPrice: null
    };
    return base;
}

export function assignLegacyGarmentIds(item, currentCounter = 0, minimumCounter = 0) {
    const sku = normalizeStyleSku(item.styleSku);
    let counter = Math.max(Number(currentCounter) || 0, Number(minimumCounter) || 0);
    const pieces = rawPieces(item).map(piece => materializePiece(piece, item));
    const seen = new Set(pieces.map(existingGarmentId).filter(Boolean));
    const nextPhotos = pieces.map(piece => {
        const existing = existingGarmentId(piece);
        if (existing) return { ...piece, garmentId: existing };
        let garmentId;
        do {
            counter += 1;
            garmentId = formatGarmentId(sku, counter);
        } while (seen.has(garmentId));
        seen.add(garmentId);
        return { ...piece, garmentId };
    });
    return { photos: nextPhotos, nextCounter: counter };
}

export function makeGarmentIdMigrationBackup(items, plan, createdAt = new Date()) {
    return {
        format: 'weiweiwei-garment-id-backup-v1',
        createdAt: createdAt.toISOString(),
        stockItems: items,
        eligibleItems: plan.filter(row => row.status === 'ready').map(row => ({
            itemId: row.itemId,
            styleSku: row.sku,
            pieceCount: row.pieceCount,
            missingCount: row.missingCount
        }))
    };
}
