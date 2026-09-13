import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, app, tailwindConfig] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./app.js', import.meta.url), 'utf8'),
    readFile(new URL('./tailwind.config.cjs', import.meta.url), 'utf8')
]);

test('index loads the application from one external module', () => {
    const moduleScripts = [...html.matchAll(/<script\b([^>]*)type=["']module["']([^>]*)>([\s\S]*?)<\/script>/gi)];

    assert.equal(moduleScripts.length, 1);
    assert.match(moduleScripts[0][0], /\bsrc=["']\.\/app\.js["']/i);
    assert.equal(moduleScripts[0][3].trim(), '');
});

test('external module retains the application bootstrap and Firebase imports', () => {
    assert.match(app, /from "https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.1\/firebase-app\.js"/);
    assert.match(app, /onAuthStateChanged\(auth,/);
    assert.match(app, /window\.switchView\s*=/);
    assert.match(app, /function renderActiveView\(/);
});

test('Tailwind scans both the HTML shell and JavaScript templates', () => {
    assert.match(tailwindConfig, /content:\s*\[[^\]]*['"]\.\/index\.html['"][^\]]*['"]\.\/app\.js['"][^\]]*\]/s);
});

test('new work orders derive the product name from category-filtered Style SKUs', () => {
    assert.doesNotMatch(html, /name=["']itemName["']/);
    assert.match(html, /id=["']new-item-category["'][^>]*updateNewItemSkuOptions/);
    assert.match(html, /id=["']new-item-styleSku["']/);
    assert.match(app, /itemName:\s*styleEntry\.name\s*\|\|\s*styleSku/);
    assert.match(app, /styleEntry\.category\s*!==\s*form\.get\(['"]category['"]\)/);
});

test('PDF export applies the allocation category filter', () => {
    assert.match(app, /const catFilter = document\.getElementById\(['"]alloc-filter-category['"]\)\.value/);
    assert.match(app, /filterAllocationItemsByCategory\([\s\S]*?catFilter,[\s\S]*?resolveCategory/);
    assert.match(html, /匯出目前篩選結果 PDF/);
});

test('PDF cells use stable spacing and safe wrapping for long content', () => {
    assert.match(app, /display: flex; flex-wrap: wrap;[^"']*gap: 8px 16px/);
    assert.match(app, /table-layout: fixed; border-collapse: collapse;[^"']*line-height: 1\.45/);
    assert.match(app, /overflow-wrap: anywhere; word-break: break-word/);
    assert.match(app, /line-height: 1\.45; font-size: 10px; color: #78716c;["']>Size:/);
    assert.match(app, /font-family: monospace; font-size: 10px; line-height: 1\.45; white-space: nowrap/);
    assert.match(app, /font-size: 9px; line-height: 1\.45;[^"']*overflow-wrap: anywhere/);
});

test('PDF export keeps complete inventory rows together across pages', () => {
    assert.match(app, /<thead style=["']display: table-header-group;/);
    assert.match(app, /<tr style=["'][^"']*page-break-inside: avoid; break-inside: avoid;/);
    assert.match(app, /pagebreak:\s*\{ mode: \[['"]css['"], ['"]legacy['"]\], avoid: \[['"]tr['"], ['"]\.pdf-report-header['"], ['"]\.pdf-footer['"]\] \}/);
});

test('all-location PDF identifies current locations without crowding specific-location reports', () => {
    const exportStart = app.indexOf('window.exportLocationPDF = async function()');
    const exportEnd = app.indexOf('function resetExportButton', exportStart);
    const exportFunction = app.slice(exportStart, exportEnd);

    assert.notEqual(exportStart, -1);
    assert.notEqual(exportEnd, -1);
    assert.match(exportFunction, /const includeLocationColumn = locFilter === ['"]all['"] \|\| Boolean\(garmentIdSearch\)/);
    assert.match(exportFunction, /summarizeCurrentLocations\(locPhotos\)/);
    assert.match(exportFunction, /includeLocationColumn[\s\S]*目前位置/);
    assert.match(exportFunction, /orientation: includeLocationColumn \? ['"]landscape['"] : ['"]portrait['"]/);
});

test('allocation and PDF export preserve product filtering after category migration', () => {
    assert.match(html, /id=["']alloc-filter-style-sku["']/);
    assert.match(app, /prepareAllocationPage\(\{[\s\S]*?styleSkuFilter,/);
    assert.match(app, /filterAllocationItemsByStyleSku\(categoryItems, styleSkuFilter, normalizeStyleSku\)/);
});

test('inventory provides direct Garment ID search and exact-piece rendering', () => {
    assert.match(html, /id=["']allocation-garment-search["']/);
    assert.match(app, /photoMatchesGarmentSearch\(p, garmentIdSearch\)/);
    assert.match(app, /编号搜索会暂时忽略其他筛选/);
    assert.match(app, /locPhotos = photos\.filter\(photo => photoMatchesGarmentSearch/);
});

test('production and inventory use linked canonical Category and Style SKU filters', () => {
    assert.match(html, /id=["']prod-filter-category["'][^>]*handleCategoryFilterChange\('prod'\)/);
    assert.match(html, /id=["']prod-filter-style-sku["'][^>]*handleStyleSkuFilterChange\('prod'\)/);
    assert.match(html, /id=["']alloc-filter-category["'][^>]*handleCategoryFilterChange\('alloc'\)/);
    assert.match(app, /const canonicalCatalog = normalizeStyleSkuCatalog\(appSettings\.styleSkus\)/);
    assert.doesNotMatch(html, /onclick=["']window\.addSetting\('categories'\)/);
});

test('editing an unmatched legacy item preserves its original category', () => {
    assert.match(app, /const selectedCategory = normalizeStyleSkuCategory\(document\.getElementById\(['"]edit-category['"]\)\.value\)/);
    assert.match(app, /category: requestedStyleEntry\?\.category \|\| selectedCategory \|\| item\.category \|\| ['"]/);
});

test('production and inventory expose numbered pagination containers', () => {
    for (const prefix of ['production', 'allocation']) {
        assert.match(html, new RegExp(`id=["']${prefix}-page-numbers-mobile["']`));
        assert.match(html, new RegExp(`id=["']${prefix}-page-numbers-desktop["']`));
    }
    assert.match(app, /buildPaginationItems\(currentPage, totalPages, maxItems\)/);
    assert.match(app, /window\.goToPage\s*=/);
});

test('legacy SKU migration requires a backup and version-protected updates', () => {
    assert.match(html, /id=["']sku-migration-backup-button["']/);
    assert.match(html, /id=["']sku-migration-run-button["'][^>]*disabled/);
    assert.match(app, /makeSkuMigrationBackup\(db, legacySkuPlan\)/);
    assert.match(app, /assertVersion\(latestItem, row\.version\)/);
    assert.match(app, /garmentIdsMatchSku\(normalizePhotos\(latestItem\), row\.target\.sku\)/);
});

test('legacy Garment ID migration is backup-first and transaction protected', () => {
    assert.match(html, /id=["']garment-id-backup-button["'][^>]*disabled/);
    assert.match(html, /id=["']garment-id-run-button["'][^>]*disabled/);
    assert.match(app, /makeGarmentIdMigrationBackup\(db, garmentIdMigrationPlan\)/);
    assert.match(app, /assertVersion\(latestItem, row\.version\)/);
    assert.match(app, /normalizeStyleSku\(latestItem\.styleSku\) !== row\.sku/);
    assert.match(app, /transaction\.update\(itemRef, \{\s*photos: allocation\.photos,\s*_version:/);
});

test('work orders use recoverable archive instead of permanent deletion', () => {
    assert.match(html, /id=["']archived-items-panel["']/);
    assert.match(html, /onclick=["']window\.handleArchive\(\)["']/);
    assert.doesNotMatch(app, /transaction\.delete\(itemRef\)/);
    assert.match(app, /window\.handleArchive\s*=\s*async\s*(?:function\s*\(\)|\(\)\s*=>)/);
    assert.match(app, /archived:\s*true,[\s\S]*?archivedAt:\s*serverTimestamp\(\)/);
    assert.match(app, /window\.restoreArchivedItem\s*=\s*async function/);
    assert.match(app, /archived:\s*false,[\s\S]*?archivedAt:\s*null/);
    assert.match(app, /db = partitionedItems\.active/);
    assert.match(app, /isStyleSkuReferenced\(allItems, normalizedSku, normalizeStyleSku\)/);
    assert.match(app, /isLocationReferenced\(Array\.from\(stockItemsById\.values\(\)\), val\)/);
});

test('archived work orders expose escaped read-only details before restore', () => {
    assert.match(html, /id=["']archived-detail-modal["']/);
    assert.match(app, /window\.openArchivedItemDetails\s*=\s*function/);
    assert.match(app, /archivedItems\.find\(candidate => candidate\.id === itemId\)/);
    assert.match(app, /getElementById\(['"]archived-detail-pieces['"]\)\.innerHTML/);
    assert.match(app, /escapeHtml\(photo\.garmentId/);
    assert.doesNotMatch(html, /archived-detail-modal[\s\S]*?window\.saveItemDetails\(\)/);
});

test('popup sales capture SGD price, payment, date, location and note without changing legacy MYR', () => {
    assert.match(html, /id=["']popup-sale-mode["']/);
    assert.match(html, /id=["']sold-payment-method["']/);
    assert.match(html, /成交价 \(SGD\)/);
    assert.match(app, /soldCurrency:\s*isPopupSale \? ['"]SGD['"] : ['"]MYR['"]/);
    assert.match(app, /paymentMethod,/);
    assert.match(app, /salesChannel:\s*isPopupSale \? POPUP_SALES_CHANNEL : null/);
    assert.match(app, /saleEvent:\s*isPopupSale \? \(existingPopupSale \?/);
    assert.match(app, /soldLocation:\s*isPopupSale \? \(existingPopupSale \?/);
    assert.match(app, /salesNote:\s*isPopupSale \? noteInput\.value\.trim\(\) : ['"]/);
    assert.match(app, /button\.disabled = true;[\s\S]*?await updateItemStatus\(patch, isPopupSale \? '' : noteInput\.value\.trim\(\), !editingExistingSale/);
    assert.match(app, /preventDuplicateSale && latestPhoto\.status === ['"]Sold['"]/);
    assert.match(app, /soldCurrency:\s*p\.soldCurrency \|\| null/);
    assert.match(app, /getSoldCurrency\(p\) !== ['"]MYR['"]\) return/);
    assert.match(html, /id=["']detail-sale-meta["']/);
    assert.match(app, /hasSingaporePopupLocation\(tempLocations\)/);
    assert.match(app, /isPopupSale \? '' : noteInput\.value\.trim\(\)/);
});

test('unified sales report keeps popup, all-sales and currency filters separate', () => {
    assert.match(html, /id=["']popup-sales-report-modal["']/);
    assert.match(html, /id=["']popup-sales-dashboard-total["']/);
    assert.match(html, /id=["']popup-report-start-date["']/);
    assert.match(html, /id=["']popup-report-payment["']/);
    assert.match(html, /id=["']sales-report-scope["']/);
    assert.match(html, /id=["']sales-report-currency["']/);
    assert.match(app, /collectPopupSales\(\[\.\.\.db, \.\.\.archivedItems\], normalizePhotos,/);
    assert.match(app, /collectAllSales\(\[\.\.\.db, \.\.\.archivedItems\], normalizePhotos\)/);
    assert.match(app, /filterSales\(getAllSalesRecords\(\), filters\)/);
    assert.match(app, /summarizeSalesByCurrency\(records\)/);
    assert.match(app, /buildSalesCsv\(records\)/);
    assert.match(app, /function setSalesReportDatesForSelectedEvent\(\)[\s\S]*?getSalesReportEventDateRange\(selectedEvent, appSettings\.popupEvent\)/);
    assert.match(app, /if \(isEventScope\) \{[\s\S]*?setSalesReportDatesForSelectedEvent\(\);[\s\S]*?\} else \{/);
    assert.match(app, /URL\.revokeObjectURL\(url\)/);
});

test('inventory cards expose a transaction-backed quick sale entry point', () => {
    assert.match(app, /window\.quickStartSold = function\(event, itemId, photoIndex\)/);
    assert.match(app, /quickStartSold\(event,[\s\S]*?min-h-\[44px\][\s\S]*?>售出</);
    assert.match(app, /detailBaseVersion = getVersion\(item\);[\s\S]*?window\.triggerSoldFlow\(\)/);
    assert.match(app, /preventDuplicateSale && latestPhoto\.status === ['"]Sold['"]/);
});

test('mobile item detail uses a dynamic viewport scroll container', () => {
    assert.match(html, /id=["']detail-modal-panel["'][^>]*max-h-\[calc\(100dvh-1rem\)\][^>]*overflow-y-auto/);
    assert.match(html, /id=["']detail-img["'][^>]*max-h-\[32dvh\]/);
    assert.match(html, /md:overflow-y-auto/);
});

test('mobile operational controls use responsive layouts and full-width touch targets', () => {
    assert.match(html, /id=["']production-filter-panel["'][^>]*grid-cols-1[^>]*sm:grid-cols-2[^>]*lg:grid-cols-4/);
    for (const id of ['prod-filter-maker', 'prod-filter-category', 'prod-filter-style-sku', 'prod-filter-status']) {
        assert.match(html, new RegExp(`id=["']${id}["'][^>]*min-h-\\[44px\\][^>]*w-full`));
    }
    assert.match(html, /id=["']allocation-actions["'][^>]*flex-col[^>]*sm:flex-row/);
});

test('garment history and sale corrections are transaction-backed and legacy-compatible', () => {
    assert.match(app, /history:\s*Array\.isArray\(p\.history\)/);
    assert.match(app, /appendGarmentHistory\(photo\.history,[\s\S]*?type:\s*'location'/);
    assert.match(app, /historyType\s*=\s*''[\s\S]*?appendGarmentHistory\(latestPhoto\.history/);
    assert.match(html, /id=["']detail-history["']/);
    assert.match(html, /id=["']btn-return-stock["']/);
    assert.match(app, /editingExistingSale \? 'sale_corrected' : 'sold'/);
    assert.match(app, /if \(expectedVersion !== null\) assertVersion\(latestItem, expectedVersion\)/);
    assert.match(app, /historyType === 'sale_reversed' \? latestPhoto : nextPatch/);
});

test('active popup settings drive new sales while old events remain selectable', () => {
    assert.match(html, /id=["']popup-event-name["']/);
    assert.match(html, /id=["']popup-report-event["']/);
    assert.match(app, /existingPopupSale \? currentPhoto\.saleEvent \|\| appSettings\.popupEvent\.name : appSettings\.popupEvent\.name/);
    assert.match(app, /existingPopupSale \? currentPhoto\.soldLocation \|\| appSettings\.popupEvent\.location : appSettings\.popupEvent\.location/);
    assert.match(app, /getAllSalesRecords\(\)[\s\S]*?filter\(record => record\.isPopupSale\)/);
    assert.match(app, /updateDoc\(doc\(dbFirestore, 'settings', 'config'\), \{ popupEvent \}\)/);
});

test('dashboard uses operational piece definitions and reuses normalized photos', () => {
    assert.match(app, /import \{ computeDashboardStats, photoMatchesDashboardKpi \} from ["']\.\/dashboard-utils\.js["']/);
    assert.match(html, /id=["']kpi-available["']/);
    assert.match(html, /id=["']kpi-production["']/);
    assert.match(app, /computeDashboardStats\(db, normalizePhotos, getCleanCategory, appSettings\.locations\)/);
    assert.match(app, /const normalizedPhotoCache = new WeakMap\(\)/);
    assert.match(app, /normalizedPhotoCache\.get\(item\)/);
    assert.match(app, /photoMatchesDashboardKpi\(item, p, value\)/);
});

test('legacy maintenance scans only when the settings panel is opened', () => {
    assert.match(html, /id=["']data-maintenance-panel["'][^>]*ontoggle=["']window\.handleDataMaintenanceToggle\(this\)["']/);
    assert.match(app, /handleDataMaintenanceToggle = function\(panel\)[\s\S]*?refreshLegacySkuMigration\(\)[\s\S]*?refreshGarmentIdMigration\(\)/);
    const settingsRender = app.match(/window\.renderSettingsView = function\(\)[\s\S]*?\n\s*};/)?.[0] || '';
    assert.doesNotMatch(settingsRender, /refreshLegacySkuMigration|refreshGarmentIdMigration|refreshImageMigrationStatus/);
    assert.doesNotMatch(html, /id=["']settings-categories-list["']/);
});

test('complete JSON backup waits for live snapshots and includes protected counters', () => {
    assert.match(html, /id=["']system-backup-button["']/);
    assert.match(html, /id=["']system-backup-status["'][^>]*aria-live=["']polite["']/);
    assert.match(app, /import \{ getSystemBackupFilename, makeSystemBackup \} from ["']\.\/backup-utils\.js["']/);
    assert.match(app, /let settingsSnapshotReady = false;/);
    assert.match(app, /let stockSnapshotReady = false;/);
    assert.match(app, /if \(!settingsSnapshotReady \|\| !stockSnapshotReady\)/);
    assert.match(app, /getDoc\(doc\(dbFirestore, ['"]settings['"], ['"]garment_counters['"]\)\)/);
    assert.match(app, /Array\.from\(stockItemsById, \(\[id, item\]\) => \(\{ \.\.\.item, id \}\)\)/);
    assert.match(app, /new Blob\(\[JSON\.stringify\(payload, null, 2\)\]/);
    assert.match(app, /getSystemBackupFilename\(now\)/);
    assert.doesNotMatch(html, /restore-system-backup/);
});

test('sale writes expose pending, success and failure states without offline queuing', () => {
    assert.match(html, /id=["']sold-save-status["'][^>]*aria-live=["']assertive["']/);
    assert.match(html, /id=["']operation-toast["'][^>]*aria-live=["']polite["']/);
    assert.match(html, /id=["']btn-cancel-sold["']/);
    assert.match(app, /if \(button\.disabled\) return;/);
    assert.match(app, /if \(navigator\.onLine === false\)/);
    assert.match(app, /正在写入 Firebase/);
    assert.match(app, /button\.disabled = true;[\s\S]*?cancelButton\.disabled = true;[\s\S]*?await updateItemStatus/);
    assert.match(app, /button\.disabled = false;[\s\S]*?cancelButton\.disabled = false;/);
    assert.match(app, /showOperationToast\(`\$\{editingExistingSale[\s\S]*?\$\{garmentIdentity\}[\s\S]*?\$\{currency\} \$\{soldPrice\}/);
    assert.match(app, /setSoldWriteStatus\(`未写入 Firebase：\$\{error\.message\}/);
    assert.doesNotMatch(app, /enablePersistence|persistentLocalCache|offlineQueue/);
});
