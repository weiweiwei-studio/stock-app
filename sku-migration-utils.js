import { normalizeStyleSku, normalizeStyleSkuCatalog } from './sku-utils.js';

export function normalizeProductName(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu)?.join('') || '';
}

export function getGarmentIdSkus(photos = [], catalog = []) {
    const skus = normalizeStyleSkuCatalog(catalog).map(entry => entry.sku);
    const found = new Set();
    for (const photo of Array.isArray(photos) ? photos : []) {
        const garmentId = String(photo?.garmentId || '').trim().toUpperCase();
        const sku = skus.find(candidate => garmentId.startsWith(`${candidate}-`));
        if (sku) found.add(sku);
    }
    return [...found];
}

export function garmentIdsMatchSku(photos = [], styleSku) {
    const sku = normalizeStyleSku(styleSku);
    return (Array.isArray(photos) ? photos : []).every(photo => {
        const garmentId = String(photo?.garmentId || '').trim().toUpperCase();
        return !garmentId || garmentId.startsWith(`${sku}-`);
    });
}

export function buildLegacySkuPlan(items = [], catalog = [], normalizePhotos = item => item.photos || []) {
    const entries = normalizeStyleSkuCatalog(catalog);
    const bySku = new Map(entries.map(entry => [entry.sku, entry]));
    const byName = new Map();
    for (const entry of entries) {
        const key = normalizeProductName(entry.name);
        if (!key) continue;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(entry);
    }

    return items.map(item => {
        const photos = normalizePhotos(item);
        const currentSku = normalizeStyleSku(item.styleSku);
        const garmentSkus = getGarmentIdSkus(photos, entries);
        const fieldSku = [item.itemName, item.category]
            .map(normalizeStyleSku)
            .find(value => bySku.has(value));
        const nameMatches = byName.get(normalizeProductName(item.itemName)) || [];
        const evidenceSkus = new Set([
            bySku.has(currentSku) ? currentSku : '',
            ...garmentSkus,
            fieldSku || '',
            nameMatches.length === 1 ? nameMatches[0].sku : ''
        ].filter(Boolean));

        let target = bySku.get(currentSku);
        let reason = target ? 'existing-sku' : '';
        if (!target && garmentSkus.length === 1) {
            target = bySku.get(garmentSkus[0]);
            reason = 'garment-id';
        }
        if (!target && fieldSku) {
            target = bySku.get(fieldSku);
            reason = 'sku-in-old-field';
        }
        if (!target && nameMatches.length === 1) {
            target = nameMatches[0];
            reason = 'unique-name';
        }

        const base = {
            itemId: item.id,
            version: Number.isInteger(Number(item._version)) ? Number(item._version) : 0,
            currentSku,
            currentName: String(item.itemName || '').trim(),
            currentCategory: String(item.category || '').trim(),
            garmentSkus,
            candidates: nameMatches,
            target,
            reason
        };

        if (garmentSkus.length > 1) return { ...base, status: 'blocked', message: '同一工單包含不同 SKU 的 Garment ID' };
        if (evidenceSkus.size > 1) return { ...base, status: 'blocked', message: '現有 SKU、品名或 Garment ID 互相衝突' };
        if (!target) return { ...base, status: 'manual', message: nameMatches.length > 1 ? '同名對應多個 SKU' : '找不到唯一配對' };
        if (!garmentIdsMatchSku(photos, target.sku)) return { ...base, status: 'blocked', message: '現有 Garment ID 與建議 SKU 不一致' };

        const targetName = target.name || target.sku;
        const unchanged = currentSku === target.sku
            && base.currentName === targetName
            && base.currentCategory === target.category;
        return { ...base, status: unchanged ? 'unchanged' : 'ready', message: unchanged ? '已正確配對' : '可安全更新' };
    });
}

export function makeSkuMigrationBackup(items, plan, createdAt = new Date()) {
    return {
        format: 'weiweiwei-legacy-sku-backup-v1',
        createdAt: createdAt.toISOString(),
        stockItems: items,
        proposedChanges: plan.filter(row => row.status === 'ready').map(row => ({
            itemId: row.itemId,
            from: { styleSku: row.currentSku, itemName: row.currentName, category: row.currentCategory },
            to: { styleSku: row.target.sku, itemName: row.target.name || row.target.sku, category: row.target.category },
            reason: row.reason
        }))
    };
}
