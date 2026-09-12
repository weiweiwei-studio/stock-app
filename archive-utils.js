export function isArchived(item) {
    return item?.archived === true || Boolean(item?.archivedAt);
}

export function partitionStockItems(items) {
    const active = [];
    const archived = [];

    (Array.isArray(items) ? items : []).forEach(item => {
        (isArchived(item) ? archived : active).push(item);
    });

    return { active, archived };
}

export function isStyleSkuReferenced(items, sku, normalizeSku = value => String(value || '').trim().toUpperCase()) {
    const targetSku = normalizeSku(sku);
    if (!targetSku) return false;
    return (Array.isArray(items) ? items : []).some(item => normalizeSku(item?.styleSku) === targetSku);
}

export function isLocationReferenced(items, location) {
    const targetLocation = String(location || '').trim();
    if (!targetLocation) return false;

    return (Array.isArray(items) ? items : []).some(item => {
        if (String(item?.studio || '').trim() === targetLocation) return true;
        const photos = Array.isArray(item?.photos) ? item.photos : [];
        return photos.some(photo => Array.isArray(photo?.locations) && photo.locations.includes(targetLocation));
    });
}
