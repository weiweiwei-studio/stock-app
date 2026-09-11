export const DEFAULT_PAGE_SIZE = 25;

export function paginate(items, requestedPage, pageSize = DEFAULT_PAGE_SIZE) {
    const safePageSize = Number.isInteger(pageSize) && pageSize > 0
        ? pageSize
        : DEFAULT_PAGE_SIZE;
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
    const currentPage = Math.max(1, Math.min(Number(requestedPage) || 1, totalPages));
    const start = (currentPage - 1) * safePageSize;

    return {
        currentPage,
        totalItems,
        totalPages,
        items: items.slice(start, start + safePageSize)
    };
}

export function photoMatchesAllocationFilter(photo, locationFilter) {
    if (locationFilter === 'Sold') return photo.status === 'Sold';
    if (photo.status === 'Sold') return false;
    if (locationFilter === 'all') return true;
    if (locationFilter === 'Unallocated') return photo.locations.length === 0;
    return photo.locations.includes(locationFilter);
}

export function filterAllocationItemsByCategory(items, categoryFilter, cleanCategory) {
    if (categoryFilter === 'all') return items;
    return items.filter(item => cleanCategory(item.category) === categoryFilter);
}

export function filterAllocationItemsByStyleSku(items, styleSkuFilter, normalizeSku = value => String(value || '')) {
    if (!styleSkuFilter || styleSkuFilter === 'all') return items;
    const target = normalizeSku(styleSkuFilter);
    return items.filter(item => normalizeSku(item.styleSku) === target);
}

export function prepareAllocationPage({
    items,
    categoryFilter,
    styleSkuFilter = 'all',
    locationFilter,
    requestedPage,
    normalizePhotos,
    cleanCategory,
    normalizeSku = value => String(value || ''),
    pageSize = DEFAULT_PAGE_SIZE
}) {
    let filteredItems = items.filter(item =>
        ['Ready', 'In Studio', 'Sold', 'Partial Sold'].includes(item.status)
    );

    filteredItems = filterAllocationItemsByCategory(filteredItems, categoryFilter, cleanCategory);
    filteredItems = filterAllocationItemsByStyleSku(filteredItems, styleSkuFilter, normalizeSku);

    const matchesPhoto = photo => photoMatchesAllocationFilter(photo, locationFilter);
    if (locationFilter !== 'all') {
        filteredItems = filteredItems.filter(item => normalizePhotos(item).some(matchesPhoto));
    }

    const totalMatchingPieces = filteredItems.reduce((sum, item) => {
        return sum + normalizePhotos(item).filter(matchesPhoto).length;
    }, 0);
    const page = paginate(filteredItems, requestedPage, pageSize);

    return { ...page, totalMatchingPieces };
}
