        import { ADMIN_EMAIL, getAuthErrorMessage, isAuthorizedAdmin } from "./auth-utils.js";
        import { isLocationReferenced, isStyleSkuReferenced, partitionStockItems } from "./archive-utils.js";
        import { POPUP_SALES_CHANNEL, POPUP_SALES_EVENT, formatSoldMoney, getPopupSoldLocation, getSoldCurrency, hasSingaporePopupLocation } from "./sales-utils.js";
        import { buildPopupSalesCsv, collectPopupSales, filterPopupSales, summarizePopupSales } from "./popup-report-utils.js";
        import { assertVersion, deriveItemStatus, getVersion, nextVersion } from "./data-integrity.js";
        import { optimizeImage } from "./image-utils.js";
        import { reconcileNewItemPhotos, resizeItemPhotos } from "./inventory-utils.js";
        import { DEFAULT_STYLE_SKUS, assignMissingGarmentIds, hasGarmentIds, normalizeStyleSku, normalizeStyleSkuCatalog, normalizeStyleSkuCategory } from "./sku-utils.js";
        import { buildLegacySkuPlan, garmentIdsMatchSku, makeSkuMigrationBackup } from "./sku-migration-utils.js";
        import { GARMENT_ID_MIGRATION_BATCH_SIZE, assignLegacyGarmentIds, buildGarmentIdMigrationPlan, makeGarmentIdMigrationBackup } from "./garment-id-migration-utils.js";
        import { getRemainingTimeout, mapWithConcurrency, summarizeCurrentLocations } from "./pdf-export-utils.js";
        import { MIGRATION_BATCH_SIZE, collectMigrationState, makeBackupPayload } from "./image-migration-utils.js";
        import { escapeHtml, inlineString, safeImageUrl } from "./security-utils.js";
        import { DEFAULT_PAGE_SIZE, buildPaginationItems, filterAllocationItemsByCategory, filterAllocationItemsByStyleSku, normalizeGarmentIdSearch, paginate, photoMatchesGarmentSearch, prepareAllocationPage } from "./view-utils.js";
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { getFirestore, collection, updateDoc, doc, onSnapshot, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

        const firebaseConfig = {
            apiKey: "AIzaSyAlB24yzUmGCqsPofuoYhWBiIUj7IWjybc",
            authDomain: "stock-planner-7ca50.firebaseapp.com",
            projectId: "stock-planner-7ca50",
            storageBucket: "stock-planner-7ca50.firebasestorage.app",
            messagingSenderId: "150326512952",
            appId: "1:150326512952:web:0396231677d9841929c5cd"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const dbFirestore = getFirestore(app);
        const storage = getStorage(app);

        let db = [];
        let archivedItems = [];
        let calendarMode = 'production'; 
        let currentCalDate = new Date(); 
        let activeView = 'dashboard';
        let renderFrame = null;
        let unsubscribeSettings = null;
        let unsubscribeStock = null;
        let chartsInitialized = false;
        const PAGE_SIZE = DEFAULT_PAGE_SIZE;
        let productionPage = 1;
        let allocationPage = 1;
        let garmentSearchTimer = null;
        const stockItemsById = new Map();
        let dropdownSignature = '';
        const dirtyViews = new Set(['dashboard', 'production', 'allocation', 'settings']);
        
        let categoryChart = null, allocChart = null, channelChart = null;
        
        let appSettings = { 
            makers: ['Kim', 'Kelly', 'Lijin'], 
            locations: ['JB Studio', 'PNG Studio', 'Online', 'Bev C', 'Fifth', 'Tamara Malas', 'Pop Up', 'Snub', 'Loan', 'Hahhah Store'], 
            categories: ['Top', 'Dress', 'Pants'], 
            styleSkus: DEFAULT_STYLE_SKUS,
            weekly_goals: {} 
        };
        let currentDetailItem = null, currentDetailPhotoIdx = -1, tempLocations = []; 
        let editBaseVersion = 0;
        let migrationBackupReady = false;
        let migrationRunning = false;
        let migrationStopRequested = false;
        const migrationProcessedKeys = new Set();
        let legacySkuPlan = [];
        let legacySkuBackupReady = false;
        let legacySkuMigrationRunning = false;
        let garmentIdMigrationPlan = [];
        let garmentIdBackupReady = false;
        let garmentIdMigrationRunning = false;
        const migrationSessionId = typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        window.tempEditPhotos = []; 
        const catColors = ['#f472b6', '#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#9ca3af'];

        window.getPhotoRank = function(p) {
            if (p.status === 'Sold') return 3;
            const isShipped = p.locations.some(l => {
                const u = l.toUpperCase();
                return !u.includes('JB') && !u.includes('PNG'); 
            });
            return isShipped ? 2 : 1;
        };

        window.getLocColorObj = function(loc) {
            const map = {
                'ONLINE': { bg: '#49bb76', text: '#ffffff' }, 
                'BEV C': { bg: '#d50000', text: '#ffffff' }, 
                'FIFTH': { bg: '#0aa0bf', text: '#ffffff' },
                'TAMARA MALAS': { bg: '#f36e98', text: '#ffffff' }, 
                'POP UP': { bg: '#64748b', text: '#ffffff' }, 
                'SNUB': { bg: '#9862a2', text: '#ffffff' },
                'LOAN': { bg: '#f05006', text: '#ffffff' },
                'HAHHAH STORE': { bg: '#1e3a8a', text: '#ffffff' }, 
                'JB STUDIO': { bg: '#fca00c', text: '#1c1917' }, 
                'PNG STUDIO': { bg: '#00ff99', text: '#1c1917' } 
            };
            const upperLoc = String(loc).toUpperCase();
            for (const key in map) {
                if (upperLoc.includes(key)) return map[key];
            }
            const fallbackPalette = ['#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];
            let hash = 0;
            for (let i = 0; i < String(loc).length; i++) hash = String(loc).charCodeAt(i) + ((hash << 5) - hash);
            return { bg: fallbackPalette[Math.abs(hash) % fallbackPalette.length], text: '#ffffff' };
        };

        function formatDateForInput(firebaseTimestamp) {
            if (!firebaseTimestamp) return '';
            const d = firebaseTimestamp.seconds ? new Date(firebaseTimestamp.seconds * 1000) : new Date(firebaseTimestamp);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function getStatsForMonth(year, month) {
            let stats = { produced: 0, sold: 0, weeks: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
            const firstDay = new Date(year, month, 1).getDay();

            db.forEach(item => {
                let pDate = null;
                if (item.completedAt) pDate = new Date(item.completedAt.seconds ? item.completedAt.seconds * 1000 : item.completedAt);
                else if (['Ready', 'In Studio', 'Sold', 'Partial Sold'].includes(item.status) && item.createdAt) {
                    pDate = new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt);
                }

                const photos = normalizePhotos(item);

                if (pDate && pDate.getFullYear() === year && pDate.getMonth() === month) {
                    const qty = photos.length > 0 ? photos.length : (parseInt(item.quantity) || 1);
                    stats.produced += qty;
                    const d = pDate.getDate();
                    const weekNum = Math.min(5, Math.ceil((d + firstDay) / 7));
                    stats.weeks[weekNum] = (stats.weeks[weekNum] || 0) + qty;
                }

                photos.forEach(p => {
                    if (p.status === 'Sold') {
                        let sDate = p.soldAt ? new Date(p.soldAt.seconds ? p.soldAt.seconds * 1000 : p.soldAt) : null;
                        if (!sDate) sDate = pDate; 

                        if (sDate && sDate.getFullYear() === year && sDate.getMonth() === month) {
                            stats.sold++;
                        }
                    }
                });
            });
            return stats;
        }

        document.addEventListener('DOMContentLoaded', () => {
            const statusEl = document.getElementById('connection-status');
            statusEl.innerText = "Initializing...";
            document.getElementById('form-month-input').value = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
            const loginForm = document.getElementById('login-form');
            document.getElementById('login-email').value = ADMIN_EMAIL;

            if (!auth) return;

            loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const button = document.getElementById('login-button');
                const errorEl = document.getElementById('login-error');
                const email = document.getElementById('login-email').value.trim().toLowerCase();
                const passwordInput = document.getElementById('login-password');

                button.disabled = true;
                button.innerText = '登入中...';
                errorEl.classList.add('hidden');
                try {
                    await signInWithEmailAndPassword(auth, email, passwordInput.value);
                    passwordInput.value = '';
                } catch (error) {
                    errorEl.innerText = getAuthErrorMessage(error.code);
                    errorEl.classList.remove('hidden');
                } finally {
                    button.disabled = false;
                    button.innerText = '登入系統';
                }
            });

            onAuthStateChanged(auth, async (user) => {
                if (user && !isAuthorizedAdmin(user)) {
                    await signOut(auth);
                    showAuthScreen('此帳號沒有系統權限。');
                    return;
                }

                if (user) {
                    document.getElementById('signed-in-email').innerText = user.email || ADMIN_EMAIL;
                    document.getElementById('auth-screen').classList.add('hidden');
                    document.body.classList.remove('auth-pending');
                    statusEl.innerText = "Connected";
                    statusEl.className = "ml-2 px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-600";
                    if (!chartsInitialized) {
                        initCharts();
                        chartsInitialized = true;
                    }
                    if (!unsubscribeSettings && !unsubscribeStock) startListeners();
                    window.updateRole();
                } else {
                    stopListeners();
                    showAuthScreen();
                }
            });
        });

        function startListeners() {
            unsubscribeSettings = onSnapshot(doc(dbFirestore, "settings", "config"), (snap) => {
                if(snap.exists()) {
                    const data = snap.data();
                    let fetchedLocations = data.locations || appSettings.locations;
                    ['JB Studio', 'PNG Studio', 'Online'].forEach(coreLoc => {
                        if (!fetchedLocations.includes(coreLoc)) {
                            fetchedLocations.unshift(coreLoc);
                        }
                    });

                    appSettings = {
                        makers: data.makers || appSettings.makers,
                        locations: fetchedLocations,
                        categories: data.categories || appSettings.categories,
                        styleSkus: normalizeStyleSkuCatalog([...(data.styleSkus || []), ...DEFAULT_STYLE_SKUS]),
                        weekly_goals: data.weekly_goals || {} 
                    };
                }
                updateDropdowns();
                markAllViewsDirty();
                scheduleActiveViewRender();
            }, (error) => {
                showSyncError(error);
            });

            const q = collection(dbFirestore, "stock_items");
            unsubscribeStock = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'removed') {
                        stockItemsById.delete(change.doc.id);
                    } else {
                        stockItemsById.set(change.doc.id, {
                            id: change.doc.id,
                            ...change.doc.data()
                        });
                    }
                });
                const partitionedItems = partitionStockItems(Array.from(stockItemsById.values()));
                db = partitionedItems.active;
                archivedItems = partitionedItems.archived;
                const sortNewestFirst = (a, b) => {
                    if (a.createdAt && b.createdAt) return b.createdAt.seconds - a.createdAt.seconds;
                    if (!a.createdAt) return 1;
                    if (!b.createdAt) return -1;
                    return 0; 
                };
                db.sort(sortNewestFirst);
                archivedItems.sort(sortNewestFirst);
                updateDropdowns();
                markAllViewsDirty();
                scheduleActiveViewRender();
            }, (error) => {
                showSyncError(error);
            });
        }

        function stopListeners() {
            if (unsubscribeSettings) unsubscribeSettings();
            if (unsubscribeStock) unsubscribeStock();
            unsubscribeSettings = null;
            unsubscribeStock = null;
            db = [];
            archivedItems = [];
            stockItemsById.clear();
            dropdownSignature = '';
            markAllViewsDirty();
        }

        function showAuthScreen(message = '') {
            document.body.classList.add('auth-pending');
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('signed-in-email').innerText = '';
            const errorEl = document.getElementById('login-error');
            errorEl.innerText = message;
            errorEl.classList.toggle('hidden', !message);
        }

        window.logout = async function() {
            await signOut(auth);
        };

        function showSyncError(error) {
            const statusEl = document.getElementById('connection-status');
            statusEl.innerText = "Sync Error";
            statusEl.className = "ml-2 px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-600";
            console.error("Firebase sync failed:", error);
        }

        function renderActiveView() {
            if (!dirtyViews.has(activeView)) return;
            if (activeView === 'dashboard') updateDashboard();
            else if (activeView === 'production') window.renderProductionList();
            else if (activeView === 'allocation') window.renderAllocationList();
            else if (activeView === 'settings') window.renderSettingsView();
            dirtyViews.delete(activeView);
        }

        function markAllViewsDirty() {
            ['dashboard', 'production', 'allocation', 'settings'].forEach(view => dirtyViews.add(view));
        }

        function scheduleActiveViewRender() {
            if (renderFrame !== null) return;
            renderFrame = requestAnimationFrame(() => {
                renderFrame = null;
                renderActiveView();
            });
        }

        function normalizePhotos(item) {
            let raw = [];
            if (item.photos && Array.isArray(item.photos)) raw = item.photos;
            else if (item.photo) raw = [item.photo];

            const fallbackStudio = item.originStudio || 'JB Studio';

            if (raw.length === 0 && item.quantity > 0) {
                 return Array.from({ length: item.quantity }, () => ({ url: '', thumbnailUrl: '', status: 'Available', locations: [fallbackStudio], notes: '', soldPrice: null, specificPrice: null }));
            }

            return raw.map(p => {
                if (typeof p === 'string') return { url: p, thumbnailUrl: '', status: 'Available', locations: [fallbackStudio], notes: '', soldPrice: null, specificPrice: null };
                
                let locs = [];
                if (Array.isArray(p.locations) && p.locations.length > 0) {
                    locs = p.locations.map(l => l === 'Studio' ? fallbackStudio : l);
                }
                else if (p.location && p.location !== 'Studio') {
                    locs = [p.location];
                }
                else if (!p.status || p.status !== 'Sold') {
                    locs = [fallbackStudio];
                }
                
                const isOnline = locs.some(l => l.toUpperCase() === 'ONLINE');
                const onlineName = locs.find(l => l.toUpperCase() === 'ONLINE');
                const physicals = locs.filter(l => l.toUpperCase() !== 'ONLINE');
                
                const studios = ['JB Studio', 'PNG Studio'];
                const stockists = physicals.filter(l => !studios.includes(l));
                
                let finalLocs = [];
                if (stockists.length > 0) {
                    finalLocs.push(stockists[0]); 
                } else if (physicals.length > 0) {
                    finalLocs.push(physicals[0]);
                }
                if (isOnline) {
                    finalLocs.push(onlineName);
                }
                
                locs = finalLocs;
                
                return {
                    garmentId: String(p.garmentId || '').trim().toUpperCase(),
                    url: p.url || '',
                    thumbnailUrl: p.thumbnailUrl || '',
                    originalUrl: p.originalUrl || '',
                    migratedAt: Number(p.migratedAt) || 0,
                    status: p.status || 'Available',
                    locations: locs, 
                    notes: p.notes || '',
                    soldPrice: p.soldPrice !== undefined ? p.soldPrice : null,
                    soldAt: p.soldAt || null,
                    soldCurrency: p.soldCurrency || null,
                    paymentMethod: p.paymentMethod || null,
                    salesChannel: p.salesChannel || null,
                    saleEvent: p.saleEvent || null,
                    soldLocation: p.soldLocation || null,
                    salesNote: p.salesNote || '',
                    specificPrice: p.specificPrice !== undefined ? p.specificPrice : null
                };
            });
        }

        async function updatePhotoAtomic(itemId, photoIdx, createPatch, updateStatus = false) {
            const itemRef = doc(dbFirestore, "stock_items", itemId);
            await runTransaction(dbFirestore, async transaction => {
                const snapshot = await transaction.get(itemRef);
                if (!snapshot.exists()) throw new Error('找不到此商品，可能已被刪除。');

                const latestItem = snapshot.data();
                const photos = normalizePhotos(latestItem);
                if (!Number.isInteger(photoIdx) || photoIdx < 0 || photoIdx >= photos.length) {
                    throw new Error('照片資料已變更，請重新開啟商品後再試。');
                }

                const patch = createPatch({ ...photos[photoIdx] }, latestItem);
                photos[photoIdx] = { ...photos[photoIdx], ...patch };
                const updates = {
                    photos,
                    _version: nextVersion(latestItem),
                    updatedAt: serverTimestamp()
                };
                if (updateStatus) updates.status = deriveItemStatus(photos);
                transaction.update(itemRef, updates);
            });
        }

        async function uploadOptimizedPhoto(file, label = 'photo') {
            const optimized = await optimizeImage(file);
            const uniqueId = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const safeLabel = String(label).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
            const metadata = {
                contentType: 'image/webp',
                cacheControl: 'public,max-age=31536000,immutable'
            };
            const fullRef = ref(storage, `photos/full/${uniqueId}_${safeLabel}.webp`);
            const thumbnailRef = ref(storage, `photos/thumbnails/${uniqueId}_${safeLabel}.webp`);
            const [fullSnapshot, thumbnailSnapshot] = await Promise.all([
                uploadBytes(fullRef, optimized.full.blob, metadata),
                uploadBytes(thumbnailRef, optimized.thumbnail.blob, metadata)
            ]);
            const [url, thumbnailUrl] = await Promise.all([
                getDownloadURL(fullSnapshot.ref),
                getDownloadURL(thumbnailSnapshot.ref)
            ]);
            return { url, thumbnailUrl };
        }
        
        function getCleanCategory(catName) {
            if (!catName) return "";
            let str = String(catName).replace(/[\u00A0\s]+/g, ' ').trim().toLowerCase();
            if (!str || str === "unknown" || str === "apron skrit" || str === "aria top") return "";
            return str.charAt(0).toUpperCase() + str.slice(1);
        }

        function categoryLabel(category) {
            return normalizeStyleSkuCategory(category)
                .split('-')
                .filter(Boolean)
                .map(word => word.charAt(0) + word.slice(1).toLowerCase())
                .join(' ');
        }

        function getCatalogContext() {
            const catalog = normalizeStyleSkuCatalog(appSettings.styleSkus);
            const bySku = new Map(catalog.map(entry => [entry.sku, entry]));
            const categories = [...new Set(catalog.map(entry => entry.category).filter(Boolean))].sort();
            const resolveCategory = item => bySku.get(normalizeStyleSku(item.styleSku))?.category || 'legacy';
            return { catalog, bySku, categories, resolveCategory };
        }

        function getStatusColorClass(status) {
            switch(status) {
                case 'Pending': return 'status-pending';
                case 'To Make': return 'status-tomake';
                case 'Making': return 'status-making';
                case 'QC': return 'status-qc';
                case 'Ready': 
                case 'In Studio': return 'status-ready';
                case 'Sold':
                case 'Partial Sold': return 'status-sold';
                default: return 'bg-stone-300';
            }
        }

        function updateDashboard() {
            const totalPieces = db.reduce((sum, item) => sum + (parseInt(item.quantity)||1), 0);
            document.getElementById('kpi-total').textContent = totalPieces;
            const making = db.filter(i => i.status === 'Making').reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
            let soldCount = 0, studioCount = 0, unallocatedCount = 0;
            
            const catUnsoldStats = {};
            const catUnshippedStats = {}; 
            const locStats = { 'Unallocated': 0, 'Sold': 0 };
            
            appSettings.locations.forEach(l => {
                locStats[l] = 0;
            });

            db.forEach(i => {
                const count = i.photos && i.photos.length > 0 ? i.photos.length : (parseInt(i.quantity)||1);
                const cat = getCleanCategory(i.category);
                
                if (cat) {
                    catUnsoldStats[cat] = catUnsoldStats[cat] || 0;
                    catUnshippedStats[cat] = catUnshippedStats[cat] || 0;
                }
                
                const isUnderProduction = ['Pending', 'To Make', 'Making', 'QC'].includes(i.status);
                const photos = normalizePhotos(i);
                
                photos.forEach((p, idx) => {
                    if (p.status === 'Sold') {
                        soldCount++; locStats['Sold']++; 
                    } else {
                        if (cat) {
                            catUnsoldStats[cat]++;
                            
                            const isPhysicalShipped = p.locations.some(loc => {
                                const u = loc.toUpperCase();
                                return !u.includes('JB') && !u.includes('PNG') && u !== 'ONLINE';
                            });
                            if (!isPhysicalShipped && !isUnderProduction) {
                                catUnshippedStats[cat]++; 
                            }
                        }

                        if (p.locations.length > 0) {
                            const isOnline = p.locations.some(loc => loc.toUpperCase() === 'ONLINE');
                            const hasStudio = p.locations.some(loc => loc.toUpperCase().includes('JB') || loc.toUpperCase().includes('PNG'));
                            
                            if (hasStudio && !isOnline && !isUnderProduction) {
                                studioCount++;
                            }
                            
                            p.locations.forEach(loc => {
                                const isStudioLoc = loc.toUpperCase().includes('JB') || loc.toUpperCase().includes('PNG');
                                if (isStudioLoc && isOnline) return; 
                                if(locStats[loc] !== undefined) locStats[loc]++;
                            });
                        } else {
                            unallocatedCount++; locStats['Unallocated']++;
                        }
                    }
                });
            });

            document.getElementById('kpi-making').textContent = making;
            document.getElementById('kpi-studio').textContent = studioCount;
            document.getElementById('kpi-unallocated').textContent = unallocatedCount;
            document.getElementById('kpi-sold').textContent = soldCount;
            renderPopupSalesSnapshot();

            renderCategoryBadges(catUnsoldStats, catUnshippedStats);
            renderLocationButtons(locStats);
            
            updateCharts(locStats, catUnsoldStats);
            renderCalendar(); 
            window.renderPerformanceStats(); 
            window.renderMonthlyCategorySales();
            
            window.updateCatLocDistribution();
            window.updateBusinessAnalytics();
        }

        function getPopupSalesRecords() {
            return collectPopupSales([...db, ...archivedItems], normalizePhotos).map(record => ({
                ...record,
                category: getCleanCategory(record.category)
            }));
        }

        function formatSgdAmount(value) {
            return `SGD ${(Number(value) || 0).toFixed(2)}`;
        }

        function renderPopupSalesSnapshot() {
            const records = getPopupSalesRecords();
            const summary = summarizePopupSales(records);
            const count = document.getElementById('popup-sales-dashboard-count');
            const total = document.getElementById('popup-sales-dashboard-total');
            if (count) count.textContent = `${summary.count} 件`;
            if (total) total.textContent = formatSgdAmount(summary.total);
            const modal = document.getElementById('popup-sales-report-modal');
            if (modal && !modal.classList.contains('hidden') && typeof window.renderPopupSalesReport === 'function') {
                window.renderPopupSalesReport();
            }
        }

        window.openPopupSalesReport = function() {
            const modal = document.getElementById('popup-sales-report-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            window.renderPopupSalesReport();
        };

        window.closePopupSalesReport = function() {
            const modal = document.getElementById('popup-sales-report-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        };

        window.resetPopupSalesFilters = function() {
            document.getElementById('popup-report-start-date').value = '';
            document.getElementById('popup-report-end-date').value = '';
            document.getElementById('popup-report-payment').value = 'all';
            window.renderPopupSalesReport();
        };

        window.renderPopupSalesReport = function() {
            const records = filterPopupSales(getPopupSalesRecords(), {
                startDate: document.getElementById('popup-report-start-date').value,
                endDate: document.getElementById('popup-report-end-date').value,
                paymentMethod: document.getElementById('popup-report-payment').value
            });
            const summary = summarizePopupSales(records);
            document.getElementById('popup-report-count').textContent = summary.count;
            document.getElementById('popup-report-total').textContent = formatSgdAmount(summary.total);
            document.getElementById('popup-report-average').textContent = formatSgdAmount(summary.average);
            document.getElementById('popup-report-filter-status').textContent = `${summary.count} records`;
            document.getElementById('popup-report-export-button').disabled = records.length === 0;

            const renderBreakdown = (entries, emptyText) => entries.length
                ? entries.map(([label, value]) => `<div class="flex items-center justify-between gap-3 rounded bg-stone-50 px-3 py-2 text-xs"><span class="font-bold text-stone-600">${escapeHtml(label)}</span><span class="text-stone-500">${value.count} 件 · <b class="text-stone-800">${escapeHtml(formatSgdAmount(value.total))}</b></span></div>`).join('')
                : `<p class="py-2 text-xs text-stone-400">${emptyText}</p>`;

            const dailyEntries = Object.entries(summary.byDate).sort(([a], [b]) => a.localeCompare(b));
            const paymentEntries = Object.entries(summary.byPayment).sort(([, a], [, b]) => b.total - a.total);
            document.getElementById('popup-report-daily').innerHTML = renderBreakdown(dailyEntries, '没有符合条件的销售。');
            document.getElementById('popup-report-payments').innerHTML = renderBreakdown(paymentEntries, '没有付款记录。');

            const list = document.getElementById('popup-report-list');
            if (!records.length) {
                list.innerHTML = '<div class="rounded bg-stone-50 py-8 text-center text-sm text-stone-400">没有符合条件的 Singapore Popup 销售。</div>';
                return;
            }
            list.innerHTML = records.map(record => {
                const identity = record.garmentId || `${record.styleSku || 'Item'} #${record.photoIndex + 1}`;
                const originalLocation = record.originalLocations.join(' + ') || 'No location';
                return `<div class="rounded border border-stone-200 p-3">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="break-words font-mono text-sm font-black text-stone-800">${escapeHtml(identity)}</div>
                            <div class="mt-1 break-words text-xs text-stone-600">${escapeHtml(record.itemName || record.styleSku || '-')} · ${escapeHtml(record.category || '-')}</div>
                        </div>
                        <div class="flex-shrink-0 text-right"><div class="font-black text-pink-700">${escapeHtml(formatSgdAmount(record.soldPrice))}</div><div class="mt-1 text-[10px] text-stone-500">${escapeHtml(record.paymentMethod)}</div></div>
                    </div>
                    <div class="mt-2 text-[10px] leading-5 text-stone-500">${escapeHtml(record.soldDate || 'Date not recorded')} · Sold at: ${escapeHtml(record.soldLocation || 'Singapore Popup')} · From: ${escapeHtml(originalLocation)}</div>
                    ${record.salesNote ? `<div class="mt-1 break-words rounded bg-yellow-50 px-2 py-1 text-xs text-stone-600">Note: ${escapeHtml(record.salesNote)}</div>` : ''}
                </div>`;
            }).join('');
        };

        window.exportPopupSalesCsv = function() {
            const records = filterPopupSales(getPopupSalesRecords(), {
                startDate: document.getElementById('popup-report-start-date').value,
                endDate: document.getElementById('popup-report-end-date').value,
                paymentMethod: document.getElementById('popup-report-payment').value
            });
            if (!records.length) {
                alert('没有可导出的 Singapore Popup 销售记录。');
                return;
            }
            const blob = new Blob([`\uFEFF${buildPopupSalesCsv(records)}`], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Singapore_Popup_Sales_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        };
        
        window.renderMonthlyCategorySales = function() {
            const container = document.getElementById('monthly-category-sales-container');
            if (!container) return;
            container.innerHTML = '';

            let iterDate = new Date(currentCalDate.getFullYear(), currentCalDate.getMonth(), 1);
            let html = '';

            for (let i = 0; i < 6; i++) {
                const y = iterDate.getFullYear();
                const m = iterDate.getMonth();
                const monthLabel = iterDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                
                let catSales = {};
                let totalSalesThisMonth = 0;
                
                db.forEach(item => {
                    const cleanCat = getCleanCategory(item.category);
                    if (!cleanCat) return;

                    const photos = normalizePhotos(item);
                    
                    let pDate = null;
                    if (item.completedAt) pDate = new Date(item.completedAt.seconds ? item.completedAt.seconds * 1000 : item.completedAt);
                    else if (['Ready', 'In Studio', 'Sold', 'Partial Sold'].includes(item.status) && item.createdAt) {
                        pDate = new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt);
                    }

                    photos.forEach(p => {
                        if (p.status === 'Sold') {
                            let sDate = p.soldAt ? new Date(p.soldAt.seconds ? p.soldAt.seconds * 1000 : p.soldAt) : null;
                            if (!sDate) sDate = pDate; 

                            if (sDate && sDate.getFullYear() === y && sDate.getMonth() === m) {
                                catSales[cleanCat] = (catSales[cleanCat] || 0) + 1;
                                totalSalesThisMonth++;
                            }
                        }
                    });
                });

                const sortedCats = Object.keys(catSales).sort((a, b) => catSales[b] - catSales[a]);

                let catHtml = '';
                if (sortedCats.length === 0) {
                    catHtml = '<span class="text-[10px] text-stone-400 italic py-1">無售出紀錄</span>';
                } else {
                    sortedCats.forEach(cat => {
                        catHtml += `
                            <div class="bg-white border border-stone-200 px-2 py-1 rounded text-[10px] flex items-center justify-between gap-1 shadow-sm whitespace-nowrap group hover:border-amber-300 transition-colors">
                                <span class="font-bold text-stone-600">${escapeHtml(cat)}</span>
                                <span class="text-stone-800 bg-stone-100 px-1.5 rounded font-black">${catSales[cat]}</span>
                            </div>
                        `;
                    });
                }

                html += `
                    <div class="flex flex-col py-2 border-b border-stone-100 last:border-0 hover:bg-stone-50/50 px-2 rounded transition-colors">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-bold text-stone-700">${monthLabel}</span>
                            <span class="text-[10px] text-stone-500 font-bold bg-amber-100/50 px-2 py-0.5 rounded text-amber-800 border border-amber-200/50">Total: ${totalSalesThisMonth}</span>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            ${catHtml}
                        </div>
                    </div>
                `;
                
                iterDate.setMonth(iterDate.getMonth() - 1);
            }
            container.innerHTML = html;
        };

        window.updateCatLocDistribution = function() {
            const selectEl = document.getElementById('dash-filter-cat-loc');
            if (!selectEl) return;
            const selectedCat = selectEl.value;
            const container = document.getElementById('dash-cat-loc-container');
            container.innerHTML = '';
            
            let locStats = {};
            appSettings.locations.forEach(l => locStats[l] = 0);
            locStats['Unallocated'] = 0;
            const { resolveCategory } = getCatalogContext();
            
            db.forEach(item => {
                const itemCategory = resolveCategory(item);
                if (selectedCat !== 'all' && itemCategory !== selectedCat) return;
                
                const photos = normalizePhotos(item);
                photos.forEach(p => {
                    if (p.status !== 'Sold') {
                        if (p.locations.length > 0) {
                            const isOnline = p.locations.some(loc => loc.toUpperCase() === 'ONLINE');
                            p.locations.forEach(loc => {
                                const isStudioLoc = loc.toUpperCase().includes('JB') || loc.toUpperCase().includes('PNG');
                                if (isStudioLoc && isOnline) return; 
                                if(locStats[loc] !== undefined) locStats[loc]++;
                            });
                        } else {
                            locStats['Unallocated']++;
                        }
                    }
                });
            });
            
            const sortedLocs = Object.keys(locStats).filter(l => locStats[l] > 0).sort((a,b) => locStats[b] - locStats[a]);
            
            if (sortedLocs.length === 0) {
                container.innerHTML = '<div class="text-[10px] text-stone-400 text-center py-3 bg-stone-50 rounded">此類別目前無相關庫存資料</div>';
                return;
            }
            
            const max = locStats[sortedLocs[0]];
            let html = '';
            sortedLocs.forEach(loc => {
                const count = locStats[loc];
                const pct = (count / max) * 100;
                const bgHex = loc === 'Unallocated' ? '#9ca3af' : window.getLocColorObj(loc).bg;
                
                html += `
                    <div class="flex items-center justify-between text-[10px] mb-1.5 group cursor-pointer" onclick="window.openListModal('cat_loc', ${inlineString(selectedCat + '|' + loc)})">
                        <span class="font-bold text-stone-600 truncate w-24 text-left group-hover:text-stone-900 transition-colors">${escapeHtml(loc)}</span>
                        <div class="flex-grow mx-2 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-500 opacity-80 group-hover:opacity-100" style="width: ${pct}%; background-color: ${bgHex};"></div>
                        </div>
                        <span class="font-bold text-stone-800 w-8 text-right bg-stone-50 px-1 rounded border border-stone-100">${count}</span>
                    </div>
                `;
            });
            container.innerHTML = html;
        };

        window.renderPerformanceStats = function() {
            const displayDate = currentCalDate;
            const currentYear = displayDate.getFullYear();
            const currentMonth = displayDate.getMonth();
            
            document.getElementById('perf-weekly-month').innerText = displayDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

            const currentMonthStats = getStatsForMonth(currentYear, currentMonth);
            const weeklyContainer = document.getElementById('perf-weekly-container');
            weeklyContainer.innerHTML = '';
            
            let maxWeekQty = Math.max(...Object.values(currentMonthStats.weeks), 1); 

            for(let w=1; w<=5; w++) {
                const qty = currentMonthStats.weeks[w];
                const pct = (qty / maxWeekQty) * 100;
                weeklyContainer.innerHTML += `
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold text-stone-500 w-12 text-right">Week ${w}</span>
                        <div class="flex-grow bg-stone-100 rounded-full h-2.5 overflow-hidden">
                            <div class="bg-emerald-400 h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                        </div>
                        <span class="text-xs font-bold text-stone-700 w-8">${qty}</span>
                    </div>
                `;
            }

            const monthlyTbody = document.getElementById('perf-monthly-tbody');
            monthlyTbody.innerHTML = '';
            
            let iterDate = new Date(currentYear, currentMonth, 1);
            let rowsHTML = '';
            
            for(let i=0; i<6; i++) {
                const y = iterDate.getFullYear();
                const m = iterDate.getMonth();
                const mStats = getStatsForMonth(y, m);
                const monthLabel = iterDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                
                let sellThrough = mStats.produced > 0 ? Math.round((mStats.sold / mStats.produced) * 100) : (mStats.sold > 0 ? 100 : 0);
                
                rowsHTML += `
                    <tr class="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td class="py-2.5 px-3 font-bold text-stone-600">${monthLabel}</td>
                        <td class="py-2.5 px-3"><span class="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-bold border border-emerald-100">${mStats.produced} 件</span></td>
                        <td class="py-2.5 px-3"><span class="bg-pink-50 text-pink-700 px-2 py-1 rounded text-xs font-bold border border-pink-100">${mStats.sold} 件</span></td>
                        <td class="py-2.5 px-3 text-xs text-stone-500 font-bold">${sellThrough}%</td>
                    </tr>
                `;
                iterDate.setMonth(iterDate.getMonth() - 1);
            }
            monthlyTbody.innerHTML = rowsHTML;
        };
        
        window.setCalendarMode = function(mode) {
            calendarMode = mode;
            const btnProd = document.getElementById('btn-mode-production');
            const btnArr = document.getElementById('btn-mode-arrival');
            
            if(mode === 'production') {
                btnProd.className = "px-3 py-1.5 text-xs font-bold rounded-md shadow bg-white text-stone-800 transition-all flex items-center gap-1";
                btnArr.className = "px-3 py-1.5 text-xs font-bold rounded-md text-stone-500 hover:text-stone-800 transition-all flex items-center gap-1";
                document.getElementById('unscheduled-container').classList.remove('hidden');
                document.getElementById('weekly-stats-container').classList.add('hidden');
            } else {
                btnProd.className = "px-3 py-1.5 text-xs font-bold rounded-md text-stone-500 hover:text-stone-800 transition-all flex items-center gap-1";
                btnArr.className = "px-3 py-1.5 text-xs font-bold rounded-md shadow bg-emerald-100 text-emerald-800 transition-all flex items-center gap-1";
                document.getElementById('unscheduled-container').classList.add('hidden');
                document.getElementById('weekly-stats-container').classList.remove('hidden');
            }
            renderCalendar();
        };

        window.changeMonth = function(delta) {
            currentCalDate.setMonth(currentCalDate.getMonth() + delta);
            renderCalendar();
            window.renderPerformanceStats();
            window.renderMonthlyCategorySales(); 
        };

        window.setWeeklyGoal = async function(year, month, week) {
            const key = `y${year}m${month}w${week}`;
            const current = appSettings.weekly_goals[key] || 0;
            const val = prompt(`Set Target for ${year}/${month+1} Week ${week}:`, current);
            if (val !== null) {
                const num = parseInt(val) || 0;
                await updateDoc(doc(dbFirestore, "settings", "config"), { [`weekly_goals.${key}`]: num });
            }
        };

        function renderCalendar() {
            const displayDate = currentCalDate;
            const year = displayDate.getFullYear();
            const month = displayDate.getMonth();
            const today = new Date();

            const monthName = displayDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            document.getElementById('calendar-month-label').innerText = monthName;
            
            const unscheduledContainer = document.getElementById('cal-unscheduled-list');
            const gridContainer = document.getElementById('calendar-days-container');
            const weeklyGoalsList = document.getElementById('weekly-goals-list');
            
            unscheduledContainer.innerHTML = '';
            gridContainer.innerHTML = '';
            weeklyGoalsList.innerHTML = '';

            if (calendarMode === 'production') {
                const monthShort = displayDate.toLocaleString('en-US', { month: 'short' });
                document.getElementById('unscheduled-month-label').innerText = monthShort;
                
                const unscheduled = db.filter(item => 
                    !item.makingAt && item.month && item.month.includes(monthShort)
                );
                document.getElementById('unscheduled-count').innerText = unscheduled.length;
                if(unscheduled.length === 0) unscheduledContainer.innerHTML = '<span class="text-[10px] text-stone-300 italic">None</span>';
                else {
                    unscheduled.forEach(i => {
                        let colorClass = getStatusColorClass(i.status);
                        unscheduledContainer.innerHTML += `
                            <div onclick="window.openEditModal(${inlineString(i.id)})" class="${colorClass} text-[10px] px-2 py-1 rounded cursor-pointer hover:opacity-80 transition shadow-sm border border-black/5">
                                ${escapeHtml(getCleanCategory(i.category))}: ${escapeHtml(i.itemName)}
                            </div>`;
                    });
                }
            }

            const firstDay = new Date(year, month, 1).getDay(); 
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let weeklyActuals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; 

            for(let i=0; i<firstDay; i++) {
                gridContainer.innerHTML += `<div class="calendar-cell bg-stone-50"></div>`;
            }

            for(let d=1; d<=daysInMonth; d++) {
                const isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
                let cellHTML = `
                    <div class="calendar-cell ${isToday ? 'cal-today border border-amber-300 bg-amber-50' : ''}">
                        <span class="cal-date-num">${d}</span>
                        <div class="cal-items-wrapper custom-scrollbar">
                `;

                const currentWeek = Math.min(5, Math.ceil((d + firstDay) / 7));

                const itemsToday = db.filter(item => {
                    let targetDate = null;
                    if (calendarMode === 'production' && item.makingAt) {
                        targetDate = new Date(item.makingAt.seconds * 1000);
                    } else if (calendarMode === 'arrival' && item.completedAt) {
                        targetDate = new Date(item.completedAt.seconds * 1000);
                    }

                    if (targetDate) {
                        return targetDate.getDate() === d && targetDate.getMonth() === month && targetDate.getFullYear() === year;
                    }
                    return false;
                });

                if (calendarMode === 'arrival') {
                     const quantity = itemsToday.reduce((sum, item) => sum + (parseInt(item.quantity)||1), 0);
                     weeklyActuals[currentWeek] = (weeklyActuals[currentWeek] || 0) + quantity;
                }

                itemsToday.forEach(item => {
                    let colorClass = getStatusColorClass(item.status);
                    const catName = getCleanCategory(item.category);
                    const qtyDisplay = item.quantity > 1 ? ` (${item.quantity})` : '';
                    
                    cellHTML += `<div class="cal-item ${colorClass} border border-black/5" onclick="window.openEditModal(${inlineString(item.id)})" title="${escapeHtml(item.itemName)}">${escapeHtml(catName)}${escapeHtml(qtyDisplay)}</div>`;
                });

                cellHTML += `</div></div>`;
                gridContainer.innerHTML += cellHTML;
            }
            
            if (calendarMode === 'arrival') {
                for (let w = 1; w <= 5; w++) {
                    const goalKey = `y${year}m${month}w${w}`;
                    const target = appSettings.weekly_goals[goalKey] || 0; 
                    const actual = weeklyActuals[w] || 0;

                    const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
                    let fillClass = 'fill-red';
                    if (actual >= target && target > 0) fillClass = 'fill-green';
                    else if (actual >= target * 0.7) fillClass = 'fill-yellow';
                    
                    weeklyGoalsList.innerHTML += `
                        <div class="goal-card cursor-pointer hover:shadow-md transition" onclick="window.setWeeklyGoal(${year}, ${month}, ${w})">
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] font-bold text-stone-500 uppercase">Week ${w}</span>
                                <span class="text-[10px] font-bold text-stone-700">${actual} / ${target}</span>
                            </div>
                            <div class="progress-track">
                                <div class="progress-fill ${fillClass}" style="width: ${pct}%"></div>
                            </div>
                        </div>
                    `;
                }
            }
        }

        function renderCategoryBadges(unsoldStats, unshippedStats) {
            const container = document.getElementById('category-stats-container');
            container.innerHTML = '';
            const sortedKeys = Object.keys(unsoldStats).sort((a,b) => unsoldStats[b] - unsoldStats[a]);

            sortedKeys.forEach(c => {
                if(unsoldStats[c] > 0 || unshippedStats[c] > 0) {
                    const unsold = unsoldStats[c] || 0;
                    const unshipped = unshippedStats[c] || 0;
                    container.innerHTML += `
                    <button onclick="window.openListModal('category', ${inlineString(c)})" class="bg-white px-3 py-2 rounded shadow-sm border border-stone-200 text-left hover:shadow-md transition-all flex flex-col min-w-[110px]">
                        <span class="font-bold text-stone-700 text-xs mb-1">${escapeHtml(c)}</span>
                        <div class="flex items-center justify-between w-full text-[10px]">
                            <span class="text-stone-500">未售出: <b class="text-stone-800">${unsold}</b></span>
                            <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">未出庫: <b>${unshipped}</b></span>
                        </div>
                    </button>`;
                }
            });
        }

        function renderLocationButtons(stats) {
            const container = document.getElementById('location-stats-container');
            container.innerHTML = '';
            
            let studiosHTML = '<div class="w-full flex gap-2 mb-3 items-center flex-wrap"><span class="text-xs font-bold text-stone-400 w-16 whitespace-nowrap"><i data-lucide="package" class="w-4 h-4 inline pb-0.5"></i> 待出貨:</span>';
            let stockistsHTML = '<div class="w-full flex gap-2 flex-wrap items-center"><span class="text-xs font-bold text-stone-400 w-16 whitespace-nowrap"><i data-lucide="truck" class="w-4 h-4 inline pb-0.5"></i> 已出貨:</span>';
            
            appSettings.locations.forEach(l => {
                if(stats[l] > 0) {
                    const isStudio = l.toUpperCase().includes('JB') || l.toUpperCase().includes('PNG');
                    const colors = window.getLocColorObj(l);
                    const btnStyle = `background-color: ${colors.bg}; color: ${colors.text}; border-color: rgba(0,0,0,0.1);`;
                    const btn = `<button onclick="window.openListModal('location', ${inlineString(l)})" class="px-3 py-1.5 rounded shadow-sm border text-xs transition-colors font-medium hover:opacity-80" style="${btnStyle}">${escapeHtml(l)}: <b class="font-bold">${stats[l]}</b></button>`;
                    
                    if (isStudio) studiosHTML += btn;
                    else stockistsHTML += btn;
                }
            });
            
            studiosHTML += '</div>';
            stockistsHTML += '</div>';
            
            container.innerHTML = studiosHTML + stockistsHTML;
            
            if(stats['Unallocated'] > 0) {
                container.innerHTML += `<div class="w-full flex gap-2 mt-3 pt-3 border-t border-stone-100"><button onclick="window.openListModal('location', 'Unallocated')" class="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded shadow-sm border border-gray-200 text-xs text-gray-600">無地點標記 (遺漏): <b>${stats['Unallocated']}</b></button></div>`;
            }
            lucide.createIcons();
        }

        function initCharts() {
            categoryChart = new Chart(document.getElementById('categoryChart'), {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                    plugins: { legend: { display: false } }
                }
            });
            allocChart = new Chart(document.getElementById('allocationChart'), {
                type: 'doughnut',
                data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
                options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: {size: 10} } } } }
            });

            const channelCanvas = document.getElementById('channelChart');
            if (channelCanvas) {
                channelChart = new Chart(channelCanvas, {
                    type: 'bar',
                    data: { labels: [], datasets: [] },
                    options: {
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, type: 'linear', display: true, position: 'left', title: { display: true, text: '總營業額 (RM)' } }
                        }
                    }
                });
            }
        }

        function updateCharts(locStats, catStats) {
            const labels = [...appSettings.locations, 'Unallocated', 'Sold'];
            const data = [...appSettings.locations.map(l => locStats[l]), locStats['Unallocated'], locStats['Sold']];
            
            const bgColors = [...appSettings.locations.map(l => window.getLocColorObj(l).bg), '#e5e7eb', '#ce3375'];
            
            allocChart.data.labels = labels;
            allocChart.data.datasets[0].data = data;
            allocChart.data.datasets[0].backgroundColor = bgColors;
            allocChart.update();

            const months = [...new Set(db.map(i => i.month))]; 
            const distinctCategories = Object.keys(catStats);
            
            const datasets = distinctCategories.map((cat, idx) => {
                return {
                    label: cat,
                    data: months.map(m => {
                        return db.filter(i => i.month === m && getCleanCategory(i.category) === cat)
                                     .reduce((sum, item) => sum + (item.photos && item.photos.length > 0 ? item.photos.length : parseInt(item.quantity)||1), 0);
                    }),
                    backgroundColor: catColors[idx % catColors.length]
                }
            });
            categoryChart.data.labels = months;
            categoryChart.data.datasets = datasets;
            categoryChart.update();
        }

        window.updateBusinessAnalytics = function() {
            if (!channelChart) return;
            const channelStats = {};

            db.forEach(item => {
                const photos = normalizePhotos(item);
                
                photos.forEach(p => {
                    if (p.status === 'Sold') {
                        if (getSoldCurrency(p) !== 'MYR') return;
                        const soldPrice = Number(p.soldPrice) || Number(item.price) || 0;
                        
                        let loc = p.locations.length > 0 ? p.locations[p.locations.length - 1] : 'Unknown';
                        if (p.locations.some(l => l.toUpperCase() === 'ONLINE')) loc = 'Online';

                        if (!channelStats[loc]) channelStats[loc] = { revenue: 0, qty: 0 };
                        channelStats[loc].revenue += soldPrice;
                        channelStats[loc].qty += 1;
                    }
                });
            });

            const channelNames = Object.keys(channelStats);
            const revenues = channelNames.map(c => channelStats[c].revenue);

            channelChart.data.labels = channelNames;
            channelChart.data.datasets = [
                {
                    label: '總營業額 (RM)',
                    data: revenues,
                    backgroundColor: '#34d399'
                }
            ];
            channelChart.update();
        };

        window.renderProductionList = function() {
            const tbody = document.getElementById('production-table-body');
            const makerFilter = document.getElementById('prod-filter-maker').value;
            const catFilter = document.getElementById('prod-filter-category').value;
            const styleSkuFilter = document.getElementById('prod-filter-style-sku').value;
            const statusFilter = document.getElementById('prod-filter-status').value;
            
            const fragment = document.createDocumentFragment();
            let data = db;
            const { resolveCategory } = getCatalogContext();
            
            if (makerFilter !== 'all') data = data.filter(i => i.maker === makerFilter);
            if (catFilter !== 'all') data = data.filter(i => resolveCategory(i) === catFilter);
            if (styleSkuFilter !== 'all') data = data.filter(i => normalizeStyleSku(i.styleSku) === normalizeStyleSku(styleSkuFilter));
            if (statusFilter !== 'all') data = data.filter(i => i.status === statusFilter);

            const page = paginate(data, productionPage, PAGE_SIZE);
            productionPage = page.currentPage;
            data = page.items;
            
            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-stone-50 transition-colors border-b border-stone-50';
                const photos = normalizePhotos(item);
                let reelHTML = `<div class="photo-reel">`;
                let renderedImages = 0;
                photos.forEach(p => {
                    const displayUrl = safeImageUrl(p.thumbnailUrl) || safeImageUrl(p.url);
                    const fullUrl = safeImageUrl(p.url);
                    if (!displayUrl) return;
                    renderedImages++;
                    reelHTML += `<img src="${escapeHtml(displayUrl)}" loading="lazy" decoding="async" fetchpriority="low" width="36" height="48" class="reel-img cursor-pointer hover:opacity-80 transition-opacity shadow-sm" onclick="window.openImageViewer(${inlineString(fullUrl || displayUrl)})">`;
                });
                if(renderedImages === 0) reelHTML += `<div class="w-8 h-10 bg-stone-100 flex items-center justify-center text-[10px] text-stone-300 rounded border">No Img</div>`;
                reelHTML += `</div>`;
                let statusColor = 'bg-gray-100 text-gray-600';
                if(item.status === 'Making') statusColor = 'bg-amber-100 text-amber-700';
                if(item.status === 'QC') statusColor = 'bg-purple-100 text-purple-700';
                if(item.status === 'Ready') statusColor = 'bg-emerald-100 text-emerald-700';
                tr.innerHTML = `<td class="px-6 py-4 font-mono text-xs text-stone-500">${escapeHtml(item.month)}</td><td class="px-6 py-4">${reelHTML}</td><td class="px-6 py-4"><div class="font-medium text-stone-800">${escapeHtml(item.itemName)}</div><div class="font-mono text-[10px] text-stone-500">${escapeHtml(item.styleSku || '尚未編號')}</div><div class="text-xs text-stone-400">${escapeHtml(item.color||'-')} ${escapeHtml(item.size||'-')}</div></td><td class="px-6 py-4">${escapeHtml(item.quantity)}</td><td class="px-6 py-4 text-xs">${escapeHtml(item.maker)}</td><td class="px-6 py-4"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusColor}">${escapeHtml(item.status)}</span></td><td class="px-6 py-4 text-xs text-stone-600 font-bold">${item.price ? 'RM'+escapeHtml(item.price) : '-'}</td><td class="px-6 py-4"><button onclick="window.openEditModal(${inlineString(item.id)})" class="text-stone-400 hover:text-stone-800 border p-1 rounded shadow-sm"><i data-lucide="settings-2" class="w-4 h-4"></i></button></td>`;
                fragment.appendChild(tr);
            });
            tbody.replaceChildren(fragment);
            updatePaginationControls('production', productionPage, page.totalPages, page.totalItems);
            lucide.createIcons();
        };

        window.resetProductionPage = function() {
            productionPage = 1;
            window.renderProductionList();
        };

        window.changeProductionPage = function(delta) {
            productionPage += delta;
            window.renderProductionList();
            document.getElementById('view-production').scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        window.renderAllocationList = function() {
            const tbody = document.getElementById('allocation-table-body');
            const locFilter = document.getElementById('alloc-filter-location').value;
            const catFilter = document.getElementById('alloc-filter-category').value;
            const styleSkuFilter = document.getElementById('alloc-filter-style-sku').value;
            const garmentIdSearch = normalizeGarmentIdSearch(document.getElementById('allocation-garment-search').value);
            const fragment = document.createDocumentFragment();
            const { resolveCategory } = getCatalogContext();

            const page = prepareAllocationPage({
                items: db,
                categoryFilter: catFilter,
                styleSkuFilter,
                garmentIdSearch,
                locationFilter: locFilter,
                requestedPage: allocationPage,
                normalizePhotos,
                resolveCategory,
                normalizeSku: normalizeStyleSku,
                pageSize: PAGE_SIZE
            });
            allocationPage = page.currentPage;
            const pageItems = page.items;
            const totalMatchingPieces = page.totalMatchingPieces;
            document.getElementById('allocation-search-status').textContent = garmentIdSearch
                ? `找到 ${totalMatchingPieces} 件符合「${garmentIdSearch}」的商品；编号搜索会暂时忽略其他筛选。`
                : '';

            pageItems.forEach(item => {
                const photos = normalizePhotos(item);

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-stone-50 transition-colors border-b border-stone-50';
                let gridHTML = `<div class="photo-grid">`;
                
                let hasRenderedAnyPhoto = false;

                if(photos.length === 0) {
                    gridHTML = `<span class="text-xs text-stone-400">無照片資料</span>`;
                } else {
                    let mappedPhotos = photos.map((p, idx) => ({ p, idx }));
                    mappedPhotos.sort((a, b) => window.getPhotoRank(a.p) - window.getPhotoRank(b.p));

                    mappedPhotos.forEach(({p, idx}) => {
                        if (garmentIdSearch && !photoMatchesGarmentSearch(p, garmentIdSearch)) return;
                        const isOnline = p.locations.some(l => l.toUpperCase() === 'ONLINE');
                        
                        if (!garmentIdSearch && locFilter !== 'all' && locFilter !== 'Sold' && locFilter !== 'Unallocated') {
                            if (!p.locations.includes(locFilter)) return; 
                        }
                        
                        if (!garmentIdSearch && locFilter === 'Sold' && p.status !== 'Sold') return;
                        if (!garmentIdSearch && locFilter === 'Unallocated' && (p.status === 'Sold' || p.locations.length > 0)) return;

                        hasRenderedAnyPhoto = true;

                        const isSold = p.status === 'Sold';
                        const hasNote = p.notes && p.notes.length > 0;
                        const displayImageUrl = safeImageUrl(p.thumbnailUrl) || safeImageUrl(p.url);
                        const hasImg = Boolean(displayImageUrl);
                        let badgeText = '', badgeClass = '', badgeStyle = '';
                        
                        const physicalLocs = p.locations.filter(l => l.toUpperCase() !== 'ONLINE');
                        const locationText = isSold
                            ? `Sold${p.locations.length ? ` · ${p.locations.join(' + ')}` : ''}`
                            : (p.locations.length ? p.locations.join(' + ') : '无地点');

                        if (isSold) { 
                            badgeText = p.soldPrice ? `SOLD` : 'SOLD'; 
                            badgeClass = 'badge-sold'; 
                        } 
                        else {
                            if (physicalLocs.length > 1) { 
                                badgeText = 'MULTI'; 
                                badgeClass = 'badge-multi'; 
                            } 
                            else if (physicalLocs.length === 1) { 
                                const loc0 = physicalLocs[0];
                                badgeText = loc0.substring(0,12).toUpperCase(); 
                                if (isOnline) {
                                    badgeText = '🌐 ' + badgeText; 
                                }
                                const colors = window.getLocColorObj(loc0);
                                badgeClass = ''; 
                                badgeStyle = `background-color: ${colors.bg}; color: ${colors.text};`; 
                            } 
                            else if (isOnline) {
                                badgeText = 'ONLINE'; 
                                const colors = window.getLocColorObj('Online');
                                badgeClass = ''; 
                                badgeStyle = `background-color: ${colors.bg}; color: ${colors.text};`; 
                            }
                            else { 
                                badgeText = '無地點'; 
                                badgeClass = 'badge-none'; 
                            }
                        }
                        
                        let quickDispatchHTML = '';
                        
                        if (!isSold) {
                            let labelText = isOnline ? '🌐 已上線, 調貨至...' : '📦 安排出貨/調貨...';
                            let bgClass = isOnline ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100';
                            
                            let optionsHTML = '';
                            
                            if (!isOnline) {
                                optionsHTML += `<option value="Online">🌐 上架至 Online</option>`;
                            }
                            
                            const physicalOptions = appSettings.locations.filter(s => !p.locations.includes(s) && s.toUpperCase() !== 'ONLINE');
                            if (physicalOptions.length > 0) {
                                optionsHTML += `<optgroup label="實體地點轉移">`;
                                physicalOptions.forEach(s => {
                                    optionsHTML += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
                                });
                                optionsHTML += `</optgroup>`;
                            }

                            if (optionsHTML) {
                                quickDispatchHTML = `
                                    <div class="mt-2 border-t border-stone-100 pt-2 dispatch-wrapper">
                                        <select onchange="window.quickDispatch(event, ${inlineString(item.id)}, ${idx}, this.value)" class="w-full text-[10px] p-1.5 border rounded font-bold cursor-pointer outline-none transition shadow-sm ${bgClass}" onclick="event.stopPropagation()">
                                            <option value="" disabled selected>${labelText}</option>
                                            ${optionsHTML}
                                        </select>
                                    </div>
                                `;
                            } else if (isOnline) {
                                quickDispatchHTML = `<div class="mt-2 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1.5 text-center w-full shadow-sm">🌐 已上線</div>`;
                            }
                        }

                        gridHTML += `
                        <div class="flex flex-col items-center w-[64px] flex-shrink-0 dispatch-card">
                            <div class="relative w-full h-[84px] cursor-pointer transition-transform hover:scale-105 bg-white rounded shadow-sm border border-stone-200 group" onclick="window.openDetailModal(${inlineString(item.id)}, ${idx})">
                                ${hasImg ? `<img src="${escapeHtml(displayImageUrl)}" loading="lazy" decoding="async" fetchpriority="low" width="64" height="84" class="w-full h-full object-cover rounded ${isSold ? 'opacity-50 grayscale' : ''}">` : `<div class="w-full h-full bg-stone-50 flex items-center justify-center text-[8px] text-stone-400 rounded">No Img</div>`}
                                <div class="status-badge ${badgeClass}" style="${badgeStyle}">${escapeHtml(badgeText)}</div>
                                ${isSold ? `<div class="sold-overlay"><i data-lucide="check" class="text-white w-4 h-4"></i></div>` : ''}
                                ${hasNote ? `<div class="has-note-dot"></div>` : ''}
                                <div class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center pointer-events-none"><i data-lucide="settings" class="text-white w-5 h-5 drop-shadow-md"></i></div>
                            </div>
                            <div class="mt-1 w-full truncate text-center font-mono text-[9px] font-bold text-stone-600">${escapeHtml(p.garmentId || item.styleSku || '尚未编号')}</div>
                            <div class="w-full truncate text-center text-[8px] text-stone-400">${escapeHtml(locationText)}</div>
                            <div class="w-full dispatch-wrapper">
                                ${quickDispatchHTML}
                            </div>
                        </div>`;
                    });
                }
                gridHTML += `</div>`;
                
                if(hasRenderedAnyPhoto || photos.length === 0) {
                    tr.innerHTML = `
                        <td class="px-6 py-4">${gridHTML}</td>
                        <td class="px-6 py-4">
                            <div class="font-bold text-stone-800 text-sm">${escapeHtml(item.itemName)}</div>
                            <div class="text-xs text-stone-500">${escapeHtml(item.color||'')} ${escapeHtml(item.size||'')}</div>
                            <div class="text-[10px] text-stone-400 mt-1">主定價: ${item.price ? 'RM'+escapeHtml(item.price) : '-'}</div>
                        </td>
                        <td class="px-6 py-4 text-xs font-medium text-stone-500">${escapeHtml(getCleanCategory(item.category))}</td>`;
                    fragment.appendChild(tr);
                }
            });
            tbody.replaceChildren(fragment);

            const summaryText = document.getElementById('alloc-summary-text');
            const locSelectEl = document.getElementById('alloc-filter-location');
            const displayLocRaw = locSelectEl.options[locSelectEl.selectedIndex]?.text || locFilter;
            const displayLoc = locFilter === 'all' ? '全部地點' : displayLocRaw.replace(/[\(🌐🚚🏠\)]/g, '').trim();
            const displayCat = catFilter === 'all' ? '全部類別' : (catFilter === 'legacy' ? '未配對舊資料' : categoryLabel(catFilter));
            const selectedStyleSku = normalizeStyleSku(styleSkuFilter);
            const selectedStyleEntry = normalizeStyleSkuCatalog(appSettings.styleSkus).find(entry => entry.sku === selectedStyleSku);
            const displayStyle = styleSkuFilter === 'all' ? '全部商品' : `${selectedStyleSku}${selectedStyleEntry?.name ? ` · ${selectedStyleEntry.name}` : ''}`;
            const summaryLabel = garmentIdSearch ? '编号搜索结果' : (locFilter === 'Sold' ? '已售出總計' : '未售出庫存');

            summaryText.innerHTML = garmentIdSearch ? `
                <span class="text-stone-500 font-bold text-xs mr-2"><i data-lucide="search" class="w-4 h-4 inline pb-0.5"></i> ${summaryLabel}:</span>
                <span class="bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100 font-mono text-xs font-bold text-stone-700">${escapeHtml(garmentIdSearch)}</span>
                <span class="text-blue-300 mx-1 font-bold">=</span>
                <span class="text-xl font-black text-blue-700 ml-1 drop-shadow-sm">${totalMatchingPieces}</span>
                <span class="text-blue-500 font-bold text-xs ml-1">件</span>
            ` : `
                <span class="text-stone-500 font-bold text-xs mr-2"><i data-lucide="package-check" class="w-4 h-4 inline pb-0.5"></i> ${summaryLabel}:</span> 
                <span class="bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100 text-stone-700 text-xs font-bold">${escapeHtml(displayCat)}</span>
                <span class="text-blue-300 mx-1 font-bold">+</span>
                <span class="bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100 text-stone-700 text-xs font-bold">${escapeHtml(displayStyle)}</span>
                <span class="text-blue-300 mx-1 font-bold">+</span> 
                <span class="bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100 text-stone-700 text-xs font-bold">${escapeHtml(displayLoc)}</span>
                <span class="text-blue-300 mx-1 font-bold">=</span> 
                <span class="text-xl font-black text-blue-700 ml-1 drop-shadow-sm">${totalMatchingPieces}</span> 
                <span class="text-blue-500 font-bold text-xs ml-1">件</span>
            `;

            updatePaginationControls('allocation', allocationPage, page.totalPages, page.totalItems);
            lucide.createIcons();
        };

        window.resetAllocationPage = function() {
            allocationPage = 1;
            window.renderAllocationList();
        };

        window.handleGarmentSearchInput = function() {
            if (garmentSearchTimer) clearTimeout(garmentSearchTimer);
            garmentSearchTimer = setTimeout(() => {
                allocationPage = 1;
                window.renderAllocationList();
            }, 200);
        };

        window.clearGarmentSearch = function() {
            if (garmentSearchTimer) clearTimeout(garmentSearchTimer);
            document.getElementById('allocation-garment-search').value = '';
            allocationPage = 1;
            window.renderAllocationList();
            document.getElementById('allocation-garment-search').focus();
        };

        window.changeAllocationPage = function(delta) {
            allocationPage += delta;
            window.renderAllocationList();
            document.getElementById('view-allocation').scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        window.goToPage = function(prefix, pageNumber) {
            const target = Math.max(1, Number.parseInt(pageNumber, 10) || 1);
            if (prefix === 'production') {
                productionPage = target;
                window.renderProductionList();
                document.getElementById('view-production').scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (prefix === 'allocation') {
                allocationPage = target;
                window.renderAllocationList();
                document.getElementById('view-allocation').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };

        function updatePaginationControls(prefix, currentPage, totalPages, totalItems) {
            const prev = document.getElementById(`${prefix}-prev-page`);
            const next = document.getElementById(`${prefix}-next-page`);
            const info = document.getElementById(`${prefix}-page-info`);
            if (!prev || !next || !info) return;

            prev.disabled = currentPage <= 1;
            next.disabled = currentPage >= totalPages;
            info.innerText = totalItems === 0
                ? '0 筆'
                : `第 ${currentPage} / ${totalPages} 頁 · 共 ${totalItems} 筆`;

            const renderNumbers = (container, maxItems) => {
                if (!container) return;
                if (totalItems === 0) {
                    container.innerHTML = '';
                    return;
                }
                container.innerHTML = buildPaginationItems(currentPage, totalPages, maxItems).map(item => {
                    if (item === 'ellipsis') return '<span class="flex min-h-[44px] min-w-[20px] items-center justify-center text-xs text-stone-400">…</span>';
                    const active = item === currentPage;
                    return `<button type="button" onclick="window.goToPage(${inlineString(prefix)}, ${item})" ${active ? 'aria-current="page"' : ''} class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border text-xs font-bold ${active ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}">${item}</button>`;
                }).join('');
            };
            renderNumbers(document.getElementById(`${prefix}-page-numbers-mobile`), 5);
            renderNumbers(document.getElementById(`${prefix}-page-numbers-desktop`), 7);
        }

        window.quickDispatch = async function(e, itemId, photoIdx, toLocation) {
            e.stopPropagation();
            if(!confirm(`確認將此商品轉移/上架至 ${toLocation}？`)) {
                e.target.value = ""; 
                return;
            }
            const selectEl = e.target;
            selectEl.disabled = true;
            selectEl.options[selectEl.selectedIndex].text = '處理中...';
            try {
                await updatePhotoAtomic(itemId, photoIdx, photo => {
                    const isTargetOnline = toLocation.toUpperCase() === 'ONLINE';
                    const locations = [...photo.locations];
                    if (isTargetOnline) {
                        if (!locations.some(location => location.toUpperCase() === 'ONLINE')) locations.push('Online');
                        return { locations };
                    }
                    const onlineName = locations.find(location => location.toUpperCase() === 'ONLINE');
                    return { locations: onlineName ? [onlineName, toLocation] : [toLocation] };
                });
            } catch (err) {
                alert("轉移失敗：" + err.message);
                selectEl.disabled = false;
                selectEl.value = "";
            }
        };

        window.openListModal = function(type, value) {
            const titleMap = {
                'Total': '總生產件數 (Total)', 'Making': '製作中', 'Studio': '待出貨 (Studio在庫)', 'Unallocated': '無地點標記', 'Sold': '已售出'
            };
            const titleEl = document.getElementById('list-modal-title');
            if (type === 'kpi') titleEl.innerText = titleMap[value] || value;
            else if (type === 'category') titleEl.innerText = `類別: ${value}`;
            else if (type === 'location') titleEl.innerText = `地點: ${value}`;
            else if (type === 'cat_loc') {
                const parts = value.split('|');
                const catLabel = parts[0] === 'all' ? '全部類別' : parts[0];
                titleEl.innerText = `${catLabel} @ ${parts[1]}`;
            }
            
            const gridContainer = document.getElementById('list-modal-grid');
            gridContainer.innerHTML = '';
            
            let allMatchedPhotos = [];

            db.forEach(item => {
                const photos = normalizePhotos(item);
                const cleanCat = getCleanCategory(item.category);
                
                photos.forEach((p, idx) => {
                    let match = false;
                    const isOnline = p.locations.some(l => l.toUpperCase() === 'ONLINE');
                    
                    if (type === 'kpi') {
                        if (value === 'Total') match = true;
                        if (value === 'Making' && item.status === 'Making') match = true;
                        if (value === 'Studio' && p.locations.some(loc => loc.toUpperCase().includes('JB') || loc.toUpperCase().includes('PNG')) && p.status !== 'Sold' && !isOnline) match = true;
                        if (value === 'Unallocated' && p.locations.length === 0 && p.status !== 'Sold') match = true;
                        if (value === 'Sold' && p.status === 'Sold') match = true;
                    } else if (type === 'category') {
                        if (cleanCat === value) match = true;
                    } else if (type === 'location') {
                        if (value === 'Unallocated' && p.locations.length === 0 && p.status !== 'Sold') match = true;
                        else if (p.locations.includes(value)) {
                            match = true; 
                        }
                    } 
                    else if (type === 'cat_loc') {
                        const parts = value.split('|');
                        const targetCat = parts[0];
                        const targetLoc = parts[1];
                        
                        const catMatches = (targetCat === 'all' || cleanCat === targetCat);
                        const locMatches = (targetLoc === 'Unallocated' ? (p.locations.length === 0 && p.status !== 'Sold') : p.locations.includes(targetLoc));
                        
                        if (catMatches && locMatches) {
                            match = true;
                        }
                    }

                    if (match) {
                        allMatchedPhotos.push({ item, p, idx, cleanCat });
                    }
                });
            });

            allMatchedPhotos.sort((a, b) => window.getPhotoRank(a.p) - window.getPhotoRank(b.p));
            let cardsHTML = '';

            allMatchedPhotos.forEach(({ item, p, idx, cleanCat }) => {
                let imgSrc = safeImageUrl(p.thumbnailUrl) || safeImageUrl(p.url);
                let imgHTML = imgSrc ? `<img src="${escapeHtml(imgSrc)}" loading="lazy" decoding="async" fetchpriority="low" height="128" class="w-full h-32 object-cover rounded-t-md">` : `<div class="w-full h-32 bg-stone-200 flex items-center justify-center text-xs text-stone-400 rounded-t-md">無照片</div>`;
                
                let cardColorClass = getStatusColorClass(p.status === 'Sold' ? 'Sold' : item.status);
                let cardBadgeHTML = '';
                
                const physicalLocs = p.locations.filter(l => l.toUpperCase() !== 'ONLINE');
                const isOnline = p.locations.some(l => l.toUpperCase() === 'ONLINE');

                if (p.status === 'Sold') {
                    cardBadgeHTML = `<div class="mt-2 text-[10px] font-bold px-1.5 py-0.5 rounded w-fit text-white shadow-sm border" style="background-color: #ce3375; border-color: #a31f5b;">SOLD</div>`;
                } else if (physicalLocs.length > 1) {
                    cardBadgeHTML = `<div class="mt-2 text-[10px] font-bold px-1.5 py-0.5 rounded w-fit bg-blue-500 text-white shadow-sm border border-blue-600">MULTI</div>`;
                } else if (physicalLocs.length === 1) {
                    let loc0 = physicalLocs[0];
                    const colors = window.getLocColorObj(loc0);
                    let displayLoc = isOnline ? '🌐 ' + loc0 : loc0;
                    cardBadgeHTML = `<div class="mt-2 text-[10px] font-bold px-1.5 py-0.5 rounded w-fit border border-black/10" style="background-color: ${colors.bg}; color: ${colors.text};">${escapeHtml(displayLoc)}</div>`;
                } else if (isOnline) {
                    let loc0 = 'Online';
                    const colors = window.getLocColorObj(loc0);
                    cardBadgeHTML = `<div class="mt-2 text-[10px] font-bold px-1.5 py-0.5 rounded w-fit border border-black/10" style="background-color: ${colors.bg}; color: ${colors.text};">${loc0}</div>`;
                } else {
                    cardBadgeHTML = `<div class="mt-2 text-[10px] font-bold px-1.5 py-0.5 rounded w-fit border border-black/5 ${cardColorClass}">${escapeHtml(item.status)}</div>`;
                }
                
                let quickDispatchHTML = '';
                
                if (p.status !== 'Sold') {
                    let labelText = isOnline ? '🌐 已上線, 調貨至...' : '📦 安排出貨/調貨...';
                    let bgClass = isOnline ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100';
                    
                    let optionsHTML = '';
                    if (!isOnline) {
                        optionsHTML += `<option value="Online">🌐 上架至 Online</option>`;
                    }
                    const physicalOptions = appSettings.locations.filter(s => !p.locations.includes(s) && s.toUpperCase() !== 'ONLINE');
                    if (physicalOptions.length > 0) {
                        optionsHTML += `<optgroup label="實體地點轉移">`;
                        physicalOptions.forEach(s => { optionsHTML += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`; });
                        optionsHTML += `</optgroup>`;
                    }

                    if (optionsHTML) {
                        quickDispatchHTML = `
                            <div class="mt-2 border-t border-stone-100 pt-2 dispatch-wrapper">
                                <select onchange="window.quickDispatch(event, ${inlineString(item.id)}, ${idx}, this.value)" class="w-full text-[10px] p-1.5 border rounded font-bold cursor-pointer outline-none transition shadow-sm ${bgClass}" onclick="event.stopPropagation()">
                                    <option value="" disabled selected>${labelText}</option>
                                    ${optionsHTML}
                                </select>
                            </div>
                        `;
                    }
                }

                cardsHTML += `
                    <div class="bg-white rounded-md shadow-sm border border-stone-200 hover:shadow-md transition flex flex-col overflow-hidden relative group cursor-pointer dispatch-card" onclick="window.openDetailModal(${inlineString(item.id)}, ${idx})">
                        ${imgHTML}
                        <div class="p-2 flex flex-col flex-grow">
                            <div class="font-bold text-stone-800 text-xs truncate" title="${escapeHtml(item.itemName)}">${escapeHtml(item.itemName)}</div>
                            <div class="font-mono text-[9px] font-bold text-stone-600 truncate">${escapeHtml(p.garmentId || item.styleSku || '尚未編號')}</div>
                            <div class="text-[10px] text-stone-500">${escapeHtml(cleanCat)} | ${escapeHtml(item.color || '-')}</div>
                            <div class="flex-grow">
                                ${cardBadgeHTML}
                            </div>
                            ${quickDispatchHTML}
                        </div>
                        <div class="absolute top-1 right-1 bg-white/90 text-stone-600 p-1.5 rounded shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><i data-lucide="settings" class="w-3 h-3"></i></div>
                    </div>
                `;
            });
            gridContainer.innerHTML = cardsHTML;
            
            const count = allMatchedPhotos.length;
            titleEl.innerText += ` (${count}件)`;
            if(count === 0) {
                gridContainer.innerHTML = `<div class="col-span-full py-8 text-center text-stone-400 text-sm">目前沒有相關商品</div>`;
            }

            document.getElementById('list-modal').classList.remove('hidden');
            lucide.createIcons();
        };

        window.openDetailModal = function(id, idx) {
            currentDetailItem = db.find(i => i.id === id); currentDetailPhotoIdx = idx;
            const p = normalizePhotos(currentDetailItem)[idx];
            const imgEl = document.getElementById('detail-img');
            const detailImageUrl = safeImageUrl(p.url);
            if(detailImageUrl) { imgEl.src = detailImageUrl; imgEl.classList.remove('hidden'); } else { imgEl.classList.add('hidden'); }
            
            document.getElementById('detail-title').innerText = currentDetailItem.itemName;
            document.getElementById('detail-sku').innerText = p.garmentId
                ? `${p.garmentId} · ${getCleanCategory(currentDetailItem.category)} / ${currentDetailItem.color || '-'}`
                : `${currentDetailItem.styleSku || '尚未編號'} · ${getCleanCategory(currentDetailItem.category)} / ${currentDetailItem.color || '-'}`;
            
            let basePrice = currentDetailItem.price || '';
            let displaySpecPrice = p.specificPrice !== undefined && p.specificPrice !== null ? p.specificPrice : basePrice;
            document.getElementById('detail-specific-price').value = p.specificPrice !== undefined && p.specificPrice !== null ? p.specificPrice : '';
            
            let priceText = displaySpecPrice ? `RM${displaySpecPrice}` : '未定價';
            if(p.status === 'Sold') {
                const soldPrice = formatSoldMoney(p.soldPrice, getSoldCurrency(p));
                let dateStr = '';
                if(p.soldAt) { const dateObj = p.soldAt.seconds ? new Date(p.soldAt.seconds * 1000) : new Date(p.soldAt); dateStr = ` @ ${dateObj.toLocaleDateString()}`; }
                priceText += ` (Sold: ${soldPrice}${dateStr})`;
            }
            document.getElementById('detail-price-display').innerText = `Price: ${priceText}`;
            const saleMeta = document.getElementById('detail-sale-meta');
            if (p.status === 'Sold' && (p.paymentMethod || p.salesNote || p.saleEvent || p.soldLocation)) {
                saleMeta.textContent = [p.paymentMethod, p.soldLocation, p.saleEvent, p.salesNote].filter(Boolean).join(' · ');
                saleMeta.classList.remove('hidden');
            } else {
                saleMeta.textContent = '';
                saleMeta.classList.add('hidden');
            }
            
            document.getElementById('detail-notes').value = p.notes;
            document.getElementById('detail-photo-upload').value = ''; 
            
            tempLocations = [...p.locations]; 
            const btnSold = document.getElementById('btn-toggle-sold');
            const badgeSold = document.getElementById('detail-sold-badge');
            if(p.status === 'Sold') { btnSold.innerText = "取消售出 (Return to Stock)"; btnSold.className = "bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded text-sm w-full font-bold border border-red-200 transition-colors"; badgeSold.classList.remove('hidden'); } 
            else { btnSold.innerText = "標記為已售出 (SOLD)"; btnSold.className = "bg-stone-800 text-white hover:bg-stone-900 px-4 py-2 rounded text-sm w-full font-bold transition-colors"; badgeSold.classList.add('hidden'); }
            
            renderDetailLocationButtons();
            document.getElementById('detail-modal').classList.remove('hidden');
        };
        
        window.renderDetailLocationButtons = function() {
            const container = document.getElementById('detail-location-options'); container.innerHTML = '';
            const onlineContainer = document.getElementById('detail-online-container');
            const p = normalizePhotos(currentDetailItem)[currentDetailPhotoIdx];
            
            if(p.status === 'Sold') { 
                container.innerHTML = `<div class="col-span-2 text-center text-stone-400 text-xs py-2 bg-stone-50 rounded">已售出商品無法編輯地點</div>`; 
                onlineContainer.innerHTML = ''; 
                return; 
            }
            
            const physicalLocs = appSettings.locations.filter(l => l.toUpperCase() !== 'ONLINE');
            physicalLocs.forEach(loc => {
                const isSelected = tempLocations.includes(loc);
                const btnClass = isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-stone-500 border-stone-200 hover:border-blue-300';
                container.innerHTML += `<button onclick="window.toggleDetailLocation(${inlineString(loc)})" class="border rounded py-2 text-xs font-bold transition-colors ${btnClass}">${escapeHtml(loc)} ${isSelected ? '✓' : ''}</button>`;
            });

            const isOnlineSelected = tempLocations.some(l => l.toUpperCase() === 'ONLINE');
            const onlineBtnClass = isOnlineSelected ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-300';
            onlineContainer.innerHTML = `
                <label class="text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2 block">2. 線上商店狀態</label>
                <button onclick="window.toggleDetailLocation('Online')" class="w-full border rounded py-2 text-xs font-bold transition-colors ${onlineBtnClass}">🌐 上架至 Online (網店營運中) ${isOnlineSelected ? '✓' : ''}</button>
            `;
        };
        
        window.toggleDetailLocation = function(loc) { 
            const isTargetOnline = loc.toUpperCase() === 'ONLINE';
            
            if (isTargetOnline) {
                if (tempLocations.some(l => l.toUpperCase() === 'ONLINE')) {
                    tempLocations = tempLocations.filter(l => l.toUpperCase() !== 'ONLINE');
                } else {
                    tempLocations.push(loc);
                }
            } else {
                const onlineLoc = tempLocations.find(l => l.toUpperCase() === 'ONLINE');
                
                if (tempLocations.includes(loc)) {
                    tempLocations = tempLocations.filter(l => l !== loc);
                } else {
                    tempLocations = onlineLoc ? [onlineLoc, loc] : [loc];
                }
            }
            renderDetailLocationButtons(); 
        };
        
        window.saveItemDetails = async function() { 
            if(!currentDetailItem) return; 
            const btn = document.getElementById('btn-save-detail');
            btn.innerText = '儲存中...'; btn.disabled = true;
            try {
                const specPrice = document.getElementById('detail-specific-price').value;
                const patch = {
                    notes: document.getElementById('detail-notes').value,
                    locations: [...tempLocations],
                    specificPrice: specPrice !== '' ? Number(specPrice) : null
                };
                const fileInput = document.getElementById('detail-photo-upload');
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    btn.innerText = '優化照片中...';
                    const uploaded = await uploadOptimizedPhoto(file, 'detail');
                    patch.url = uploaded.url;
                    patch.thumbnailUrl = uploaded.thumbnailUrl;
                }

                await updatePhotoAtomic(currentDetailItem.id, currentDetailPhotoIdx, () => patch);
                window.closeDetailModal(); 
            } catch(e) { 
                alert("儲存失敗: " + e.message); 
            } finally {
                btn.innerText = '儲存'; btn.disabled = false;
            } 
        };
        
        window.triggerSoldFlow = function() {
            let photos = normalizePhotos(currentDetailItem); const currentStatus = photos[currentDetailPhotoIdx].status;
            if (currentStatus === 'Sold') { if(confirm("確認取消售出？物品將回到庫存中。")) updateItemStatus({ status: 'Available', soldPrice: null, soldAt: null, soldCurrency: null, paymentMethod: null, salesChannel: null, saleEvent: null, soldLocation: null, salesNote: '' }); }
            else { 
                document.getElementById('popup-sale-mode').checked = hasSingaporePopupLocation(tempLocations);
                document.getElementById('sold-payment-method').value = '';
                document.getElementById('sold-note-input').value = ''; 
                document.getElementById('sold-date-input').valueAsDate = new Date(); 
                window.updateSaleModeUI(true);
                document.getElementById('sold-modal').classList.remove('hidden'); 
            }
        };
        window.updateSaleModeUI = function(resetPrice = false) {
            const isPopupSale = document.getElementById('popup-sale-mode').checked;
            const priceInput = document.getElementById('sold-price-input');
            const paymentContainer = document.getElementById('sold-payment-container');
            const paymentInput = document.getElementById('sold-payment-method');
            document.getElementById('sold-modal-title').textContent = isPopupSale ? 'Singapore Popup 售出' : '确认售出价格';
            document.getElementById('sold-modal-subtitle').textContent = isPopupSale ? '记录 SGD 成交价、付款方式与售出日期' : '记录 MYR 成交价与售出日期';
            document.getElementById('sold-price-label').textContent = `成交价 (${isPopupSale ? 'SGD' : 'MYR'})`;
            document.getElementById('sold-currency-prefix').textContent = isPopupSale ? 'SGD' : 'RM';
            paymentContainer.classList.toggle('hidden', !isPopupSale);
            paymentInput.required = isPopupSale;
            if (resetPrice) {
                const photo = normalizePhotos(currentDetailItem)[currentDetailPhotoIdx];
                const myrPrice = photo?.specificPrice !== undefined && photo?.specificPrice !== null
                    ? photo.specificPrice
                    : currentDetailItem?.price || '';
                priceInput.value = isPopupSale ? '' : myrPrice;
            }
        };
        window.confirmSoldAction = async function() {
            const soldPriceInput = document.getElementById('sold-price-input');
            const paymentInput = document.getElementById('sold-payment-method');
            const dateInput = document.getElementById('sold-date-input');
            const noteInput = document.getElementById('sold-note-input');
            const button = document.getElementById('btn-confirm-sold');
            const isPopupSale = document.getElementById('popup-sale-mode').checked;
            const soldPrice = Number(soldPriceInput.value);
            const paymentMethod = paymentInput.value;
            const dateVal = dateInput.value;
            if (soldPriceInput.value === '' || !Number.isFinite(soldPrice) || soldPrice < 0) {
                alert(`请输入正确的 ${isPopupSale ? 'SGD' : 'MYR'} 售出价格。`);
                soldPriceInput.focus();
                return;
            }
            if (isPopupSale && !paymentMethod) {
                alert('请选择付款方式。');
                paymentInput.focus();
                return;
            }
            if (!dateVal) {
                alert('请选择售出日期。');
                dateInput.focus();
                return;
            }
            const patch = {
                status: 'Sold',
                soldPrice,
                soldCurrency: isPopupSale ? 'SGD' : 'MYR',
                paymentMethod: isPopupSale ? paymentMethod : null,
                soldAt: new Date(dateVal.replace(/-/g, '/')),
                salesChannel: isPopupSale ? POPUP_SALES_CHANNEL : null,
                saleEvent: isPopupSale ? POPUP_SALES_EVENT : null,
                soldLocation: isPopupSale ? getPopupSoldLocation(tempLocations) : null,
                salesNote: isPopupSale ? noteInput.value.trim() : '',
                locations: [...tempLocations]
            };
            button.disabled = true;
            button.textContent = '记录中...';
            const succeeded = await updateItemStatus(patch, isPopupSale ? '' : noteInput.value.trim(), true);
            if (succeeded) document.getElementById('sold-modal').classList.add('hidden');
            button.disabled = false;
            button.textContent = '确认售出';
        };
        async function updateItemStatus(patch, noteToAppend = '', preventDuplicateSale = false) {
            try {
                await updatePhotoAtomic(currentDetailItem.id, currentDetailPhotoIdx, latestPhoto => {
                    if (preventDuplicateSale && latestPhoto.status === 'Sold') {
                        throw new Error('此商品已经被标记为售出，请重新整理确认。');
                    }
                    if (!noteToAppend) return patch;
                    return {
                        ...patch,
                        notes: (latestPhoto.notes ? latestPhoto.notes + ' | ' : '') + noteToAppend
                    };
                }, true);
                window.closeDetailModal();
                return true;
            } catch (error) {
                alert('更新售出狀態失敗：' + error.message);
                return false;
            }
        }
        window.closeDetailModal = () => document.getElementById('detail-modal').classList.add('hidden');

        function allocateGarmentIdsFromCounter(counterData, photos, styleSku) {
            const sku = normalizeStyleSku(styleSku);
            const counters = { ...(counterData?.counters || {}) };
            const allocation = assignMissingGarmentIds(photos, sku, Number(counters[sku]) || 0);
            counters[sku] = allocation.nextCounter;
            return { ...allocation, counters, styleSku: sku };
        }
        
        window.handleAddItem = async function(e) { 
            e.preventDefault(); 
            const btn = document.getElementById('btn-submit'); 
            btn.innerText = '處理中...'; 
            btn.disabled = true; 
            try { 
                const form = new FormData(e.target); 
                const originStudio = form.get('originStudio');
                const fileInput = document.querySelector('input[name="initialPhotos"]'); 
                let photoObjs = []; 
                if(fileInput.files.length > 0) { 
                    for(let i=0; i<fileInput.files.length; i++) { 
                        const file = fileInput.files[i]; 
                        btn.innerText = `優化照片 ${i + 1}/${fileInput.files.length}...`;
                        const uploaded = await uploadOptimizedPhoto(file, 'new');
                        photoObjs.push({ url: uploaded.url, thumbnailUrl: uploaded.thumbnailUrl, status: 'Available', locations: [originStudio], notes: '', soldPrice: null, specificPrice: null });
                    } 
                } 
                photoObjs = reconcileNewItemPhotos(photoObjs, form.get('quantity'), originStudio);
                const styleSku = normalizeStyleSku(form.get('styleSku'));
                const styleEntry = normalizeStyleSkuCatalog(appSettings.styleSkus).find(entry => entry.sku === styleSku);
                if (!styleEntry) throw new Error('找不到所選 Style SKU，請重新整理後再試。');
                if (styleEntry.category !== form.get('category')) throw new Error('Category 與 Style SKU 不一致，請重新選擇。');
                const cleanCat = styleEntry.category;
                const itemRef = doc(collection(dbFirestore, "stock_items"));
                const counterRef = doc(dbFirestore, "settings", "garment_counters");

                await runTransaction(dbFirestore, async transaction => {
                    const counterSnapshot = await transaction.get(counterRef);
                    const allocation = allocateGarmentIdsFromCounter(counterSnapshot.exists() ? counterSnapshot.data() : {}, photoObjs, styleSku);
                    transaction.set(counterRef, { counters: allocation.counters, updatedAt: serverTimestamp() }, { merge: true });
                    transaction.set(itemRef, {
                        month: form.get('month'),
                        itemName: styleEntry.name || styleSku,
                        styleSku: allocation.styleSku,
                        category: cleanCat,
                        maker: form.get('maker'),
                        color: form.get('color'),
                        size: form.get('size'),
                        originStudio: originStudio,
                        quantity: allocation.photos.length,
                        cost: 0,
                        price: form.get('price'),
                        status: 'To Make',
                        photos: allocation.photos,
                        _version: 1,
                        updatedAt: serverTimestamp(),
                        createdAt: serverTimestamp()
                    });
                });
                window.closeModal(); 
                e.target.reset(); 
            } catch (error) { console.error(error); alert("Error: " + error.message); } finally { btn.innerText = '確認新增'; btn.disabled = false; } 
        };
        
        window.openEditModal = (id) => { 
            const item = db.find(i=>i.id===id); 
            if (!item) return;
            editBaseVersion = getVersion(item);
            document.getElementById('edit-id').value = id; 
            document.getElementById('edit-itemName').value = item.itemName; 
            const editStyleSku = document.getElementById('edit-styleSku');
            editStyleSku.value = normalizeStyleSku(item.styleSku);
            editStyleSku.disabled = hasGarmentIds(normalizePhotos(item));
            document.getElementById('edit-styleSku-help').innerText = editStyleSku.disabled
                ? '已建立 Garment ID，Style SKU 已鎖定。'
                : '舊工單可先留空；選定後會為每件（包括 Sold）建立永久 ID。';
            document.getElementById('edit-month').value = item.month; 
            document.getElementById('edit-status').value = item.status; 
            document.getElementById('edit-maker').value = item.maker || ''; 
            const resolvedCategory = getCatalogContext().resolveCategory(item);
            document.getElementById('edit-category').value = resolvedCategory === 'legacy' ? '' : resolvedCategory;
            document.getElementById('edit-quantity').value = item.quantity || normalizePhotos(item).length; 
            document.getElementById('edit-price').value = item.price !== undefined ? item.price : ''; 
            document.getElementById('edit-originStudio').value = item.originStudio || 'JB Studio'; 
            document.getElementById('edit-addPhotos').value = ''; 
            document.getElementById('edit-startDate').value = formatDateForInput(item.makingAt); 
            document.getElementById('edit-completedDate').value = formatDateForInput(item.completedAt); 
            
            window.tempEditPhotos = JSON.parse(JSON.stringify(normalizePhotos(item)));
            window.renderEditPhotos();

            document.getElementById('edit-modal').classList.remove('hidden'); 
        };

        window.renderEditPhotos = () => {
            const container = document.getElementById('edit-existing-photos');
            container.innerHTML = '';
            let hasPhotos = false;
            window.tempEditPhotos.forEach((p, idx) => {
                if(p.url) {
                    hasPhotos = true;
                    container.innerHTML += `
                        <div class="relative w-14 h-20 group rounded overflow-hidden border border-stone-200 bg-white flex-shrink-0 shadow-sm">
                            <img src="${escapeHtml(safeImageUrl(p.thumbnailUrl) || safeImageUrl(p.url))}" class="w-full h-full object-cover">
                            <button type="button" onclick="window.removeEditPhoto(${idx})" class="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
                                <i data-lucide="trash-2" class="w-5 h-5 drop-shadow-md"></i>
                            </button>
                        </div>
                    `;
                }
            });
            if(!hasPhotos) {
                container.innerHTML = '<span class="text-xs text-stone-400 italic py-2">目前沒有照片</span>';
            }
            lucide.createIcons();
        };

        window.removeEditPhoto = (idx) => {
            if(confirm('確定要移除此照片嗎？（儲存後才會正式生效）')) {
                window.tempEditPhotos[idx].url = ''; 
                window.tempEditPhotos[idx].thumbnailUrl = '';
                window.renderEditPhotos();
            }
        };
        
        window.closeEditModal = () => document.getElementById('edit-modal').classList.add('hidden');
        
        window.handleEditSubmit = async () => { 
            const id = document.getElementById('edit-id').value; 
            const btn = document.getElementById('btn-edit-save'); 
            btn.innerText = 'Saving...'; btn.disabled = true; 
            try { 
                const sDateVal = document.getElementById('edit-startDate').value; 
                const cDateVal = document.getElementById('edit-completedDate').value; 
                const newOriginStudio = document.getElementById('edit-originStudio').value;
                const newQty = parseInt(document.getElementById('edit-quantity').value) || 1;
                const requestedStyleSku = normalizeStyleSku(document.getElementById('edit-styleSku').value);
                const requestedStyleEntry = normalizeStyleSkuCatalog(appSettings.styleSkus).find(entry => entry.sku === requestedStyleSku);
                const item = db.find(i => i.id === id);
                if (!item) throw new Error('找不到此工单，可能已被删除。');
                const selectedCategory = normalizeStyleSkuCategory(document.getElementById('edit-category').value);
                
                let data = { 
                    status: document.getElementById('edit-status').value, 
                    maker: document.getElementById('edit-maker').value, 
                    category: requestedStyleEntry?.category || selectedCategory || item.category || '',
                    originStudio: newOriginStudio,
                    itemName: document.getElementById('edit-itemName').value, 
                    month: document.getElementById('edit-month').value, 
                    price: document.getElementById('edit-price').value 
                }; 
                if (requestedStyleSku) data.styleSku = requestedStyleSku;
                
                data.makingAt = sDateVal ? new Date(sDateVal.replace(/-/g, '/')) : null;
                data.completedAt = cDateVal ? new Date(cDateVal.replace(/-/g, '/')) : null;
                
                let existingPhotos = [...window.tempEditPhotos]; 
                let photosModified = false;
                const oldOriginStudio = item.originStudio || 'JB Studio';

                if (newQty !== existingPhotos.length) {
                    existingPhotos = resizeItemPhotos(existingPhotos, newQty, oldOriginStudio);
                    photosModified = true;
                }

                existingPhotos.forEach(p => {
                    if (!p.locations || p.locations.length === 0 || (p.locations.length === 1 && p.locations[0] === 'Studio')) {
                        p.locations = [newOriginStudio];
                        photosModified = true;
                    } else if (p.locations.includes(oldOriginStudio)) {
                        p.locations = p.locations.map(l => l === oldOriginStudio ? newOriginStudio : l);
                        photosModified = true;
                    }
                });

                const photoInput = document.getElementById('edit-addPhotos'); 
                if(photoInput.files.length > 0) { 
                    let fileIdx = 0;

                    for(let i=0; i<existingPhotos.length; i++) {
                        if (!existingPhotos[i].url && fileIdx < photoInput.files.length) {
                            const file = photoInput.files[fileIdx++];
                            btn.innerText = `優化照片 ${fileIdx}/${photoInput.files.length}...`;
                            const uploaded = await uploadOptimizedPhoto(file, 'replaced');
                            existingPhotos[i].url = uploaded.url;
                            existingPhotos[i].thumbnailUrl = uploaded.thumbnailUrl;
                            photosModified = true;
                        }
                    }

                    while(fileIdx < photoInput.files.length) {
                        const file = photoInput.files[fileIdx++]; 
                        btn.innerText = `優化照片 ${fileIdx}/${photoInput.files.length}...`;
                        const uploaded = await uploadOptimizedPhoto(file, 'added');
                        existingPhotos.push({ url: uploaded.url, thumbnailUrl: uploaded.thumbnailUrl, status: 'Available', locations: [newOriginStudio], notes: '', soldPrice: null, specificPrice: null });
                        photosModified = true;
                    }
                } 
                
                data.quantity = existingPhotos.length; 
                if (photosModified || existingPhotos.length > 0) {
                    data.photos = existingPhotos;
                }

                const itemRef = doc(dbFirestore, "stock_items", id);
                const counterRef = doc(dbFirestore, "settings", "garment_counters");
                await runTransaction(dbFirestore, async transaction => {
                    const snapshot = await transaction.get(itemRef);
                    if (!snapshot.exists()) throw new Error('找不到此工單，可能已被刪除。');
                    const latestItem = snapshot.data();
                    assertVersion(latestItem, editBaseVersion);

                    const latestPhotos = normalizePhotos(latestItem);
                    const lockedStyleSku = normalizeStyleSku(latestItem.styleSku);
                    if (hasGarmentIds(latestPhotos) && requestedStyleSku !== lockedStyleSku) {
                        throw new Error('此工單已有 Garment ID，Style SKU 不可更改。');
                    }

                    if (requestedStyleSku && existingPhotos.some(photo => !photo.garmentId)) {
                        const counterSnapshot = await transaction.get(counterRef);
                        const allocation = allocateGarmentIdsFromCounter(
                            counterSnapshot.exists() ? counterSnapshot.data() : {},
                            existingPhotos,
                            requestedStyleSku
                        );
                        existingPhotos = allocation.photos;
                        data.photos = existingPhotos;
                        data.quantity = existingPhotos.length;
                        transaction.set(counterRef, { counters: allocation.counters, updatedAt: serverTimestamp() }, { merge: true });
                    }

                    transaction.update(itemRef, {
                        ...data,
                        _version: nextVersion(latestItem),
                        updatedAt: serverTimestamp()
                    });
                });
                window.closeEditModal(); 
            } catch(error) { 
                console.error(error); alert("Error: " + error.message); 
            } finally { 
                btn.innerText = '儲存變更'; btn.disabled = false; 
            } 
        };

        window.handleArchive = async () => {
            if (!confirm('確定封存此工單？封存後不會出現在日常頁面、統計或 PDF，可到設定頁恢復。')) return;
            const itemRef = doc(dbFirestore, "stock_items", document.getElementById('edit-id').value);
            try {
                await runTransaction(dbFirestore, async transaction => {
                    const snapshot = await transaction.get(itemRef);
                    if (!snapshot.exists()) throw new Error('找不到此工單。');
                    const latestItem = snapshot.data();
                    assertVersion(latestItem, editBaseVersion);
                    transaction.update(itemRef, {
                        archived: true,
                        archivedAt: serverTimestamp(),
                        _version: nextVersion(latestItem),
                        updatedAt: serverTimestamp()
                    });
                });
                window.closeEditModal();
            } catch (error) {
                alert('封存失敗：' + error.message);
            }
        };
        
        function setMigrationControls(running) {
            migrationRunning = running;
            document.getElementById('migration-backup-button').disabled = running;
            document.getElementById('migration-scan').disabled = running;
            document.getElementById('migration-stop-button').disabled = !running;
            window.refreshImageMigrationStatus();
        }

        function showMigrationErrors(errors) {
            const errorEl = document.getElementById('migration-errors');
            errorEl.textContent = errors.join('\n');
            errorEl.classList.toggle('hidden', errors.length === 0);
        }

        async function acquireMigrationLock() {
            const settingsRef = doc(dbFirestore, 'settings', 'config');
            await runTransaction(dbFirestore, async transaction => {
                const snapshot = await transaction.get(settingsRef);
                if (!snapshot.exists()) throw new Error('找不到系統設定。');
                const lock = snapshot.data().imageMigrationLock;
                const now = Date.now();
                if (lock && lock.sessionId !== migrationSessionId && Number(lock.expiresAtMs) > now) {
                    throw new Error('另一個裝置正在執行照片優化，請等待該批次完成。');
                }
                transaction.update(settingsRef, {
                    imageMigrationLock: {
                        sessionId: migrationSessionId,
                        expiresAtMs: now + (20 * 60 * 1000)
                    }
                });
            });
        }

        async function releaseMigrationLock() {
            const settingsRef = doc(dbFirestore, 'settings', 'config');
            try {
                await runTransaction(dbFirestore, async transaction => {
                    const snapshot = await transaction.get(settingsRef);
                    if (!snapshot.exists()) return;
                    const lock = snapshot.data().imageMigrationLock;
                    if (lock?.sessionId === migrationSessionId) {
                        transaction.update(settingsRef, { imageMigrationLock: null });
                    }
                });
            } catch (error) {
                console.warn('Unable to release image migration lock:', error);
            }
        }

        window.refreshImageMigrationStatus = function() {
            const totalEl = document.getElementById('migration-total');
            if (!totalEl) return;
            const state = collectMigrationState(db, normalizePhotos);
            totalEl.textContent = state.totalPhotos;
            document.getElementById('migration-optimized').textContent = state.optimizedPhotos;
            document.getElementById('migration-pending').textContent = state.pending.length;
            document.getElementById('migration-rollback').textContent = state.rollback.length;
            const progress = state.totalPhotos > 0
                ? Math.round((state.optimizedPhotos / state.totalPhotos) * 100)
                : 0;
            document.getElementById('migration-progress-bar').style.width = `${progress}%`;
            if (!migrationRunning) {
                document.getElementById('migration-status').textContent = state.pending.length > 0
                    ? `還有 ${state.pending.length} 張舊照片等待優化。每次安全處理最多 ${MIGRATION_BATCH_SIZE} 張。`
                    : '所有有圖片的庫存資料都已具備縮圖。';
            }
            document.getElementById('migration-run-button').disabled = migrationRunning || !migrationBackupReady || state.pending.length === 0;
            document.getElementById('migration-rollback-button').disabled = migrationRunning || state.rollback.length === 0;
        };

        window.downloadImageMigrationBackup = function() {
            const payload = makeBackupPayload(db);
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `weiweiwei-stock-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            migrationBackupReady = true;
            migrationProcessedKeys.clear();
            document.getElementById('migration-status').textContent = '本次備份已下載，可以開始處理第一批照片。';
            window.refreshImageMigrationStatus();
        };

        async function fetchMigrationImage(sourceUrl) {
            const imageUrl = safeImageUrl(sourceUrl);
            if (!imageUrl || !imageUrl.startsWith('https:')) throw new Error('原始圖片網址無效。');
            const response = await fetch(imageUrl, { mode: 'cors' });
            if (!response.ok) throw new Error(`下載原圖失敗 (${response.status})`);
            const sourceBlob = await response.blob();
            if (sourceBlob.type.startsWith('image/')) return sourceBlob;
            return new Blob([sourceBlob], { type: 'image/jpeg' });
        }

        window.runImageMigrationBatch = async function() {
            if (migrationRunning) return;
            if (!migrationBackupReady) {
                alert('請先下載本次完整 JSON 備份。');
                return;
            }
            const state = collectMigrationState(db, normalizePhotos);
            const batch = state.pending
                .filter(candidate => !migrationProcessedKeys.has(`${candidate.itemId}:${candidate.photoIdx}`))
                .slice(0, MIGRATION_BATCH_SIZE);
            if (batch.length === 0) {
                if (state.pending.length > 0) alert('剩餘照片在本次執行中曾失敗。請查看錯誤、重新整理頁面後再重試。');
                return;
            }
            if (!confirm(`即將安全優化 ${batch.length} 張舊照片。原圖會保留，確定繼續？`)) return;

            migrationStopRequested = false;
            showMigrationErrors([]);
            setMigrationControls(true);
            const errors = [];
            let completed = 0;
            try {
                await acquireMigrationLock();
                for (const candidate of batch) {
                    if (migrationStopRequested) break;
                    document.getElementById('migration-status').textContent = `正在處理 ${completed + 1}/${batch.length}；關閉分頁前請先按停止。`;
                    try {
                        const sourceBlob = await fetchMigrationImage(candidate.sourceUrl);
                        const uploaded = await uploadOptimizedPhoto(sourceBlob, 'legacy');
                        await updatePhotoAtomic(candidate.itemId, candidate.photoIdx, latestPhoto => {
                            if (latestPhoto.thumbnailUrl) throw new Error('此照片已由其他裝置處理，已跳過。');
                            if (latestPhoto.url !== candidate.sourceUrl) throw new Error('照片已被修改，已跳過。');
                            return {
                                originalUrl: latestPhoto.originalUrl || latestPhoto.url,
                                url: uploaded.url,
                                thumbnailUrl: uploaded.thumbnailUrl,
                                migratedAt: Date.now()
                            };
                        });
                        migrationProcessedKeys.add(`${candidate.itemId}:${candidate.photoIdx}`);
                        completed++;
                    } catch (error) {
                        migrationProcessedKeys.add(`${candidate.itemId}:${candidate.photoIdx}`);
                        errors.push(`${candidate.itemId} #${candidate.photoIdx + 1}: ${error.message}`);
                    }
                }
            } catch (error) {
                errors.push(error.message);
            } finally {
                await releaseMigrationLock();
                setMigrationControls(false);
                showMigrationErrors(errors);
                document.getElementById('migration-status').textContent = migrationStopRequested
                    ? `已安全停止，本批完成 ${completed} 張；稍後可重新掃描並續跑。`
                    : `本批完成 ${completed} 張，失敗或跳過 ${errors.length} 張。`;
                setTimeout(window.refreshImageMigrationStatus, 1200);
            }
        };

        window.stopImageMigration = function() {
            migrationStopRequested = true;
            document.getElementById('migration-status').textContent = '正在完成目前這一張，完成後停止…';
            document.getElementById('migration-stop-button').disabled = true;
        };

        window.rollbackImageMigrationBatch = async function() {
            if (migrationRunning) return;
            const state = collectMigrationState(db, normalizePhotos);
            const batch = state.rollback.slice(0, MIGRATION_BATCH_SIZE);
            if (batch.length === 0) return;
            if (!confirm(`將 ${batch.length} 張照片回復為原始網址。新檔案不會立即刪除，確定繼續？`)) return;

            migrationStopRequested = false;
            showMigrationErrors([]);
            setMigrationControls(true);
            const errors = [];
            let completed = 0;
            try {
                await acquireMigrationLock();
                for (const candidate of batch) {
                    if (migrationStopRequested) break;
                    document.getElementById('migration-status').textContent = `正在回復 ${completed + 1}/${batch.length}…`;
                    try {
                        await updatePhotoAtomic(candidate.itemId, candidate.photoIdx, latestPhoto => {
                            if (!latestPhoto.originalUrl) throw new Error('找不到原始網址，已跳過。');
                            if (latestPhoto.originalUrl !== candidate.originalUrl) throw new Error('原始網址已改變，已跳過。');
                            return { url: latestPhoto.originalUrl, thumbnailUrl: '', originalUrl: '', migratedAt: 0 };
                        });
                        completed++;
                    } catch (error) {
                        errors.push(`${candidate.itemId} #${candidate.photoIdx + 1}: ${error.message}`);
                    }
                }
            } catch (error) {
                errors.push(error.message);
            } finally {
                await releaseMigrationLock();
                setMigrationControls(false);
                showMigrationErrors(errors);
                document.getElementById('migration-status').textContent = `已回復 ${completed} 張，失敗或跳過 ${errors.length} 張。`;
                setTimeout(window.refreshImageMigrationStatus, 1200);
            }
        };

        window.renderSettingsView = function() { 
            const render = (type) => [...new Set((appSettings[type]||[]).map(x=>type==='categories'?getCleanCategory(x):x).filter(Boolean))]
                .map(i => `<span class="bg-stone-100 px-2 py-1 rounded text-xs mr-1 mb-1 inline-block border cursor-pointer hover:bg-red-50 hover:text-red-500" onclick="window.removeSetting(${inlineString(type)}, ${inlineString(i)})">${escapeHtml(i)} &times;</span>`).join('');
            document.getElementById('settings-makers-list').innerHTML = render('makers'); 
            document.getElementById('settings-locations-list').innerHTML = render('locations'); 
            document.getElementById('settings-categories-list').innerHTML = render('categories'); 
            document.getElementById('settings-styleSkus-list').innerHTML = normalizeStyleSkuCatalog(appSettings.styleSkus)
                .map(entry => `<span class="bg-stone-100 px-2 py-1 rounded text-[10px] mr-1 mb-1 inline-block border cursor-pointer hover:bg-red-50 hover:text-red-500" onclick="window.removeStyleSku(${inlineString(entry.sku)})"><b>${escapeHtml(entry.category || 'OTHER')}</b> · <b class="font-mono">${escapeHtml(entry.sku)}</b>${entry.name ? ` · ${escapeHtml(entry.name)}` : ''} &times;</span>`)
                .join('');
            renderArchivedItems();
            window.refreshImageMigrationStatus();
            if (legacySkuPlan.length === 0 && !legacySkuMigrationRunning) window.refreshLegacySkuMigration();
            if (garmentIdMigrationPlan.length === 0 && !garmentIdMigrationRunning) window.refreshGarmentIdMigration();
        };

        function renderArchivedItems() {
            const count = document.getElementById('archived-items-count');
            const container = document.getElementById('archived-items-list');
            if (!count || !container) return;

            count.textContent = archivedItems.length;
            if (archivedItems.length === 0) {
                container.innerHTML = '<div class="rounded bg-stone-50 p-3 text-xs text-stone-400">目前沒有封存工單。</div>';
                return;
            }

            container.innerHTML = archivedItems.map(item => {
                const archivedDate = item.archivedAt
                    ? formatDateForInput(item.archivedAt) || '日期待同步'
                    : '旧封存资料';
                const pieceCount = normalizePhotos(item).length || Number(item.quantity) || 1;
                return `<div class="flex flex-col gap-3 border-b border-stone-100 p-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <div class="min-w-0">
                        <div class="truncate text-sm font-bold text-stone-700">${escapeHtml(item.itemName || item.styleSku || '未命名工单')}</div>
                        <div class="mt-1 text-[10px] text-stone-500"><span class="font-mono">${escapeHtml(item.styleSku || '未配对 SKU')}</span> · ${pieceCount} 件 · 封存于 ${escapeHtml(archivedDate)}</div>
                    </div>
                    <div class="flex flex-shrink-0 gap-2">
                        <button type="button" onclick="window.openArchivedItemDetails(${inlineString(item.id)})" class="min-h-[44px] rounded border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50">查看详情</button>
                        <button type="button" onclick="window.restoreArchivedItem(${inlineString(item.id)})" class="min-h-[44px] rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">恢复工单</button>
                    </div>
                </div>`;
            }).join('');
        }

        window.openArchivedItemDetails = function(itemId) {
            const item = archivedItems.find(candidate => candidate.id === itemId);
            if (!item) {
                alert('找不到此封存工单，资料可能已经恢复。');
                return;
            }

            const photos = normalizePhotos(item);
            const archivedDate = item.archivedAt ? formatDateForInput(item.archivedAt) || '日期待同步' : '旧封存资料';
            document.getElementById('archived-detail-title').textContent = item.itemName || item.styleSku || '未命名工单';
            document.getElementById('archived-detail-summary').textContent = [
                item.styleSku || '未配对 SKU',
                getCleanCategory(item.category) || '未分类',
                `${photos.length || Number(item.quantity) || 1} 件`,
                `封存于 ${archivedDate}`
            ].join(' · ');
            document.getElementById('archived-detail-meta').innerHTML = [
                ['月份', item.month || '-'],
                ['制作人', item.maker || '-'],
                ['生产 Studio', item.studio || '-'],
                ['颜色', item.color || '-'],
                ['尺寸', item.size || '-'],
                ['主定价', item.price ? `RM${item.price}` : '-']
            ].map(([label, value]) => `<div class="rounded bg-stone-50 p-2"><div class="text-[10px] text-stone-400">${escapeHtml(label)}</div><div class="mt-0.5 text-xs font-bold text-stone-700">${escapeHtml(value)}</div></div>`).join('');

            const pieces = photos.length ? photos : [{ locations: [], status: item.status || 'Unknown' }];
            document.getElementById('archived-detail-pieces').innerHTML = pieces.map((photo, index) => {
                const imageUrl = safeImageUrl(photo.thumbnailUrl || photo.url);
                const locations = Array.isArray(photo.locations) && photo.locations.length ? photo.locations.join(' + ') : '无地点';
                const price = photo.status === 'Sold'
                    ? (photo.soldPrice !== null && photo.soldPrice !== undefined && photo.soldPrice !== '' ? `Sold ${formatSoldMoney(photo.soldPrice, getSoldCurrency(photo))}` : 'Sold')
                    : (photo.specificPrice !== undefined && photo.specificPrice !== null ? `RM${photo.specificPrice}` : (item.price ? `RM${item.price}` : '未定价'));
                const soldDate = photo.soldAt ? formatDateForInput(photo.soldAt) : '';
                const saleDetails = photo.status === 'Sold'
                    ? [soldDate, photo.paymentMethod, photo.soldLocation, photo.saleEvent, photo.salesNote].filter(Boolean).join(' · ')
                    : '';
                return `<div class="flex gap-3 rounded border border-stone-200 p-3">
                    <div class="h-20 w-16 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" class="h-full w-full object-cover">` : '<div class="flex h-full items-center justify-center text-[10px] text-stone-400">No Img</div>'}
                    </div>
                    <div class="min-w-0 flex-1 text-xs text-stone-600">
                        <div class="font-mono font-bold text-stone-800">${escapeHtml(photo.garmentId || `${item.styleSku || 'Item'} #${index + 1}`)}</div>
                        <div class="mt-1">${escapeHtml(photo.status || item.status || 'Unknown')} · ${escapeHtml(price)}</div>
                        <div class="mt-1 break-words">位置：${escapeHtml(locations)}</div>
                        ${saleDetails ? `<div class="mt-1 break-words text-stone-500">销售：${escapeHtml(saleDetails)}</div>` : ''}
                        ${photo.notes ? `<div class="mt-1 break-words text-stone-500">备注：${escapeHtml(photo.notes)}</div>` : ''}
                    </div>
                </div>`;
            }).join('');
            document.getElementById('archived-detail-modal').classList.remove('hidden');
        };

        window.closeArchivedItemDetails = function() {
            document.getElementById('archived-detail-modal').classList.add('hidden');
        };

        window.restoreArchivedItem = async function(itemId) {
            if (!confirm('确定恢复此工单？恢复后会重新出现在日常页面、统计和 PDF。')) return;
            const itemRef = doc(dbFirestore, "stock_items", itemId);
            try {
                await runTransaction(dbFirestore, async transaction => {
                    const snapshot = await transaction.get(itemRef);
                    if (!snapshot.exists()) throw new Error('找不到此封存工单。');
                    const latestItem = snapshot.data();
                    if (latestItem.archived !== true && !latestItem.archivedAt) return;
                    transaction.update(itemRef, {
                        archived: false,
                        archivedAt: null,
                        _version: nextVersion(latestItem),
                        updatedAt: serverTimestamp()
                    });
                });
            } catch (error) {
                alert('恢复失败：' + error.message);
            }
        };

        function renderLegacySkuMigration() {
            const counts = { ready: 0, manual: 0, blocked: 0, unchanged: 0 };
            legacySkuPlan.forEach(row => { counts[row.status] = (counts[row.status] || 0) + 1; });
            document.getElementById('sku-migration-ready').textContent = counts.ready;
            document.getElementById('sku-migration-manual').textContent = counts.manual;
            document.getElementById('sku-migration-blocked').textContent = counts.blocked;
            document.getElementById('sku-migration-unchanged').textContent = counts.unchanged;

            const catalog = normalizeStyleSkuCatalog(appSettings.styleSkus);
            const rows = legacySkuPlan.filter(row => row.status !== 'unchanged');
            document.getElementById('sku-migration-preview').innerHTML = rows.length === 0
                ? '<div class="rounded bg-emerald-50 p-3 text-xs font-bold text-emerald-700">全部舊資料已正確配對。</div>'
                : rows.map(row => {
                    const optionEntries = row.candidates.length > 0 ? row.candidates : catalog;
                    const targetHtml = row.status === 'ready'
                        ? `<b class="font-mono">${escapeHtml(row.target.sku)}</b><br>${escapeHtml(row.target.name || row.target.sku)} · ${escapeHtml(row.target.category)}`
                        : row.status === 'manual'
                            ? `<select data-sku-migration-item="${escapeHtml(row.itemId)}" onchange="window.setLegacySkuSelection(${inlineString(row.itemId)}, this.value)" class="w-full rounded border border-amber-200 bg-white p-1.5 text-xs"><option value="">暫時跳過／請選擇</option>${optionEntries.map(entry => `<option value="${escapeHtml(entry.sku)}"${row.manualSku === entry.sku ? ' selected' : ''}>[${escapeHtml(entry.category)}] ${escapeHtml(entry.sku)} — ${escapeHtml(entry.name || entry.sku)}</option>`).join('')}</select>`
                            : `<span class="font-bold text-red-600">不可自動處理</span>`;
                    const statusClass = row.status === 'ready' ? 'text-emerald-700' : row.status === 'manual' ? 'text-amber-700' : 'text-red-700';
                    return `<div class="grid grid-cols-1 gap-2 border-b border-stone-100 p-3 md:grid-cols-[1fr_1fr_120px]">
                        <div class="text-xs"><b>${escapeHtml(row.currentName || '未填品名')}</b><br><span class="font-mono text-stone-400">${escapeHtml(row.currentSku || '未填 SKU')}</span> · ${escapeHtml(row.currentCategory || '未填 Category')}</div>
                        <div class="text-xs">${targetHtml}</div>
                        <div class="text-xs font-bold ${statusClass}">${escapeHtml(row.message)}</div>
                    </div>`;
                }).join('');

            document.getElementById('sku-migration-backup-button').disabled = legacySkuMigrationRunning || legacySkuPlan.length === 0;
            document.getElementById('sku-migration-run-button').disabled = legacySkuMigrationRunning || !legacySkuBackupReady || (counts.ready === 0 && counts.manual === 0);
            document.getElementById('sku-migration-scan-button').disabled = legacySkuMigrationRunning;
            document.getElementById('sku-migration-status').textContent = legacySkuMigrationRunning
                ? '正在安全更新，請不要關閉頁面…'
                : legacySkuBackupReady
                    ? '備份已下載。確認預覽及手動選項後即可執行。'
                    : '請先下載備份；不確定的資料可保持「暫時跳過」。';
        }

        window.refreshLegacySkuMigration = function() {
            if (legacySkuMigrationRunning) return;
            legacySkuPlan = buildLegacySkuPlan(db, appSettings.styleSkus, normalizePhotos);
            legacySkuBackupReady = false;
            renderLegacySkuMigration();
        };

        window.setLegacySkuSelection = function(itemId, styleSku) {
            const row = legacySkuPlan.find(candidate => candidate.itemId === itemId);
            if (row && row.status === 'manual') row.manualSku = normalizeStyleSku(styleSku);
        };

        window.downloadLegacySkuBackup = function() {
            const payload = makeSkuMigrationBackup(db, legacySkuPlan);
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `weiweiwei-legacy-sku-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            legacySkuBackupReady = true;
            renderLegacySkuMigration();
        };

        window.runLegacySkuMigration = async function() {
            if (legacySkuMigrationRunning || !legacySkuBackupReady) return;
            const catalog = normalizeStyleSkuCatalog(appSettings.styleSkus);
            const updates = legacySkuPlan.flatMap(row => {
                const selectedSku = row.status === 'ready' ? row.target.sku : row.manualSku;
                const target = catalog.find(entry => entry.sku === selectedSku);
                return target ? [{ ...row, target }] : [];
            });
            if (updates.length === 0) {
                alert('目前沒有可更新的資料；請為需要人工確認的資料選擇 SKU。');
                return;
            }
            if (!confirm(`將更新 ${updates.length} 筆舊資料的 Style SKU、品名及 Category。Sold 也包含在內；其他欄位不會改動。確定繼續？`)) return;

            legacySkuMigrationRunning = true;
            renderLegacySkuMigration();
            const errors = [];
            let completed = 0;
            for (const row of updates) {
                try {
                    const itemRef = doc(dbFirestore, 'stock_items', row.itemId);
                    await runTransaction(dbFirestore, async transaction => {
                        const snapshot = await transaction.get(itemRef);
                        if (!snapshot.exists()) throw new Error('商品已不存在');
                        const latestItem = snapshot.data();
                        assertVersion(latestItem, row.version);
                        if (!garmentIdsMatchSku(normalizePhotos(latestItem), row.target.sku)) {
                            throw new Error('Garment ID 與所選 SKU 不一致');
                        }
                        transaction.update(itemRef, {
                            styleSku: row.target.sku,
                            itemName: row.target.name || row.target.sku,
                            category: row.target.category,
                            _version: nextVersion(latestItem),
                            updatedAt: serverTimestamp()
                        });
                    });
                    completed++;
                    document.getElementById('sku-migration-status').textContent = `已完成 ${completed}/${updates.length} 筆…`;
                } catch (error) {
                    errors.push(`${row.currentName || row.itemId}: ${error.message}`);
                }
            }
            legacySkuMigrationRunning = false;
            legacySkuPlan = buildLegacySkuPlan(db, appSettings.styleSkus, normalizePhotos);
            legacySkuBackupReady = false;
            renderLegacySkuMigration();
            document.getElementById('sku-migration-status').textContent = `完成 ${completed} 筆，跳過或失敗 ${errors.length} 筆。請重新掃描確認結果。`;
            const errorEl = document.getElementById('sku-migration-errors');
            errorEl.textContent = errors.join('\n');
            errorEl.classList.toggle('hidden', errors.length === 0);
        };

        function renderGarmentIdMigration() {
            const counts = { ready: 0, blocked: 0, unchanged: 0 };
            garmentIdMigrationPlan.forEach(row => { counts[row.status] = (counts[row.status] || 0) + 1; });
            const missingPieces = garmentIdMigrationPlan
                .filter(row => row.status === 'ready')
                .reduce((sum, row) => sum + row.missingCount, 0);
            document.getElementById('garment-id-ready').textContent = counts.ready;
            document.getElementById('garment-id-pieces').textContent = missingPieces;
            document.getElementById('garment-id-blocked').textContent = counts.blocked;
            document.getElementById('garment-id-unchanged').textContent = counts.unchanged;

            const rows = garmentIdMigrationPlan.filter(row => row.status !== 'unchanged');
            const visibleRows = rows.slice(0, 200);
            document.getElementById('garment-id-preview').innerHTML = visibleRows.length === 0
                ? '<div class="rounded bg-emerald-50 p-3 text-xs font-bold text-emerald-700">全部商品已有永久编号。</div>'
                : visibleRows.map(row => {
                    const statusClass = row.status === 'ready' ? 'text-emerald-700' : 'text-red-700';
                    return `<div class="grid grid-cols-1 gap-2 border-b border-stone-100 p-3 md:grid-cols-[1fr_120px_1fr]">
                        <div class="text-xs"><b>${escapeHtml(row.itemName || '未填品名')}</b><br><span class="font-mono text-stone-500">${escapeHtml(row.sku || '未填 SKU')}</span></div>
                        <div class="text-xs text-stone-500">共 ${row.pieceCount} 件<br>缺 ${row.missingCount} 个编号</div>
                        <div class="text-xs font-bold ${statusClass}">${escapeHtml(row.message)}</div>
                    </div>`;
                }).join('') + (rows.length > visibleRows.length
                    ? `<div class="p-3 text-center text-xs text-stone-400">另有 ${rows.length - visibleRows.length} 笔；执行或重新扫描后会继续显示。</div>`
                    : '');

            document.getElementById('garment-id-scan-button').disabled = garmentIdMigrationRunning;
            document.getElementById('garment-id-backup-button').disabled = garmentIdMigrationRunning || garmentIdMigrationPlan.length === 0;
            document.getElementById('garment-id-run-button').disabled = garmentIdMigrationRunning || !garmentIdBackupReady || counts.ready === 0;
            document.getElementById('garment-id-status').textContent = garmentIdMigrationRunning
                ? '正在安全补编号，请不要关闭页面…'
                : garmentIdBackupReady
                    ? `备份已下载；每次最多处理 ${GARMENT_ID_MIGRATION_BATCH_SIZE} 笔工单。`
                    : '请先检查预览并下载完整备份；冲突资料不会自动处理。';
        }

        window.refreshGarmentIdMigration = function() {
            if (garmentIdMigrationRunning) return;
            garmentIdMigrationPlan = buildGarmentIdMigrationPlan(db, appSettings.styleSkus);
            garmentIdBackupReady = false;
            renderGarmentIdMigration();
        };

        window.downloadGarmentIdBackup = function() {
            const payload = makeGarmentIdMigrationBackup(db, garmentIdMigrationPlan);
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `weiweiwei-garment-id-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            garmentIdBackupReady = true;
            renderGarmentIdMigration();
        };

        window.runGarmentIdMigration = async function() {
            if (garmentIdMigrationRunning || !garmentIdBackupReady) return;
            const batch = garmentIdMigrationPlan
                .filter(row => row.status === 'ready')
                .slice(0, GARMENT_ID_MIGRATION_BATCH_SIZE);
            if (batch.length === 0) return;
            const pieceCount = batch.reduce((sum, row) => sum + row.missingCount, 0);
            if (!confirm(`将为 ${batch.length} 笔工单补上 ${pieceCount} 个永久 Garment ID。包含 Sold；不会改变售价、地点或销售状态。确定继续？`)) return;

            garmentIdMigrationRunning = true;
            renderGarmentIdMigration();
            const errors = [];
            let completed = 0;
            for (const row of batch) {
                try {
                    const itemRef = doc(dbFirestore, 'stock_items', row.itemId);
                    const counterRef = doc(dbFirestore, 'settings', 'garment_counters');
                    await runTransaction(dbFirestore, async transaction => {
                        const itemSnapshot = await transaction.get(itemRef);
                        if (!itemSnapshot.exists()) throw new Error('商品已不存在');
                        const latestItem = itemSnapshot.data();
                        assertVersion(latestItem, row.version);
                        if (normalizeStyleSku(latestItem.styleSku) !== row.sku) throw new Error('Style SKU 已改变，请重新扫描');

                        const counterSnapshot = await transaction.get(counterRef);
                        const counters = { ...(counterSnapshot.exists() ? counterSnapshot.data().counters || {} : {}) };
                        const allocation = assignLegacyGarmentIds(latestItem, Number(counters[row.sku]) || 0, row.maximumSequence);
                        counters[row.sku] = allocation.nextCounter;
                        transaction.set(counterRef, { counters, updatedAt: serverTimestamp() }, { merge: true });
                        transaction.update(itemRef, {
                            photos: allocation.photos,
                            _version: nextVersion(latestItem),
                            updatedAt: serverTimestamp()
                        });
                    });
                    completed++;
                    document.getElementById('garment-id-status').textContent = `已完成 ${completed}/${batch.length} 笔…`;
                } catch (error) {
                    errors.push(`${row.itemName || row.itemId}: ${error.message}`);
                }
            }

            garmentIdMigrationRunning = false;
            garmentIdMigrationPlan = buildGarmentIdMigrationPlan(db, appSettings.styleSkus);
            garmentIdBackupReady = false;
            renderGarmentIdMigration();
            document.getElementById('garment-id-status').textContent = `本批完成 ${completed} 笔，失败或跳过 ${errors.length} 笔。请重新扫描确认；如仍有待处理资料，请重新下载备份后继续。`;
            const errorEl = document.getElementById('garment-id-errors');
            errorEl.textContent = errors.join('\n');
            errorEl.classList.toggle('hidden', errors.length === 0);
        };
        
        window.addSetting = async function(type) { const map = {'makers':'new-maker-input', 'locations':'new-location-input', 'categories':'new-category-input'}; let val = document.getElementById(map[type]).value; if (type === 'categories') val = getCleanCategory(val); else val = val.trim(); if(val) { await updateDoc(doc(dbFirestore, "settings", "config"), { [type]: arrayUnion(val) }); document.getElementById(map[type]).value = ''; } };
        window.addStyleSku = async function() {
            const skuInput = document.getElementById('new-style-sku-input');
            const nameInput = document.getElementById('new-style-sku-name-input');
            const category = document.getElementById('new-style-sku-category-input').value;
            const sku = normalizeStyleSku(skuInput.value);
            const name = nameInput.value.trim();
            if (!category || !sku || !name) {
                alert('請選擇 Category，並輸入 Style SKU 和商品名稱。');
                return;
            }
            if (normalizeStyleSkuCatalog(appSettings.styleSkus).some(entry => entry.sku === sku)) {
                alert(`Style SKU ${sku} 已存在。`);
                return;
            }
            const settingsRef = doc(dbFirestore, "settings", "config");
            await runTransaction(dbFirestore, async transaction => {
                const snapshot = await transaction.get(settingsRef);
                if (!snapshot.exists()) throw new Error('找不到系統設定。');
                const latestValues = normalizeStyleSkuCatalog(snapshot.data().styleSkus || appSettings.styleSkus);
                if (latestValues.some(entry => entry.sku === sku)) throw new Error(`Style SKU ${sku} 已存在。`);
                transaction.update(settingsRef, { styleSkus: normalizeStyleSkuCatalog([...latestValues, { category, sku, name }]) });
            });
            skuInput.value = '';
            nameInput.value = '';
        };

        window.removeStyleSku = async function(sku) {
            const normalizedSku = normalizeStyleSku(sku);
            if (DEFAULT_STYLE_SKUS.some(entry => entry.sku === normalizedSku)) {
                alert(`Style SKU ${normalizedSku} 來自 2026 COGS 清單，不能在網站刪除。`);
                return;
            }
            const allItems = Array.from(stockItemsById.values());
            if (isStyleSkuReferenced(allItems, normalizedSku, normalizeStyleSku)) {
                alert(`Style SKU ${normalizedSku} 已被工單使用，不能刪除。`);
                return;
            }
            if (!confirm(`確定要刪除 ${normalizedSku}?`)) return;
            const settingsRef = doc(dbFirestore, "settings", "config");
            await runTransaction(dbFirestore, async transaction => {
                const snapshot = await transaction.get(settingsRef);
                if (!snapshot.exists()) throw new Error('找不到系統設定。');
                const latestValues = normalizeStyleSkuCatalog(snapshot.data().styleSkus || appSettings.styleSkus);
                transaction.update(settingsRef, { styleSkus: latestValues.filter(entry => entry.sku !== normalizedSku) });
            });
        };

        window.removeSetting = async function(type, val) { 
            if (type === 'locations' && ['JB Studio', 'PNG Studio', 'Online'].includes(val)) {
                alert("此為系統預設核心地點，為保證運作正常，無法被刪除！");
                return;
            }
            if (type === 'locations' && isLocationReferenced(Array.from(stockItemsById.values()), val)) {
                alert(`地點 ${val} 已被工單使用，不能刪除。`);
                return;
            }
            if(confirm(`確定要刪除 ${val}?`)) {
                const settingsRef = doc(dbFirestore, "settings", "config");
                await runTransaction(dbFirestore, async transaction => {
                    const snapshot = await transaction.get(settingsRef);
                    if (!snapshot.exists()) throw new Error('找不到系統設定。');
                    const latestValues = snapshot.data()[type] || [];
                    transaction.update(settingsRef, {
                        [type]: latestValues.filter(x => (type==='categories'?getCleanCategory(x):x) !== val)
                    });
                });
            }
        }

        function populateLinkedStyleSkuFilter(scope, preferredSku = '') {
            const categorySelect = document.getElementById(`${scope}-filter-category`);
            const skuSelect = document.getElementById(`${scope}-filter-style-sku`);
            if (!categorySelect || !skuSelect) return;
            const category = categorySelect.value;
            const catalog = normalizeStyleSkuCatalog(appSettings.styleSkus);
            const entries = category === 'all'
                ? catalog
                : catalog.filter(entry => entry.category === category);
            const requestedSku = normalizeStyleSku(preferredSku || skuSelect.value);
            skuSelect.innerHTML = '<option value="all">全部商品</option>' + entries
                .map(entry => `<option value="${escapeHtml(entry.sku)}">${escapeHtml(entry.sku)}${entry.name ? ` — ${escapeHtml(entry.name)}` : ''}</option>`)
                .join('');
            skuSelect.value = entries.some(entry => entry.sku === requestedSku) ? requestedSku : 'all';
        }

        window.handleCategoryFilterChange = function(scope) {
            populateLinkedStyleSkuFilter(scope);
            if (scope === 'prod') window.resetProductionPage();
            else if (scope === 'alloc') window.resetAllocationPage();
        };

        window.handleStyleSkuFilterChange = function(scope) {
            const skuSelect = document.getElementById(`${scope}-filter-style-sku`);
            const categorySelect = document.getElementById(`${scope}-filter-category`);
            const selectedSku = normalizeStyleSku(skuSelect?.value);
            const entry = normalizeStyleSkuCatalog(appSettings.styleSkus).find(candidate => candidate.sku === selectedSku);
            if (entry && categorySelect) categorySelect.value = entry.category;
            populateLinkedStyleSkuFilter(scope, selectedSku);
            if (scope === 'prod') window.resetProductionPage();
            else if (scope === 'alloc') window.resetAllocationPage();
        };
        
        window.updateDropdowns = function() { 
            const distinctMakers = [...new Set([...appSettings.makers, ...db.map(i => i.maker)])].filter(Boolean).sort(); 
            const distinctStyleSkus = normalizeStyleSkuCatalog([
                ...db.filter(item => item.styleSku).map(item => ({ sku: item.styleSku, name: item.itemName || '', category: item.category || '' })),
                ...appSettings.styleSkus
            ]);
            const canonicalCatalog = normalizeStyleSkuCatalog(appSettings.styleSkus);
            const skuCategories = [...new Set(canonicalCatalog.map(entry => entry.category).filter(Boolean))];
            const catalogSkuSet = new Set(canonicalCatalog.map(entry => entry.sku));
            const hasLegacyItems = db.some(item => !catalogSkuSet.has(normalizeStyleSku(item.styleSku)));
            const nextSignature = JSON.stringify({
                makers: distinctMakers,
                categories: skuCategories,
                hasLegacyItems,
                locations: appSettings.locations,
                styleSkus: distinctStyleSkus
            });
            if (nextSignature === dropdownSignature) return;
            dropdownSignature = nextSignature;
            
            const locSelect = document.getElementById('alloc-filter-location'); 
            if(locSelect) { 
                const currentVal = locSelect.value; 
                let html = `
                    <option value="all">全部庫存 (All)</option>
                    <option value="Sold">已售出 (Sold)</option>
                    <option value="Unallocated">無地點 (Unallocated)</option>
                    
                    <optgroup label="🌐 線上商店">
                        <option value="Online">Online (已上線總覽)</option>
                    </optgroup>
                    
                    <optgroup label="🏠 工作室 (Studio庫存/調貨)">
                        <option value="JB Studio">JB Studio</option>
                        <option value="PNG Studio">PNG Studio</option>
                    </optgroup>
                `; 
                
                const stockists = appSettings.locations.filter(l => !(l.toUpperCase().includes('JB') || l.toUpperCase().includes('PNG') || l.toUpperCase() === 'ONLINE'));
                
                if(stockists.length > 0) {
                    html += `<optgroup label="🚚 已出貨 (Stockists)">`;
                    stockists.forEach(l => html += `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`);
                    html += `</optgroup>`;
                }

                locSelect.innerHTML = html;
                const hasCurrentLocation = [...locSelect.options].some(option => option.value === currentVal);
                locSelect.value = hasCurrentLocation ? currentVal : "all";
            } 
            
            const fill = (cls, list) => document.querySelectorAll(cls).forEach(s => { 
                const old = s.value; 
                const isFilter = s.id.includes('filter');
                s.innerHTML = (isFilter ? '<option value="all">全部</option>' : '') + list.map(i=>`<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join('');
                if(list.includes(old)) s.value = old;
                else if (isFilter) s.value = "all";
            }); 
            
            fill('.dynamic-maker-select', distinctMakers); 
            fill('.dynamic-sku-category-select', skuCategories);
            document.querySelectorAll('.dynamic-category-select').forEach(select => {
                const oldCategory = select.value;
                const isFilter = select.id.includes('filter');
                select.innerHTML = (isFilter ? '<option value="all">全部类别</option>' : '<option value="">选择 Category</option>')
                    + skuCategories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(categoryLabel(category))}</option>`).join('')
                    + (isFilter && hasLegacyItems ? '<option value="legacy">未配对旧资料</option>' : '');
                const allowed = skuCategories.includes(oldCategory) || (isFilter && oldCategory === 'legacy' && hasLegacyItems);
                select.value = allowed ? oldCategory : (isFilter ? 'all' : '');
            });
            populateLinkedStyleSkuFilter('prod');
            populateLinkedStyleSkuFilter('alloc');
            document.querySelectorAll('.dynamic-style-sku-select').forEach(select => {
                const old = normalizeStyleSku(select.value);
                select.innerHTML = '<option value="">選擇 Style SKU</option>' + distinctStyleSkus
                    .map(entry => `<option value="${escapeHtml(entry.sku)}">[${escapeHtml(entry.category)}] ${escapeHtml(entry.sku)}${entry.name ? ` — ${escapeHtml(entry.name)}` : ''}</option>`)
                    .join('');
                if (distinctStyleSkus.some(entry => entry.sku === old)) select.value = old;
            });

            const newCategorySelect = document.getElementById('new-item-category');
            if (newCategorySelect) {
                const oldCategory = newCategorySelect.value;
                newCategorySelect.innerHTML = '<option value="">選擇 Category</option>' + skuCategories
                    .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
                    .join('');
                if (skuCategories.includes(oldCategory)) newCategorySelect.value = oldCategory;
            }
            window.updateNewItemSkuOptions();
        };

        window.updateNewItemSkuOptions = function() {
            const categorySelect = document.getElementById('new-item-category');
            const skuSelect = document.getElementById('new-item-styleSku');
            if (!categorySelect || !skuSelect) return;
            const category = categorySelect.value;
            const oldSku = normalizeStyleSku(skuSelect.value);
            const matches = normalizeStyleSkuCatalog(appSettings.styleSkus).filter(entry => entry.category === category);
            skuSelect.innerHTML = '<option value="">選擇 Style SKU</option>' + matches
                .map(entry => `<option value="${escapeHtml(entry.sku)}">${escapeHtml(entry.sku)}${entry.name ? ` — ${escapeHtml(entry.name)}` : ''}</option>`)
                .join('');
            if (matches.some(entry => entry.sku === oldSku)) skuSelect.value = oldSku;
        };
        
        window.switchView = (v) => {
            activeView = v;
            document.querySelectorAll('section[id^="view-"]').forEach(el => el.classList.add('hidden'));
            document.getElementById(`view-${v}`).classList.remove('hidden');
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('nav-active'));
            document.getElementById(`nav-${v}`)?.classList.add('nav-active');
            renderActiveView();
        };
        window.updateRole = () => {
            document.getElementById('nav-settings').classList.remove('hidden');
            document.getElementById('mobile-nav-settings').classList.remove('hidden');
            window.switchView('dashboard');
        };
        window.openModal = () => {
            window.updateNewItemSkuOptions();
            document.getElementById('add-modal').classList.remove('hidden');
        };
        window.closeModal = () => document.getElementById('add-modal').classList.add('hidden');
        // 打開照片放大視窗
window.openImageViewer = function(url) {
    const imageUrl = safeImageUrl(url);
    if (!imageUrl) return;
    document.getElementById('image-viewer-img').src = imageUrl;
    document.getElementById('image-viewer-modal').classList.remove('hidden');
};

// 關閉照片放大視窗
window.closeImageViewer = function() {
    document.getElementById('image-viewer-modal').classList.add('hidden');
    // 延遲清除圖片來源，避免關閉動畫時閃爍
    setTimeout(() => { document.getElementById('image-viewer-img').src = ''; }, 300);
};

        // 🛠️ 整合功能：實現 Location 庫存導出成高質感 PDF 清單 (顯示所有庫存照片)
        window.exportLocationPDF = async function() {
            const btn = document.getElementById('btn-export-pdf');
            btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 準備資料...';
            btn.disabled = true;

            const locFilter = document.getElementById('alloc-filter-location').value;
            const catFilter = document.getElementById('alloc-filter-category').value;
            const styleSkuFilter = document.getElementById('alloc-filter-style-sku').value;
            const garmentIdSearch = normalizeGarmentIdSearch(document.getElementById('allocation-garment-search').value);
            const displayLocRaw = document.getElementById('alloc-filter-location').options[document.getElementById('alloc-filter-location').selectedIndex]?.text || locFilter;
            const displayLoc = locFilter === 'all' ? '全部地點' : displayLocRaw.replace(/[\(🌐🚚🏠\)]/g, '').trim();
            const displayCat = catFilter === 'all' ? '全部類別' : (catFilter === 'legacy' ? '未配對舊資料' : categoryLabel(catFilter));
            const selectedStyleSku = normalizeStyleSku(styleSkuFilter);
            const selectedStyleEntry = normalizeStyleSkuCatalog(appSettings.styleSkus).find(entry => entry.sku === selectedStyleSku);
            const displayStyle = styleSkuFilter === 'all' ? '全部商品' : `${selectedStyleSku}${selectedStyleEntry?.name ? ` · ${selectedStyleEntry.name}` : ''}`;
            const includeLocationColumn = locFilter === 'all' || Boolean(garmentIdSearch);

            let exportData = [];
            let totalQty = 0;
            const { resolveCategory } = getCatalogContext();

            // 1. 篩選與加總特定地點下的單品數據
            const categoryItems = garmentIdSearch
                ? db.filter(item => normalizePhotos(item).some(photo => photoMatchesGarmentSearch(photo, garmentIdSearch)))
                : filterAllocationItemsByCategory(
                    db.filter(i => i.status === 'Ready' || i.status === 'In Studio' || i.status === 'Sold' || i.status === 'Partial Sold'),
                    catFilter,
                    resolveCategory
                );
            const exportItems = garmentIdSearch
                ? categoryItems
                : filterAllocationItemsByStyleSku(categoryItems, styleSkuFilter, normalizeStyleSku);
            exportItems.forEach(item => {
                const photos = normalizePhotos(item);
                let locPhotos = [];

                if (garmentIdSearch) {
                    locPhotos = photos.filter(photo => photoMatchesGarmentSearch(photo, garmentIdSearch));
                } else if (locFilter === 'all') {
                    locPhotos = photos;
                } else if (locFilter === 'Sold') {
                    locPhotos = photos.filter(p => p.status === 'Sold');
                } else if (locFilter === 'Unallocated') {
                    locPhotos = photos.filter(p => p.status !== 'Sold' && p.locations.length === 0);
                } else {
                    locPhotos = photos.filter(p => p.status !== 'Sold' && p.locations.includes(locFilter));
                }

                if (locPhotos.length > 0) {
                    let recordDate = '-';
                    const rawDate = item.completedAt || item.createdAt;
                    if (rawDate) {
                        const d = new Date(rawDate.seconds ? rawDate.seconds * 1000 : rawDate);
                        recordDate = d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                    }
                    
                    // 收集該地點下此單品的所有有效照片網址
                    const imgUrls = locPhotos.map(p => safeImageUrl(p.thumbnailUrl) || safeImageUrl(p.url)).filter(Boolean);

                    exportData.push({
                        imgUrls: imgUrls,      // 存入陣列
                        renderUrls: [],        // 準備用來存多張 Base64
                        dateStr: recordDate,
                        category: getCleanCategory(item.category),
                        itemName: item.itemName,
                        garmentIds: locPhotos.map(photo => photo.garmentId || item.styleSku || '尚未編號'),
                        currentLocations: summarizeCurrentLocations(locPhotos),
                        color: item.color || '-',
                        size: item.size || '-',
                        price: item.price ? `RM ${item.price}` : '-',
                        qty: locPhotos.length
                    });
                    totalQty += locPhotos.length;
                }
            });

            if (exportData.length === 0) {
                alert('目前選擇的地點沒有可供導出的庫存物件！');
                resetExportButton(btn);
                return;
            }

            // 2. 以有限並行下載縮圖。整體最多等待 30 秒，單張失敗不阻擋 PDF。
            const uniqueImageUrls = [...new Set(exportData.flatMap(row => row.imgUrls))];
            const imageDeadline = Date.now() + 30000;
            btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 載入圖片 0/${uniqueImageUrls.length}`;

            const fetchAsBase64 = async url => {
                const timeoutMs = getRemainingTimeout(imageDeadline, 8000);
                if (timeoutMs === 0) return '';
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const response = await fetch(url, { mode: 'cors', signal: controller.signal });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const blob = await response.blob();
                    return await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
                        reader.onerror = () => reject(reader.error || new Error('圖片讀取失敗'));
                        reader.readAsDataURL(blob);
                    });
                } catch (error) {
                    console.warn('PDF 圖片略過:', url, error);
                    return '';
                } finally {
                    clearTimeout(timeoutId);
                }
            };

            const convertedImages = await mapWithConcurrency(
                uniqueImageUrls,
                fetchAsBase64,
                6,
                (completed, total) => {
                    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 載入圖片 ${completed}/${total}`;
                }
            );
            const convertedByUrl = new Map(uniqueImageUrls.map((url, index) => [url, convertedImages[index]]));
            exportData.forEach(row => {
                row.renderUrls = row.imgUrls.map(url => convertedByUrl.get(url)).filter(Boolean);
            });

            // 3. 動態生成符合品牌視覺的隱藏 DOM 物件
            btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 排版輸出中...';
            const container = document.createElement('div');
            container.style.padding = '35px 25px';
            container.style.fontFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif";
            container.style.color = '#44403c';
            container.style.backgroundColor = '#ffffff';

            const dateStr = new Date().toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            const columnWidths = includeLocationColumn
                ? { image: 16, date: 11, category: 10, item: 24, spec: 11, location: 14, price: 8, qty: 6 }
                : { image: 18, date: 12, category: 12, item: 28, spec: 12, location: 0, price: 10, qty: 8 };
            const locationHeaderHtml = includeLocationColumn
                ? `<th style="padding: 8px 5px; border-bottom: 2px solid #d6d3d1; width: ${columnWidths.location}%; line-height: 1.35; vertical-align: middle;">目前位置</th>`
                : '';

            let html = `
                <div class="pdf-report-header" style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #78716c; padding-bottom: 15px; page-break-inside: avoid; break-inside: avoid;">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #1c1917;">WEIWEIWEI 庫存清單</h2>
                    <div style="margin-top: 12px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 8px 16px; font-size: 12px; line-height: 1.45; color: #78716c; text-align: left;">
                        <span style="flex: 1 1 360px; min-width: 0; overflow-wrap: anywhere; word-break: break-word;">📍 篩選: <b style="color: #1c1917;">${escapeHtml(garmentIdSearch ? `Garment ID · ${garmentIdSearch}` : `${displayLoc} · ${displayCat} · ${displayStyle}`)}</b></span>
                        <span style="white-space: nowrap;">📦 總計件數: <b style="color: #b45309; font-size: 14px;">${totalQty} 件</b></span>
                        <span style="white-space: nowrap;">🕒 盤點時間: ${dateStr}</span>
                    </div>
                </div>
                <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11px; line-height: 1.45; text-align: left;">
                    <thead style="display: table-header-group;">
                        <tr style="background-color: #f5f5f4; color: #78716c;">
                            <th style="padding: 8px 5px; border-bottom: 2px solid #d6d3d1; width: ${columnWidths.image}%; line-height: 1.35; vertical-align: middle; text-align: center;">商品圖</th>
                            <th style="padding: 8px 5px; border-bottom: 2px solid #d6d3d1; width: ${columnWidths.date}%; line-height: 1.35; vertical-align: middle;">入庫日期</th>
                            <th style="padding: 8px 5px; border-bottom: 2px solid #d6d3d1; width: ${columnWidths.category}%; line-height: 1.35; vertical-align: middle;">類別</th>
                            <th style="padding: 8px 5px; border-bottom: 2px solid #d6d3d1; width: ${columnWidths.item}%; line-height: 1.35; vertical-align: middle;">品名項目 (Item Name)</th>
                            <th style="padding: 8px 5px; border-bottom: 2px solid #d6d3d1; width: ${columnWidths.spec}%; line-height: 1.35; vertical-align: middle;">規格</th>
                            ${locationHeaderHtml}
                            <th style="padding: 8px 5px; border-bottom: 2px solid #d6d3d1; width: ${columnWidths.price}%; line-height: 1.35; vertical-align: middle; text-align: right;">主定價</th>
                            <th style="padding: 8px 5px; border-bottom: 2px solid #d6d3d1; width: ${columnWidths.qty}%; line-height: 1.35; vertical-align: middle; text-align: center;">數量</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            exportData.forEach((row, idx) => {
                const rowBg = idx % 2 === 0 ? '#ffffff' : '#fafaf9';
                const locationCellHtml = includeLocationColumn
                    ? `<td style="padding: 8px 5px; color: #57534e; vertical-align: middle; font-size: 10px; line-height: 1.45; overflow-wrap: anywhere; word-break: break-word;">${row.currentLocations.map(entry => `<div>${escapeHtml(entry.label)}${entry.count > 1 ? ` ×${entry.count}` : ''}</div>`).join('')}</td>`
                    : '';
                
                // 多張照片的排版邏輯
                let imgHtml = '';
                if (row.renderUrls && row.renderUrls.length > 0) {
                    const imgTags = row.renderUrls.map(url => 
                        `<img src="${escapeHtml(safeImageUrl(url))}" style="width: 34px; height: 46px; object-fit: cover; border-radius: 3px; border: 1px solid #e7e5e4; flex-shrink: 0;">`
                    ).join('');
                    imgHtml = `<div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; align-items: center;">${imgTags}</div>`;
                } else {
                    imgHtml = `<div style="width: 34px; height: 46px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 3px; font-size: 8px; color: #a8a29e; display: flex; align-items: center; justify-content: center; margin: 0 auto; line-height: 46px;">無圖</div>`;
                }

                html += `
                    <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e7e5e4; page-break-inside: avoid; break-inside: avoid;">
                        <td style="padding: 8px 5px; vertical-align: middle;">${imgHtml}</td>
                        <td style="padding: 8px 5px; color: #78716c; vertical-align: middle; font-family: monospace; font-size: 10px; line-height: 1.45; white-space: nowrap;">${escapeHtml(row.dateStr)}</td>
                        <td style="padding: 8px 5px; color: #78716c; vertical-align: middle; line-height: 1.45; overflow-wrap: anywhere; word-break: break-word;">${escapeHtml(row.category)}</td>
                        <td style="padding: 8px 5px; font-weight: 700; color: #1c1917; vertical-align: middle; line-height: 1.45; overflow-wrap: anywhere; word-break: break-word;">${escapeHtml(row.itemName)}<div style="margin-top: 3px; font-family: monospace; font-size: 9px; line-height: 1.45; font-weight: 500; color: #78716c; overflow-wrap: anywhere; word-break: break-word;">${escapeHtml(row.garmentIds.join(', '))}</div></td>
                        <td style="padding: 8px 5px; color: #57534e; vertical-align: middle; line-height: 1.45; overflow-wrap: anywhere; word-break: break-word;">
                            <div style="line-height: 1.45;">${escapeHtml(row.color)}</div>
                            <div style="margin-top: 2px; line-height: 1.45; font-size: 10px; color: #78716c;">Size: ${escapeHtml(row.size)}</div>
                        </td>
                        ${locationCellHtml}
                        <td style="padding: 8px 5px; text-align: right; color: #44403c; vertical-align: middle; line-height: 1.45; white-space: nowrap;">${escapeHtml(row.price)}</td>
                        <td style="padding: 8px 5px; text-align: center; font-weight: 800; font-size: 13px; line-height: 1.45; color: #1c1917; vertical-align: middle; white-space: nowrap;">${row.qty}</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
                <div class="pdf-footer" style="margin-top: 40px; text-align: center; font-size: 9px; color: #a8a29e; border-top: 1px dashed #e7e5e4; padding-top: 10px; page-break-inside: avoid; break-inside: avoid;">
                    © WEIWEIWEI Studio ERP Inventory System
                </div>
            `;
            container.innerHTML = html;

            // 4. 調用 html2pdf 套件進行客戶端高畫質渲染下載
            const opt = {
                margin:       12,
                filename:     `Stock_Report_${garmentIdSearch || `${displayLoc.replace(/\s+/g, '_')}_${displayCat.replace(/\s+/g, '_')}_${selectedStyleSku || 'ALL'}`}_${new Date().toISOString().slice(0,10)}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                pagebreak:    { mode: ['css', 'legacy'], avoid: ['tr', '.pdf-report-header', '.pdf-footer'] },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: includeLocationColumn ? 'landscape' : 'portrait' }
            };

            html2pdf().set(opt).from(container).save().then(() => {
                resetExportButton(btn);
            }).catch(err => {
                alert('PDF 導出失敗: ' + err.message);
                resetExportButton(btn);
            });
        };

        function resetExportButton(btn) {
            btn.innerHTML = '<i data-lucide="file-output" class="w-4 h-4"></i> 匯出此地點當下庫存 PDF';
            btn.disabled = false;
            lucide.createIcons();
        }
