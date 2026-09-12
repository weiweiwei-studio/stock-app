export async function mapWithConcurrency(values, worker, concurrency = 6, onProgress = () => {}) {
    const items = Array.isArray(values) ? values : [];
    if (items.length === 0) return [];

    const results = new Array(items.length);
    const workerCount = Math.max(1, Math.min(Number.parseInt(concurrency, 10) || 1, items.length));
    let nextIndex = 0;
    let completed = 0;

    async function runWorker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await worker(items[index], index);
            completed += 1;
            onProgress(completed, items.length);
        }
    }

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
}

export function getRemainingTimeout(deadline, perImageTimeout = 8000) {
    const remaining = Number(deadline) - Date.now();
    if (remaining <= 0) return 0;
    return Math.min(Math.max(1, Number(perImageTimeout) || 1), remaining);
}

export function summarizeCurrentLocations(photos) {
    const counts = new Map();
    (Array.isArray(photos) ? photos : []).forEach(photo => {
        const locations = Array.isArray(photo?.locations)
            ? photo.locations.map(value => String(value || '').trim()).filter(Boolean)
            : [];
        const label = photo?.status === 'Sold'
            ? 'Sold'
            : (locations.length > 0 ? locations.join(' + ') : '未分配');
        counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts].map(([label, count]) => ({ label, count }));
}
