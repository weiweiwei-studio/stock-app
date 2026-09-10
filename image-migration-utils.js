export const MIGRATION_BATCH_SIZE = 10;

export function collectMigrationState(items, normalizePhotos) {
    const pending = [];
    const rollback = [];
    let totalPhotos = 0;
    let optimizedPhotos = 0;

    for (const item of items) {
        const photos = normalizePhotos(item);
        photos.forEach((photo, photoIdx) => {
            if (!photo.url && !photo.thumbnailUrl && !photo.originalUrl) return;
            totalPhotos++;
            if (photo.thumbnailUrl) optimizedPhotos++;
            if (photo.url && !photo.thumbnailUrl) {
                pending.push({ itemId: item.id, photoIdx, sourceUrl: photo.url });
            }
            if (photo.originalUrl) {
                rollback.push({
                    itemId: item.id,
                    photoIdx,
                    originalUrl: photo.originalUrl,
                    migratedAt: Number(photo.migratedAt) || 0
                });
            }
        });
    }

    return {
        totalPhotos,
        optimizedPhotos,
        pending,
        rollback: rollback.sort((a, b) => b.migratedAt - a.migratedAt)
    };
}

export function makeBackupPayload(items, createdAt = new Date()) {
    return {
        format: 'weiweiwei-stock-photo-backup-v1',
        createdAt: createdAt.toISOString(),
        stockItems: items
    };
}
