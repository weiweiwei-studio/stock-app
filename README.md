<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>服裝品牌庫存管理系統 (Stock Planner - v7.0 Pro Studio)</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>

    <!-- CSS Styling -->
    <style>
        body { font-family: 'Noto Sans TC', sans-serif; background-color: #fafaf9; color: #44403c; }
        .chart-container { position: relative; width: 100%; max-width: 600px; margin: 0 auto; height: 300px; max-height: 400px; }
        @media (min-width: 768px) { .chart-container { height: 350px; } }
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f5f5f4; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 4px; }
        .nav-active { background-color: #e7e5e4; color: #1c1917; font-weight: 700; }
        .loader { border: 3px solid #f3f3f3; border-top: 3px solid #44403c; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        /* Photo Grid Styles */
        .photo-stack { position: relative; width: 40px; height: 40px; }
        .photo-stack img { position: absolute; width: 100%; height: 100%; border-radius: 6px; object-fit: cover; border: 1px solid #e7e5e4; transition: transform 0.2s; }
        .photo-stack img:first-child { z-index: 10; }
        .photo-stack img:nth-child(2) { z-index: 5; transform: rotate(6deg); left: 2px; }
        .photo-badge { position: absolute; bottom: -5px; right: -5px; background: #1c1917; color: white; font-size: 9px; padding: 1px 4px; border-radius: 10px; z-index: 20; font-weight: bold; }
        
        /* Urgency Indicators */
        .urgent-warning { color: #dc2626; font-weight: 700; }
        .urgent-critical { background-color: #fca5a5; color: #7f1d1d; padding: 2px 4px; border-radius: 4px; }
    </style>
</head>
<body class="flex flex-col min-h-screen">

    <!-- Navigation Bar -->
    <nav class="bg-white border-b border-stone-200 shadow-sm sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center gap-4">
                    <div class="flex-shrink-0 flex items-center">
                        <span class="text-2xl font-bold tracking-tight text-stone-800">BRAND<span class="text-stone-400">.ERP</span></span>
                        <span id="connection-status" class="ml-2 px-2 py-0.5 rounded text-[10px] bg-stone-100 text-stone-400">Connecting...</span>
                    </div>
                    <!-- Desktop Nav -->
                    <div class="hidden sm:ml-6 sm:flex sm:space-x-4">
                        <button onclick="window.switchView('dashboard')" id="nav-dashboard" class="nav-item px-3 py-2 rounded-md text-sm font-medium hover:bg-stone-100 transition-colors nav-active">總覽儀表板</button>
                        <button onclick="window.switchView('production')" id="nav-production" class="nav-item px-3 py-2 rounded-md text-sm font-medium hover:bg-stone-100 transition-colors text-stone-500">生產排程</button>
                        <button onclick="window.switchView('allocation')" id="nav-allocation" class="nav-item px-3 py-2 rounded-md text-sm font-medium hover:bg-stone-100 transition-colors text-stone-500">庫存與去向</button>
                        <!-- Settings Button: Only visible for Admin -->
                        <button onclick="window.switchView('settings')" id="nav-settings" class="nav-item px-3 py-2 rounded-md text-sm font-medium hover:bg-stone-100 transition-colors text-stone-500 hidden flex items-center gap-1 border border-stone-200 bg-stone-50">
                            <i data-lucide="settings" class="w-4 h-4"></i> 設定
                        </button>
                    </div>
                </div>
                
                <!-- Role Switcher -->
                <div class="flex items-center">
                    <label for="role-select" class="mr-2 text-sm font-medium text-stone-500 hidden sm:block">視角:</label>
                    <select id="role-select" onchange="window.updateRole()" class="block w-full pl-3 pr-10 py-2 text-base border-stone-300 focus:outline-none focus:ring-stone-500 focus:border-stone-500 sm:text-sm rounded-md bg-stone-100">
                        <option value="admin" selected>Admin (Rie/Raina)</option>
                        <option value="maker_kim">Maker (Kim)</option>
                        <option value="maker_kelly">Maker (Kelly)</option>
                        <option value="logistics">Logistics (庫存管理)</option>
                    </select>
                </div>
            </div>
        </div>
        <!-- Mobile Nav Menu -->
        <div class="sm:hidden bg-white border-t border-stone-200 flex justify-around p-2">
             <button onclick="window.switchView('dashboard')" class="text-xs font-medium p-2 text-stone-600">總覽</button>
             <button onclick="window.switchView('production')" class="text-xs font-medium p-2 text-stone-600">生產</button>
             <button onclick="window.switchView('allocation')" class="text-xs font-medium p-2 text-stone-600">庫存</button>
             <button onclick="window.switchView('settings')" id="mobile-nav-settings" class="text-xs font-medium p-2 text-stone-600 hidden">設定</button>
        </div>
    </nav>

    <!-- Main Content Area -->
    <main class="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <!-- VIEW: DASHBOARD -->
        <section id="view-dashboard" class="space-y-8 animate-fade-in">
            <div class="bg-white rounded-lg p-6 shadow-sm border border-stone-100">
                <h2 class="text-xl font-bold text-stone-800 mb-2">營運概況總覽</h2>
                <p class="text-stone-500 text-sm">數據即時同步。Admin 可在右上角「⚙️ 設定」頁面管理下拉選單選項。</p>
            </div>

            <!-- KPI Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-white p-6 rounded-lg shadow-sm border-l-4 border-stone-800">
                    <div class="text-stone-500 text-xs font-bold uppercase tracking-wider">本月目標</div>
                    <div class="mt-2 text-3xl font-bold text-stone-800" id="kpi-total">0</div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-sm border-l-4 border-amber-500">
                    <div class="text-amber-600 text-xs font-bold uppercase tracking-wider">製作中</div>
                    <div class="mt-2 text-3xl font-bold text-stone-800" id="kpi-making">0</div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
                    <div class="text-purple-600 text-xs font-bold uppercase tracking-wider">QC 檢驗中</div>
                    <div class="mt-2 text-3xl font-bold text-stone-800" id="kpi-qc">0</div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-sm border-l-4 border-emerald-500">
                    <div class="text-emerald-600 text-xs font-bold uppercase tracking-wider">在庫 (Ready)</div>
                    <div class="mt-2 text-3xl font-bold text-stone-800" id="kpi-studio">0</div>
                </div>
            </div>

            <!-- Charts Section -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="bg-white p-6 rounded-lg shadow-sm">
                    <h3 class="text-lg font-bold text-stone-800 mb-4">生產進度</h3>
                    <div class="chart-container"><canvas id="productionChart"></canvas></div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-sm">
                    <h3 class="text-lg font-bold text-stone-800 mb-4">庫存去向</h3>
                    <div class="chart-container"><canvas id="allocationChart"></canvas></div>
                </div>
            </div>
        </section>

        <!-- VIEW: PRODUCTION PLANNER -->
        <section id="view-production" class="space-y-6 hidden">
            <div class="bg-white rounded-lg p-6 shadow-sm border-l-4 border-amber-500">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-bold text-stone-800">生產排程表</h2>
                        <p class="text-stone-500 text-sm mt-1">追蹤製作進度、Deadline 與品質檢驗 (QC)。</p>
                    </div>
                    <button onclick="window.openModal()" class="bg-stone-800 hover:bg-stone-700 text-white px-4 py-2 rounded-md text-sm shadow-md flex items-center gap-2">
                        <span>&#43;</span> 新增工單
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="flex flex-wrap gap-4 bg-white p-4 rounded-lg shadow-sm">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-stone-600">製作人:</span>
                    <select id="prod-filter-maker" onchange="window.renderProductionList()" class="bg-stone-50 border border-stone-200 text-sm rounded-md p-1.5 dynamic-maker-select">
                        <option value="all">全部</option>
                        <!-- Populated dynamically -->
                    </select>
                </div>
            </div>

            <!-- Production Table -->
            <div class="bg-white rounded-lg shadow-sm overflow-hidden border border-stone-200">
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="min-w-full text-left text-sm">
                        <thead class="bg-stone-100 text-stone-600 uppercase font-semibold">
                            <tr>
                                <th class="px-6 py-3">Month</th>
                                <th class="px-6 py-3 w-32">Photos</th>
                                <th class="px-6 py-3">Category</th>
                                <th class="px-6 py-3">Item (SKU)</th> <!-- Renamed to Item (SKU) -->
                                <th class="px-6 py-3">Qty</th>
                                <th class="px-6 py-3">Maker</th>
                                <th class="px-6 py-3">Status</th>
                                <th class="px-6 py-3">Timeline & Due</th> <!-- Updated -->
                                <th class="px-6 py-3">Notes</th>
                                <th class="px-6 py-3 w-10">Edit</th>
                            </tr>
                        </thead>
                        <tbody id="production-table-body" class="divide-y divide-stone-100"></tbody>
                    </table>
                    <div id="loading-indicator" class="p-8 text-center text-stone-400 hidden">載入中...</div>
                </div>
            </div>
        </section>

        <!-- VIEW: ALLOCATION -->
        <section id="view-allocation" class="space-y-6 hidden">
            <div class="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-bold text-stone-800">庫存與去向</h2>
                        <p class="text-stone-500 text-sm mt-1">管理成品去向與記錄移動時間。</p>
                    </div>
                </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4" id="alloc-stats-container">
                <!-- Dynamically populated stats -->
            </div>

            <!-- Allocation Table -->
             <div class="bg-white rounded-lg shadow-sm overflow-hidden border border-stone-200">
                <div class="p-4 border-b border-stone-100 bg-stone-50"><h3 class="font-bold text-stone-700">待分配項目 (Ready / In Studio)</h3></div>
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="min-w-full text-left text-sm">
                        <thead class="bg-stone-100 text-stone-600 uppercase font-semibold">
                            <tr>
                                <th class="px-6 py-3 w-32">Photos</th>
                                <th class="px-6 py-3">Item (SKU)</th>
                                <th class="px-6 py-3">Category</th>
                                <th class="px-6 py-3">Location</th>
                                <th class="px-6 py-3">Moved Date</th>
                                <th class="px-6 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody id="allocation-table-body" class="divide-y divide-stone-100"></tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- VIEW: SETTINGS -->
        <section id="view-settings" class="space-y-6 hidden">
            <div class="bg-white rounded-lg p-6 shadow-sm border border-stone-200">
                <h2 class="text-xl font-bold text-stone-800 mb-2">系統設定 (Admin Only)</h2>
                <p class="text-stone-500 text-sm">在此管理下拉選單的選項。輸入新項目後點擊「+」新增，點擊「x」刪除。</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <!-- Makers Settings -->
                <div class="bg-white p-6 rounded-lg shadow-sm border border-stone-100">
                    <h3 class="font-bold text-stone-700 mb-4 flex items-center gap-2"><i data-lucide="scissors" class="w-4 h-4"></i> 製作人 (Makers)</h3>
                    <div id="settings-makers-list" class="flex flex-wrap gap-2 mb-4"></div>
                    <div class="flex gap-2">
                        <input type="text" id="new-maker-input" placeholder="新增製作人..." class="flex-1 border text-sm rounded px-2 py-1">
                        <button onclick="window.addSetting('makers')" class="bg-stone-800 text-white px-3 py-1 rounded text-sm hover:bg-stone-700 font-bold w-8">+</button>
                    </div>
                </div>

                <!-- Categories Settings -->
                <div class="bg-white p-6 rounded-lg shadow-sm border border-stone-100">
                    <h3 class="font-bold text-stone-700 mb-4 flex items-center gap-2"><i data-lucide="tag" class="w-4 h-4"></i> 款式類別 (Categories)</h3>
                    <div id="settings-categories-list" class="flex flex-wrap gap-2 mb-4"></div>
                    <div class="flex gap-2">
                        <input type="text" id="new-category-input" placeholder="新增類別..." class="flex-1 border text-sm rounded px-2 py-1">
                        <button onclick="window.addSetting('categories')" class="bg-stone-800 text-white px-3 py-1 rounded text-sm hover:bg-stone-700 font-bold w-8">+</button>
                    </div>
                </div>

                <!-- Locations Settings -->
                <div class="bg-white p-6 rounded-lg shadow-sm border border-stone-100">
                    <h3 class="font-bold text-stone-700 mb-4 flex items-center gap-2"><i data-lucide="map-pin" class="w-4 h-4"></i> 去向/Stockist (Locations)</h3>
                    <div id="settings-locations-list" class="flex flex-wrap gap-2 mb-4"></div>
                    <div class="flex gap-2">
                        <input type="text" id="new-location-input" placeholder="新增地點..." class="flex-1 border text-sm rounded px-2 py-1">
                        <button onclick="window.addSetting('locations')" class="bg-stone-800 text-white px-3 py-1 rounded text-sm hover:bg-stone-700 font-bold w-8">+</button>
                    </div>
                </div>
            </div>
        </section>

    </main>

    <!-- Modal for Adding New Item (Updated with Color/Size/Deadline) -->
    <div id="add-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in-up overflow-y-auto max-h-[90vh]">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-stone-800">新增生產工單 (SKU)</h3>
                <button onclick="window.closeModal()" class="text-stone-400 hover:text-stone-600">&times;</button>
            </div>
            <form id="add-item-form" onsubmit="window.handleAddItem(event)" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">月份</label>
                        <input type="text" name="month" id="form-month-input" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">截單日 (Deadline)</label>
                        <input type="date" name="deadline" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium text-stone-500 mb-1">品名 (Item Name)</label>
                    <input type="text" name="itemName" required placeholder="e.g. Linen Sleeveless Top" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border">
                </div>
                <!-- SKU Details -->
                <div class="grid grid-cols-3 gap-2">
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">類別</label>
                        <select name="category" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border bg-white dynamic-category-select"></select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">顏色</label>
                        <input type="text" name="color" placeholder="White" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">尺寸</label>
                        <select name="size" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border bg-white">
                            <option value="F">F</option>
                            <option value="S">S</option>
                            <option value="M">M</option>
                            <option value="L">L</option>
                            <option value="XL">XL</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">數量</label>
                        <input type="number" name="quantity" value="1" min="1" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">指定製作人</label>
                        <select name="maker" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border bg-white dynamic-maker-select">
                            <!-- Dynamic -->
                        </select>
                    </div>
                </div>
                <div>
                     <label class="block text-xs font-medium text-stone-500 mb-1">照片 (可多選)</label>
                     <input type="file" name="initialPhotos" accept="image/*" multiple class="block w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200">
                </div>
                <div>
                    <label class="block text-xs font-medium text-stone-500 mb-1">備註</label>
                    <textarea name="notes" rows="2" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border"></textarea>
                </div>
                <div class="pt-4 flex justify-end gap-2">
                    <button type="button" onclick="window.closeModal()" class="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-md">取消</button>
                    <button type="submit" id="btn-submit" class="px-4 py-2 text-sm bg-stone-800 text-white hover:bg-stone-700 rounded-md flex items-center justify-center min-w-[100px]">確認新增</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal for Editing Item (Updated) -->
    <div id="edit-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in-up overflow-y-auto max-h-[90vh]">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-stone-800">編輯工單內容</h3>
                <button onclick="window.closeEditModal()" class="text-stone-400 hover:text-stone-600">&times;</button>
            </div>
            <form id="edit-item-form" onsubmit="window.handleEditSubmit(event)" class="space-y-4">
                <input type="hidden" name="id" id="edit-id">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">月份</label>
                        <input type="text" name="month" id="edit-month" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">類別</label>
                        <select name="category" id="edit-category" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border bg-white dynamic-category-select">
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium text-stone-500 mb-1">品名</label>
                    <input type="text" name="itemName" id="edit-itemName" required class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border">
                </div>
                <!-- SKU Details Edit -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">顏色</label>
                        <input type="text" name="color" id="edit-color" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">尺寸</label>
                        <select name="size" id="edit-size" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border bg-white">
                            <option value="F">F</option>
                            <option value="S">S</option>
                            <option value="M">M</option>
                            <option value="L">L</option>
                            <option value="XL">XL</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">數量</label>
                        <input type="number" name="quantity" id="edit-quantity" min="1" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">指定製作人</label>
                        <select name="maker" id="edit-maker" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border bg-white dynamic-maker-select">
                        </select>
                    </div>
                </div>
                <!-- Date Overrides -->
                <div class="bg-stone-50 p-3 rounded border border-stone-100 space-y-2">
                    <div class="flex justify-between items-center">
                        <label class="text-xs font-bold text-stone-600">截單日 (Deadline)</label>
                        <input type="date" name="deadline" id="edit-deadline" class="border-stone-200 rounded text-xs p-1 border">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] text-stone-500">Start Date</label>
                            <input type="date" name="customStartDate" id="edit-startDate" class="w-full border-stone-200 rounded text-xs p-1 border">
                        </div>
                        <div>
                            <label class="block text-[10px] text-stone-500">Done Date</label>
                            <input type="date" name="customEndDate" id="edit-endDate" class="w-full border-stone-200 rounded text-xs p-1 border">
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-medium text-stone-500 mb-1">備註</label>
                    <textarea name="notes" id="edit-notes" rows="2" class="w-full border-stone-300 rounded-md shadow-sm text-sm p-2 border"></textarea>
                </div>
                
                <div class="pt-4 flex justify-between items-center">
                    <button type="button" onclick="window.handleDelete()" class="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
                        <i data-lucide="trash-2" class="w-3 h-3"></i> 刪除工單
                    </button>
                    <div class="flex gap-2">
                        <button type="button" onclick="window.closeEditModal()" class="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-md">取消</button>
                        <button type="submit" class="px-4 py-2 text-sm bg-stone-800 text-white hover:bg-stone-700 rounded-md">儲存變更</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- Gallery Modal (New) -->
    <div id="gallery-modal" class="fixed inset-0 bg-black bg-opacity-95 hidden z-[70] flex flex-col items-center justify-center p-4">
        <button onclick="window.closeGallery()" class="absolute top-4 right-4 text-white text-3xl hover:text-stone-300">&times;</button>
        <div class="w-full max-w-4xl h-[80vh] flex items-center justify-center relative">
             <img id="gallery-main-img" src="" class="max-w-full max-h-full object-contain">
             <!-- Navigation Arrows -->
             <button onclick="window.prevImage()" class="absolute left-0 p-4 text-white text-4xl hover:bg-black/20 rounded-r-lg" id="gallery-prev">&lt;</button>
             <button onclick="window.nextImage()" class="absolute right-0 p-4 text-white text-4xl hover:bg-black/20 rounded-l-lg" id="gallery-next">&gt;</button>
        </div>
        <div id="gallery-counter" class="text-white text-sm mt-4 font-mono">1 / 1</div>
    </div>

    <!-- Firebase & App Logic -->
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

        // Your Config
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

        // --- GLOBAL STATE ---
        let db = []; 
        let currentRole = 'admin';
        let prodChartInstance = null;
        let allocChartInstance = null;
        
        // Gallery State
        let currentGalleryImages = [];
        let currentGalleryIndex = 0;

        let appSettings = {
            makers: ['Kim', 'Kelly', 'Lijin', 'Aiwen', 'SewingRoom'],
            categories: ['Dress', 'Top', 'Pants', 'Outerwear', 'Accessory'],
            locations: ['Studio', 'Online Store', 'Bev C', 'Pop-Up']
        };

        // --- AUTH & LISTENERS ---
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('loading-indicator').classList.remove('hidden');
            document.getElementById('form-month-input').value = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
            lucide.createIcons();

            signInAnonymously(auth).catch((error) => console.error("Auth Error", error));

            onAuthStateChanged(auth, (user) => {
                if (user) {
                    document.getElementById('connection-status').innerText = "Connected";
                    document.getElementById('connection-status').className = "ml-2 px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-600";
                    startSettingsListener(); 
                    startDataListener();     
                }
            });
            initCharts();
            window.updateRole(); 
        });

        // 1. Settings Listener (Config)
        function startSettingsListener() {
            const settingsDocRef = doc(dbFirestore, "settings", "config");
            onSnapshot(settingsDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    appSettings = docSnap.data();
                } else {
                    setDoc(settingsDocRef, appSettings);
                }
                updateDropdowns();
                renderSettingsView();
                renderProductionList();
                renderAllocationList();
            });
        }

        // 2. Data Listener (Items)
        function startDataListener() {
            const q = query(collection(dbFirestore, "stock_items"), orderBy("createdAt", "desc"));
            onSnapshot(q, (snapshot) => {
                db = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                document.getElementById('loading-indicator').classList.add('hidden');
                updateDashboard();
                renderProductionList();
                renderAllocationList();
            });
        }

        function updateDropdowns() {
            const makerSelects = document.querySelectorAll('.dynamic-maker-select');
            makerSelects.forEach(select => {
                const currentVal = select.value;
                let html = select.id === 'prod-filter-maker' ? '<option value="all">全部</option>' : '';
                appSettings.makers.forEach(m => html += `<option value="${m}">${m}</option>`);
                select.innerHTML = html;
                if(currentVal && appSettings.makers.includes(currentVal)) select.value = currentVal;
            });

            const catSelects = document.querySelectorAll('.dynamic-category-select');
            catSelects.forEach(select => {
                const currentVal = select.value;
                let html = '';
                appSettings.categories.forEach(c => html += `<option value="${c}">${c}</option>`);
                select.innerHTML = html;
                if(currentVal && appSettings.categories.includes(currentVal)) select.value = currentVal;
            });
        }

        // --- RENDER HELPERS ---
        // Helper: Date Formatter
        function formatDate(timestamp) {
            if (!timestamp) return '-';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return (date.getMonth() + 1) + '/' + date.getDate();
        }

        // Helper: Date to YYYY-MM-DD for Input
        function timestampToInput(timestamp) {
            if (!timestamp) return '';
            let date;
            if (typeof timestamp === 'string') date = new Date(timestamp); // Handle ISO strings
            else date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            
            if(isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0];
        }

        // Helper: Check Urgent
        function getDeadlineStatus(deadlineStr) {
            if(!deadlineStr) return '';
            const today = new Date();
            const due = new Date(deadlineStr);
            const diffTime = due - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays < 0) return 'urgent-critical'; // Overdue
            if (diffDays <= 3) return 'urgent-warning'; // Warning
            return '';
        }

        // Helper: Render Photo Cell
        function renderPhotoCell(item) {
            let images = [];
            if (item.photos && Array.isArray(item.photos)) {
                images = item.photos;
            } else if (item.photo) {
                images = [item.photo];
            }

            if (images.length === 0) {
                 if (currentRole === 'admin' || currentRole.startsWith('maker')) {
                    // Upload Button
                    return `
                        <label class="w-10 h-10 bg-white border border-dashed border-stone-300 rounded-md flex items-center justify-center cursor-pointer hover:bg-stone-50 text-stone-400 hover:text-stone-600 transition-colors relative" title="上傳照片">
                            <i data-lucide="camera" class="w-4 h-4"></i>
                            <div class="hidden absolute inset-0 bg-white/80 items-center justify-center" id="loader-${item.id}"><div class="loader !w-3 !h-3"></div></div>
                            <input type="file" class="hidden" accept="image/*" multiple onchange="window.handlePhotoUpload('${item.id}', this)">
                        </label>
                    `;
                 }
                 return `<div class="w-10 h-10 bg-stone-100 rounded-md flex items-center justify-center text-xs text-stone-300">無</div>`;
            }

            const imgStr = JSON.stringify(images).replace(/"/g, '&quot;');
            
            let uploadInput = '';
            if (currentRole === 'admin' || currentRole.startsWith('maker')) {
                uploadInput = `<label class="absolute -top-2 -right-2 bg-stone-800 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-stone-600 z-30 shadow-sm" title="加傳照片">
                    <span class="text-xs">+</span>
                    <input type="file" class="hidden" accept="image/*" multiple onchange="window.handlePhotoUpload('${item.id}', this)">
                </label>`;
            }

            let stackHTML = '';
            if (images.length === 1) {
                stackHTML = `<img src="${images[0]}" class="cursor-zoom-in" onclick="window.openGallery(${imgStr}, 0)">`;
            } else {
                stackHTML = `
                    <img src="${images[0]}" class="cursor-zoom-in" onclick="window.openGallery(${imgStr}, 0)">
                    <img src="${images[1]}" class="cursor-zoom-in" onclick="window.openGallery(${imgStr}, 1)">
                    <div class="photo-badge">+${images.length - 1}</div>
                `;
            }

            return `<div class="photo-stack relative group">${stackHTML} ${uploadInput} <div class="hidden absolute inset-0 bg-white/80 items-center justify-center z-40" id="loader-${item.id}"><div class="loader !w-3 !h-3"></div></div></div>`;
        }


        // --- MAIN RENDER LOGIC ---

        window.renderProductionList = function() {
            const tbody = document.getElementById('production-table-body');
            const makerFilter = document.getElementById('prod-filter-maker').value;

            tbody.innerHTML = '';
            let filteredData = db;
            
            if (currentRole.startsWith('maker')) {
                const makerName = currentRole.split('_')[1];
                const makerNameCap = makerName.charAt(0).toUpperCase() + makerName.slice(1);
                filteredData = filteredData.filter(i => i.maker === makerNameCap);
            } else if (makerFilter !== 'all') {
                filteredData = filteredData.filter(i => i.maker === makerFilter);
            }

            if(filteredData.length === 0) {
                 tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-4 text-center text-stone-400 text-sm">暫無資料</td></tr>`;
                 return;
            }

            filteredData.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-stone-50 transition-colors border-b border-stone-50';
                
                let statusColor = 'bg-gray-100 text-gray-600';
                if(item.status === 'Making') statusColor = 'bg-amber-100 text-amber-700 font-bold';
                if(item.status === 'QC') statusColor = 'bg-purple-100 text-purple-700 font-bold'; // New QC Status
                if(item.status === 'Ready') statusColor = 'bg-emerald-100 text-emerald-700 font-bold';
                if(item.status === 'To Make') statusColor = 'bg-red-50 text-red-600';

                const photoHTML = renderPhotoCell(item);

                let actionHTML = `<span class="px-2 py-1 rounded-full text-xs ${statusColor}">${item.status}</span>`;
                if (currentRole === 'admin' || currentRole.startsWith('maker')) {
                     actionHTML = `
                        <select onchange="window.handleStatusChange('${item.id}', this.value)" class="text-xs border-stone-200 rounded p-1 bg-white focus:ring-amber-500 cursor-pointer ${statusColor.split(' ')[0]}">
                            <option value="Pending" ${item.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="To Make" ${item.status === 'To Make' ? 'selected' : ''}>To Make</option>
                            <option value="Making" ${item.status === 'Making' ? 'selected' : ''}>Making</option>
                            <option value="QC" ${item.status === 'QC' ? 'selected' : ''}>QC</option>
                            <option value="Ready" ${item.status === 'Ready' ? 'selected' : ''}>Ready</option>
                        </select>
                     `;
                }

                // Timeline & Deadline
                let datesHTML = '';
                let startDate = item.makingAt ? formatDate(item.makingAt) : (item.createdAt ? formatDate(item.createdAt) : '-');
                let doneDate = item.completedAt ? formatDate(item.completedAt) : '-';
                
                // Deadline Alert
                let deadlineHTML = '';
                if(item.deadline) {
                    const urgencyClass = getDeadlineStatus(item.deadline);
                    const formattedDeadline = new Date(item.deadline).toLocaleDateString('en-US', {month: 'numeric', day: 'numeric'});
                    deadlineHTML = `<div class="mt-1 text-[10px] ${urgencyClass} flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> Due: ${formattedDeadline}</div>`;
                }

                datesHTML = `<div class="text-[10px] text-stone-400">Start: ${startDate}</div>`;
                if(item.status === 'Ready') datesHTML += `<div class="text-[10px] text-emerald-600 font-bold">Done: ${doneDate}</div>`;
                datesHTML += deadlineHTML;

                // Edit Button
                const itemStr = JSON.stringify(item).replace(/"/g, '&quot;');
                const editBtn = `<button onclick="window.openEditModal(${itemStr})" class="p-1 text-stone-400 hover:text-stone-700"><i data-lucide="pencil" class="w-4 h-4"></i></button>`;

                // Item Name + SKU
                const itemInfo = `
                    <div class="font-medium text-stone-800">${item.itemName}</div>
                    <div class="flex gap-2 text-xs text-stone-500 mt-0.5">
                        <span class="bg-stone-100 px-1 rounded border">${item.color || '-'}</span>
                        <span class="bg-stone-100 px-1 rounded border">${item.size || '-'}</span>
                    </div>
                `;

                tr.innerHTML = `
                    <td class="px-6 py-4 font-mono text-xs text-stone-500">${item.month}</td>
                    <td class="px-6 py-4">${photoHTML}</td>
                    <td class="px-6 py-4 text-xs text-stone-500">${item.category}</td>
                    <td class="px-6 py-4">${itemInfo}</td>
                    <td class="px-6 py-4">${item.quantity}</td>
                    <td class="px-6 py-4"><span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-800">${item.maker}</span></td>
                    <td class="px-6 py-4">${actionHTML}</td>
                    <td class="px-6 py-4">${datesHTML}</td>
                    <td class="px-6 py-4 text-stone-400 text-xs truncate max-w-[150px]">${item.notes}</td>
                    <td class="px-6 py-4 text-center">${editBtn}</td>
                `;
                tbody.appendChild(tr);
            });
            lucide.createIcons();
        };

        window.renderAllocationList = function() {
            const tbody = document.getElementById('allocation-table-body');
            const statsContainer = document.getElementById('alloc-stats-container');
            tbody.innerHTML = '';
            
            // Stats
            let stats = `<div class="bg-stone-800 text-white p-4 rounded-lg flex justify-between items-center"><div><div class="text-xs text-stone-400 uppercase">Studio</div><div class="text-2xl font-bold">${db.filter(i => i.allocation === 'Studio' && (i.status === 'Ready' || i.status === 'In Studio')).length}</div></div><div class="text-2xl">🏠</div></div>`;
            const onlineCount = db.filter(i => i.allocation === 'Online Store').length;
            stats += `<div class="bg-blue-600 text-white p-4 rounded-lg flex justify-between items-center"><div><div class="text-xs text-blue-200 uppercase">Online</div><div class="text-2xl font-bold">${onlineCount}</div></div><div class="text-2xl">🛒</div></div>`;
            statsContainer.innerHTML = stats;

            const readyItems = db.filter(i => i.status === 'Ready' || i.status === 'In Studio');

            if(readyItems.length === 0) {
                 tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-stone-400 text-sm">無待分配項目</td></tr>`;
                 return;
            }

            readyItems.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-stone-50 transition-colors';
                
                let allocColor = 'bg-stone-100 text-stone-600';
                if (item.allocation === 'Online Store') allocColor = 'bg-blue-50 text-blue-600';
                if (item.allocation !== 'Studio' && item.allocation !== 'Online Store') allocColor = 'bg-indigo-50 text-indigo-600';

                const photoHTML = renderPhotoCell(item);

                let actionHTML = `<span class="px-2 py-1 rounded text-xs ${allocColor}">${item.allocation}</span>`;
                if (currentRole === 'admin' || currentRole === 'logistics') {
                    let optionsHTML = '';
                    appSettings.locations.forEach(loc => {
                        optionsHTML += `<option value="${loc}" ${item.allocation === loc ? 'selected' : ''}>${loc}</option>`;
                    });

                    actionHTML = `
                        <select onchange="window.handleAllocChange('${item.id}', this.value)" class="text-xs border-stone-200 rounded p-1 bg-white focus:ring-blue-500 cursor-pointer font-medium text-stone-700 max-w-[120px]">
                            ${optionsHTML}
                        </select>
                    `;
                }

                // Item Name + SKU
                const itemInfo = `
                    <div class="font-medium text-stone-800">${item.itemName}</div>
                    <div class="flex gap-2 text-xs text-stone-500 mt-0.5">
                        <span class="bg-stone-100 px-1 rounded border">${item.color || '-'}</span>
                        <span class="bg-stone-100 px-1 rounded border">${item.size || '-'}</span>
                    </div>
                `;

                // Move Date
                let moveDateHTML = item.allocatedAt ? `<span class="text-xs text-stone-500 font-mono">${formatDate(item.allocatedAt)}</span>` : `<span class="text-xs text-stone-300">-</span>`;

                tr.innerHTML = `
                    <td class="px-6 py-4">${photoHTML}</td>
                    <td class="px-6 py-4">${itemInfo}</td>
                    <td class="px-6 py-4 text-xs text-stone-500">${item.category}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 rounded-full text-xs border ${allocColor}">${item.allocation}</span></td>
                    <td class="px-6 py-4">${moveDateHTML}</td>
                    <td class="px-6 py-4">${actionHTML}</td>
                `;
                tbody.appendChild(tr);
            });
            lucide.createIcons();
        };

        // --- DATABASE ACTIONS ---

        window.handleAddItem = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btn-submit');
            btn.innerHTML = `<div class="loader !w-4 !h-4 border-white border-t-transparent"></div>`;
            btn.disabled = true;
            
            const formData = new FormData(e.target);
            const fileInput = document.querySelector('input[name="initialPhotos"]');
            
            let photoUrls = [];

            try {
                if (fileInput && fileInput.files.length > 0) {
                    for(let i=0; i<fileInput.files.length; i++) {
                        const file = fileInput.files[i];
                        const storageRef = ref(storage, 'photos/' + new Date().getTime() + '_' + file.name);
                        const snapshot = await uploadBytes(storageRef, file);
                        const url = await getDownloadURL(snapshot.ref);
                        photoUrls.push(url);
                    }
                }
                
                await addDoc(collection(dbFirestore, "stock_items"), {
                    month: formData.get('month'),
                    category: formData.get('category'),
                    itemName: formData.get('itemName'),
                    color: formData.get('color'),
                    size: formData.get('size'),
                    deadline: formData.get('deadline'), // New Field
                    quantity: parseInt(formData.get('quantity')),
                    maker: formData.get('maker'),
                    status: 'To Make',
                    allocation: 'Studio',
                    photos: photoUrls, 
                    notes: formData.get('notes'),
                    createdAt: serverTimestamp()
                });
                window.closeModal();
                e.target.reset();
            } catch (error) { alert("新增失敗: " + error.message); } 
            finally { btn.innerHTML = "確認新增"; btn.disabled = false; }
        };

        window.handleStatusChange = async function(id, newStatus) {
            try {
                const docRef = doc(dbFirestore, "stock_items", id);
                let updateData = { status: newStatus };
                
                if (newStatus === 'Making') {
                    updateData.makingAt = serverTimestamp();
                } else if (newStatus === 'Ready') {
                    updateData.completedAt = serverTimestamp();
                    updateData.allocation = 'Studio'; 
                }

                await updateDoc(docRef, updateData);
            } catch (e) { console.error(e); }
        };

        window.handleAllocChange = async function(id, newAlloc) {
            try { 
                await updateDoc(doc(dbFirestore, "stock_items", id), { 
                    allocation: newAlloc,
                    allocatedAt: serverTimestamp()
                }); 
            } catch (e) { console.error(e); }
        };

        window.handlePhotoUpload = async function(id, input) {
            if (input.files && input.files.length > 0) {
                const loader = document.getElementById(`loader-${id}`);
                if(loader) { loader.classList.remove('hidden'); loader.classList.add('flex'); }
                try {
                    const currentDoc = db.find(i => i.id === id);
                    let existingPhotos = [];
                    if (currentDoc.photos && Array.isArray(currentDoc.photos)) existingPhotos = currentDoc.photos;
                    else if (currentDoc.photo) existingPhotos = [currentDoc.photo];

                    for(let i=0; i<input.files.length; i++) {
                        const file = input.files[i];
                        const storageRef = ref(storage, 'photos/' + new Date().getTime() + '_' + file.name);
                        const snapshot = await uploadBytes(storageRef, file);
                        const url = await getDownloadURL(snapshot.ref);
                        existingPhotos.push(url);
                    }
                    
                    await updateDoc(doc(dbFirestore, "stock_items", id), { photos: existingPhotos });
                } catch (error) { alert("上傳失敗"); } 
                finally { if(loader) loader.classList.add('hidden'); }
            }
        };

        // --- EDIT MODAL LOGIC ---
        window.openEditModal = function(item) {
            document.getElementById('edit-id').value = item.id;
            document.getElementById('edit-month').value = item.month || '';
            document.getElementById('edit-itemName').value = item.itemName || '';
            document.getElementById('edit-color').value = item.color || ''; // New
            document.getElementById('edit-size').value = item.size || 'F'; // New
            document.getElementById('edit-deadline').value = item.deadline || ''; // New
            document.getElementById('edit-quantity').value = item.quantity || 1;
            document.getElementById('edit-notes').value = item.notes || '';
            
            // Populate Dropdowns
            const catSelect = document.getElementById('edit-category');
            catSelect.innerHTML = '';
            appSettings.categories.forEach(c => {
                catSelect.innerHTML += `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`;
            });

            const makerSelect = document.getElementById('edit-maker');
            makerSelect.innerHTML = '';
            appSettings.makers.forEach(m => {
                makerSelect.innerHTML += `<option value="${m}" ${item.maker === m ? 'selected' : ''}>${m}</option>`;
            });

            // Date Inputs
            document.getElementById('edit-startDate').value = timestampToInput(item.makingAt || item.createdAt);
            document.getElementById('edit-endDate').value = timestampToInput(item.completedAt);

            document.getElementById('edit-modal').classList.remove('hidden');
        };

        window.closeEditModal = function() {
            document.getElementById('edit-modal').classList.add('hidden');
        };

        window.handleEditSubmit = async function(e) {
            e.preventDefault();
            const id = document.getElementById('edit-id').value;
            const data = {
                month: document.getElementById('edit-month').value,
                category: document.getElementById('edit-category').value,
                itemName: document.getElementById('edit-itemName').value,
                color: document.getElementById('edit-color').value,
                size: document.getElementById('edit-size').value,
                deadline: document.getElementById('edit-deadline').value,
                quantity: parseInt(document.getElementById('edit-quantity').value),
                maker: document.getElementById('edit-maker').value,
                notes: document.getElementById('edit-notes').value,
            };

            const startDateVal = document.getElementById('edit-startDate').value;
            const endDateVal = document.getElementById('edit-endDate').value;

            if (startDateVal) data.makingAt = new Date(startDateVal);
            if (endDateVal) data.completedAt = new Date(endDateVal);

            try {
                await updateDoc(doc(dbFirestore, "stock_items", id), data);
                window.closeEditModal();
            } catch(e) { alert("更新失敗"); }
        };

        window.handleDelete = async function() {
            const id = document.getElementById('edit-id').value;
            if (confirm("確定要刪除此工單嗎？此操作無法復原。")) {
                try {
                    await deleteDoc(doc(dbFirestore, "stock_items", id));
                    window.closeEditModal();
                } catch(e) { alert("刪除失敗"); }
            }
        };

        // Gallery Logic
        window.openGallery = function(imgs, idx) {
            currentGalleryImages = imgs;
            currentGalleryIndex = idx;
            document.getElementById('gallery-modal').classList.remove('hidden');
            updateGalleryImage();
        };

        window.closeGallery = function() {
            document.getElementById('gallery-modal').classList.add('hidden');
        };

        window.nextImage = function() {
            currentGalleryIndex = (currentGalleryIndex + 1) % currentGalleryImages.length;
            updateGalleryImage();
        };

        window.prevImage = function() {
            currentGalleryIndex = (currentGalleryIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
            updateGalleryImage();
        };

        function updateGalleryImage() {
            const img = document.getElementById('gallery-main-img');
            img.src = currentGalleryImages[currentGalleryIndex];
            
            document.getElementById('gallery-counter').innerText = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
            
            const showArrows = currentGalleryImages.length > 1;
            document.getElementById('gallery-prev').style.display = showArrows ? 'block' : 'none';
            document.getElementById('gallery-next').style.display = showArrows ? 'block' : 'none';
        }

        // Settings Logic
        window.renderSettingsView = function() {
            const renderChips = (list, type) => {
                return list.map(item => `
                    <div class="bg-stone-100 border border-stone-200 rounded px-2 py-1 text-sm flex items-center gap-2">
                        <span>${item}</span>
                        <button onclick="window.removeSetting('${type}', '${item}')" class="text-stone-400 hover:text-red-500 font-bold">&times;</button>
                    </div>
                `).join('');
            };

            document.getElementById('settings-makers-list').innerHTML = renderChips(appSettings.makers, 'makers');
            document.getElementById('settings-categories-list').innerHTML = renderChips(appSettings.categories, 'categories');
            document.getElementById('settings-locations-list').innerHTML = renderChips(appSettings.locations, 'locations');
        };

        window.addSetting = async function(type) {
            const idMap = {'makers': 'new-maker-input', 'categories': 'new-category-input', 'locations': 'new-location-input'};
            const input = document.getElementById(idMap[type]);
            const val = input.value.trim();
            if(!val) return;
            const newArr = [...appSettings[type], val];
            await updateDoc(doc(dbFirestore, "settings", "config"), { [type]: newArr });
            input.value = '';
        };

        window.removeSetting = async function(type, val) {
            if(!confirm(`確定要刪除 "${val}" 嗎?`)) return;
            const newArr = appSettings[type].filter(i => i !== val);
            await updateDoc(doc(dbFirestore, "settings", "config"), { [type]: newArr });
        };


        // Navigation
        window.switchView = function(viewName) {
            document.querySelectorAll('section[id^="view-"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('nav-active', 'text-stone-900');
                el.classList.add('text-stone-500');
            });
            document.getElementById(`view-${viewName}`).classList.remove('hidden');
            const activeNav = document.getElementById(`nav-${viewName}`);
            if(activeNav) {
                activeNav.classList.add('nav-active', 'text-stone-900');
                activeNav.classList.remove('text-stone-500');
            }
            if(viewName === 'dashboard') updateDashboard();
        };

        window.updateRole = function() {
            currentRole = document.getElementById('role-select').value;
            const settingsBtn = document.getElementById('nav-settings');
            const mobileSettingsBtn = document.getElementById('mobile-nav-settings');
            
            if (currentRole === 'admin') {
                settingsBtn.classList.remove('hidden');
                settingsBtn.classList.add('flex');
                mobileSettingsBtn.classList.remove('hidden');
            } else {
                settingsBtn.classList.add('hidden');
                settingsBtn.classList.remove('flex');
                mobileSettingsBtn.classList.add('hidden');
                if(!document.getElementById('view-settings').classList.contains('hidden')) {
                    window.switchView('dashboard'); 
                }
            }

            if (currentRole.startsWith('maker')) window.switchView('production');
            else if (currentRole === 'logistics') window.switchView('allocation');
            else if (currentRole === 'admin' && !document.getElementById('view-settings').classList.contains('hidden')) {} 
            else if(document.querySelectorAll('.nav-active').length === 0) window.switchView('dashboard');
            
            renderProductionList();
            renderAllocationList(); 
        };

        // Dashboard
        function updateDashboard() {
            const total = db.length;
            const making = db.filter(i => i.status === 'Making').length;
            const qc = db.filter(i => i.status === 'QC').length; // Count QC
            const studio = db.filter(i => i.allocation === 'Studio' && (i.status === 'Ready' || i.status === 'In Studio')).length;
            const listed = db.filter(i => i.allocation !== 'Studio' && i.status !== 'Pending' && i.status !== 'To Make' && i.status !== 'Making' && i.status !== 'QC').length;

            document.getElementById('kpi-total').textContent = total;
            document.getElementById('kpi-making').textContent = making;
            document.getElementById('kpi-qc').textContent = qc;
            document.getElementById('kpi-studio').textContent = studio;
            updateCharts();
        }

        function initCharts() {
            prodChartInstance = new Chart(document.getElementById('productionChart'), {
                type: 'bar',
                data: { labels: ['Pending', 'To Make', 'Making', 'QC', 'Ready'], datasets: [{ label: 'Cnt', data: [0,0,0,0,0], backgroundColor: ['#e5e7eb', '#fca5a5', '#fbbf24', '#e9d5ff', '#34d399'] }] },
                options: { plugins: { legend: { display: false } }, scales: { y: { display: false } } }
            });
            allocChartInstance = new Chart(document.getElementById('allocationChart'), {
                type: 'doughnut',
                data: { labels: ['Studio', 'Online', 'Stockist'], datasets: [{ data: [0,0,0], backgroundColor: ['#78716c', '#3b82f6', '#6366f1'] }] },
                options: { cutout: '70%', plugins: { legend: { position: 'bottom' } } }
            });
        }

        function updateCharts() {
            const s = i => i.status; const a = i => i.allocation;
            prodChartInstance.data.datasets[0].data = ['Pending', 'To Make', 'Making', 'QC', 'Ready'].map(st => db.filter(i => (st==='Ready'?(s(i)==='Ready'||s(i)==='In Studio'):s(i)===st)).length);
            prodChartInstance.update();
            allocChartInstance.data.datasets[0].data = ['Studio', 'Online Store', 'Stockist'].map(lc => db.filter(i => (lc==='Stockist'?(a(i)!=='Studio'&&a(i)!=='Online Store'):a(i)===lc)).length);
            allocChartInstance.update();
        }
        
        window.openModal = function() { document.getElementById('add-modal').classList.remove('hidden'); };
        window.closeModal = function() { document.getElementById('add-modal').classList.add('hidden'); };
    </script>
</body>
</html>
