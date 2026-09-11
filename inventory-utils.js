function normalizeQuantity(value) {
    const quantity = Number.parseInt(value, 10);
    return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

export function createBlankPhoto(originStudio = 'JB Studio') {
    return {
        url: '',
        thumbnailUrl: '',
        status: 'Available',
        locations: [originStudio],
        notes: '',
        soldPrice: null,
        specificPrice: null
    };
}

export function isRemovableEmptyPhoto(photo = {}) {
    const status = photo.status || 'Available';
    return !photo.url
        && !photo.thumbnailUrl
        && !photo.originalUrl
        && !photo.migratedAt
        && status === 'Available'
        && !String(photo.notes || '').trim()
        && (photo.soldPrice === null || photo.soldPrice === undefined || photo.soldPrice === '')
        && !photo.soldAt
        && (photo.specificPrice === null || photo.specificPrice === undefined || photo.specificPrice === '');
}

export function reconcileNewItemPhotos(photos, requestedQuantity, originStudio) {
    const nextPhotos = Array.isArray(photos) ? photos.map(photo => ({ ...photo })) : [];
    const targetQuantity = Math.max(normalizeQuantity(requestedQuantity), nextPhotos.length);

    while (nextPhotos.length < targetQuantity) {
        nextPhotos.push(createBlankPhoto(originStudio));
    }

    return nextPhotos;
}

export function resizeItemPhotos(photos, requestedQuantity, originStudio) {
    const nextPhotos = Array.isArray(photos) ? photos.map(photo => ({ ...photo })) : [];
    const targetQuantity = normalizeQuantity(requestedQuantity);

    while (nextPhotos.length < targetQuantity) {
        nextPhotos.push(createBlankPhoto(originStudio));
    }

    const removeCount = nextPhotos.length - targetQuantity;
    if (removeCount <= 0) return nextPhotos;

    const removableIndexes = [];
    for (let index = nextPhotos.length - 1; index >= 0 && removableIndexes.length < removeCount; index--) {
        if (isRemovableEmptyPhoto(nextPhotos[index])) removableIndexes.push(index);
    }

    if (removableIndexes.length < removeCount) {
        throw new Error('無法縮減數量：只能移除沒有照片、售出紀錄、備註或獨立定價的空白單品。');
    }

    const indexesToRemove = new Set(removableIndexes);
    return nextPhotos.filter((_, index) => !indexesToRemove.has(index));
}
