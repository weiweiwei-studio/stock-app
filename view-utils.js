export const DEFAULT_PAGE_SIZE = 25;

export function buildPaginationItems(currentPage, totalPages, maxItems = 7) {
    const total = Math.max(1, Number.parseInt(totalPages, 10) || 1);
    const current = Math.min(total, Math.max(1, Number.parseInt(currentPage, 10) || 1));
    const limit = Math.max(5, Number.parseInt(maxItems, 10) || 7);
    if (total <= limit) return Array.from({ length: total }, (_, index) => index + 1);

    const edgeCount = limit - 2;
    if (current <= edgeCount - 1) {
        return [...Array.from({ length: edgeCount }, (_, index) => index + 1), 'ellipsis', total];
    }
    if (current >= total - edgeCount + 2) {
        return [1, 'ellipsis', ...Array.from({ length: edgeCount }, (_, index) => total - edgeCount + index + 1)];
    }

    const middleSlots = limit - 4;
    const start = current - Math.floor((middleSlots - 1) / 2);
    return [1, 'ellipsis', ...Array.from({ length: middleSlots }, (_, index) => start + index), 'ellipsis', total];
}

export function normalizeGarmentIdSearch(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

export function photoMatchesGarmentSearch(photo, searchValue) {
    const query = normalizeGarmentIdSearch(searchValue);
    if (!query) return true;
    const garmentId = normalizeGarmentIdSearch(photo?.garmentId);
    return Boolean(garmentId) && garmentId.startsWith(query);
}

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

export function filterAllocationItemsByCategory(items, categoryFilter, resolveCategory) {
    if (!categoryFilter || categoryFilter === 'all') return items;
    return items.filter(item => resolveCategory(item) === categoryFilter);
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
    garmentIdSearch = '',
    locationFilter,
    requestedPage,
    normalizePhotos,
    resolveCategory,
    normalizeSku = value => String(value || ''),
    pageSize = DEFAULT_PAGE_SIZE
}) {
    const searchQuery = normalizeGarmentIdSearch(garmentIdSearch);
    let filteredItems = searchQuery
        ? items.filter(item => normalizePhotos(item).some(photo => photoMatchesGarmentSearch(photo, searchQuery)))
        : items.filter(item => ['Ready', 'In Studio', 'Sold', 'Partial Sold'].includes(item.status));

    if (!searchQuery) {
        filteredItems = filterAllocationItemsByCategory(filteredItems, categoryFilter, resolveCategory);
        filteredItems = filterAllocationItemsByStyleSku(filteredItems, styleSkuFilter, normalizeSku);
    }

    const matchesPhoto = photo => searchQuery
        ? photoMatchesGarmentSearch(photo, searchQuery)
        : photoMatchesAllocationFilter(photo, locationFilter);
    if (searchQuery || locationFilter !== 'all') {
        filteredItems = filteredItems.filter(item => normalizePhotos(item).some(matchesPhoto));
    }

    const totalMatchingPieces = filteredItems.reduce((sum, item) => {
        return sum + normalizePhotos(item).filter(matchesPhoto).length;
    }, 0);
    const page = paginate(filteredItems, requestedPage, pageSize);

    return { ...page, totalMatchingPieces, searchQuery };
}
