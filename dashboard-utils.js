export const PRODUCTION_STATUSES = new Set(['Pending', 'To Make', 'Making', 'QC']);

export function isProductionItem(item = {}) {
    return PRODUCTION_STATUSES.has(item.status);
}

export function photoMatchesDashboardKpi(item, photo, value) {
    const sold = photo?.status === 'Sold';
    const production = isProductionItem(item);
    const locations = Array.isArray(photo?.locations) ? photo.locations : [];
    const online = locations.some(location => String(location).toUpperCase() === 'ONLINE');
    const studio = locations.some(location => /JB|PNG/i.test(String(location)));
    if (value === 'Available') return !sold && !production && locations.length > 0;
    if (value === 'Production') return !sold && production;
    if (value === 'Studio') return !sold && !production && studio && !online;
    if (value === 'Unallocated') return !sold && !production && locations.length === 0;
    if (value === 'Sold') return sold;
    if (value === 'Total') return true;
    return false;
}

export function computeDashboardStats(items = [], normalizePhotos, getCategory, locations = []) {
    const stats = {
        total: 0, available: 0, production: 0, studio: 0, unallocated: 0, sold: 0,
        categoryUnsold: {}, categoryUnshipped: {}, location: { Unallocated: 0, Sold: 0 }
    };
    locations.forEach(location => { stats.location[location] = 0; });

    items.forEach(item => {
        const category = getCategory(item.category);
        const photos = normalizePhotos(item);
        if (category) {
            stats.categoryUnsold[category] ||= 0;
            stats.categoryUnshipped[category] ||= 0;
        }
        photos.forEach(photo => {
            stats.total++;
            const photoLocations = Array.isArray(photo.locations) ? photo.locations : [];
            const sold = photo.status === 'Sold';
            const production = isProductionItem(item);
            if (sold) {
                stats.sold++;
                stats.location.Sold++;
                return;
            }
            if (production) {
                stats.production++;
                return;
            }
            if (category) {
                stats.categoryUnsold[category]++;
                const physicallyShipped = photoLocations.some(location => {
                    const upper = String(location).toUpperCase();
                    return !upper.includes('JB') && !upper.includes('PNG') && upper !== 'ONLINE';
                });
                if (!physicallyShipped) stats.categoryUnshipped[category]++;
            }
            if (photoLocations.length === 0) {
                stats.unallocated++;
                stats.location.Unallocated++;
                return;
            }
            stats.available++;
            const online = photoLocations.some(location => String(location).toUpperCase() === 'ONLINE');
            const studio = photoLocations.some(location => /JB|PNG/i.test(String(location)));
            if (studio && !online) stats.studio++;
            photoLocations.forEach(location => {
                const isStudio = /JB|PNG/i.test(String(location));
                if (isStudio && online) return;
                if (stats.location[location] !== undefined) stats.location[location]++;
            });
        });
    });
    return stats;
}
