export const SYSTEM_BACKUP_FORMAT = 'weiweiwei-stock-system-backup';
export const SYSTEM_BACKUP_SCHEMA_VERSION = 1;

export function makeSystemBackup({ stockItems = [], settingsConfig = null, garmentCounters = null, createdAt = new Date() } = {}) {
    const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
    if (Number.isNaN(created.getTime())) throw new Error('Invalid backup timestamp');
    const items = [...stockItems].sort((left, right) => String(left?.id || '').localeCompare(String(right?.id || '')));
    const archivedCount = items.filter(item => item?.archived === true || item?.archivedAt).length;
    const garmentCount = items.reduce((sum, item) => {
        if (Array.isArray(item?.photos) && item.photos.length > 0) return sum + item.photos.length;
        if (item?.photo) return sum + 1;
        return sum + Math.max(0, Number.parseInt(item?.quantity, 10) || 0);
    }, 0);

    return {
        format: SYSTEM_BACKUP_FORMAT,
        schemaVersion: SYSTEM_BACKUP_SCHEMA_VERSION,
        createdAt: created.toISOString(),
        counts: {
            stockItems: items.length,
            activeItems: items.length - archivedCount,
            archivedItems: archivedCount,
            garments: garmentCount
        },
        data: {
            stockItems: items,
            settings: {
                config: settingsConfig,
                garmentCounters
            }
        }
    };
}

export function getSystemBackupFilename(createdAt = new Date()) {
    const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid backup timestamp');
    return `weiweiwei-system-backup-${date.toISOString().replace(/[:.]/g, '-').slice(0, 19)}Z.json`;
}
