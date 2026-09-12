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
