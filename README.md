Weiweiwei Brand ERP System (v11.3)
專為 Upcycling（升級再造）與 Remake 服裝品牌設計的輕量級 ERP 系統。

不同於傳統成衣業以 SKU 數量為主的管理邏輯，本系統核心採用 「單品管理 (Unique Piece Tracking)」 架構。針對每一件由不同布料拼接、獨一無二的服裝進行全生命週期管理——從生產排程、照片建檔到多通路庫存分配。

✨ 主要功能 (Key Features)
1. 📊 總覽儀表板 (Dashboard & Analytics)
視覺化數據：即時顯示「製作中」、「在庫」、「未分配」與「已售出」的關鍵指標 (KPI)。

生產結構分析：透過堆疊長條圖 (Stacked Bar Chart) 分析每個月的品項生產比例 (e.g., Dress vs Top)。

庫存去向佔比：圓餅圖顯示庫存目前分佈於工作室、官網或是寄賣點。

2. 🧵 生產排程管理 (Production)
可視化進度：涵蓋 Pending -> Making -> QC -> Ready 完整流程。

Reel View (滑動預覽)：針對同一款版型但不同花色的商品，提供水平滑動的照片預覽列。

精確日期追蹤：記錄每一張工單的「開始製作日」與「完成日」。

彈性補圖：支援工單建立後，隨時追加上傳成品照片。

3. 📦 庫存與去向 (Inventory Allocation)
單品視覺化：以照片為單位的庫存檢視，所見即所得。

多通路管理 (Multi-Location)：支援單件商品同時上架多個通路 (例如：同時在 Online 與 Pop-up store)。

未分配提醒：自動標示尚未歸庫的商品為 None (未分配)，避免庫存遺漏。

售出標記：一鍵標記 SOLD，並保留售出紀錄供分析。

4. 👥 權限分流 (Role-Based View)
Admin View：擁有完整權限，包含數據分析與系統設定 (新增類別、地點、製作人)。

Maker View：專注於生產列表，介面簡潔，方便製作人查看工單。

🛠 技術架構 (Tech Stack)
本專案採用 Serverless (無伺服器) 架構，無須維護後端主機，直接透過瀏覽器運行。

Frontend: HTML5, Vanilla JavaScript (ES Modules)

Styling: Tailwind CSS (CDN)

Icons: Lucide Icons

Charts: Chart.js

Backend & Database: Google Firebase

Firestore: 即時資料庫 (NoSQL)

Storage: 儲存服裝照片

Authentication: 匿名登入驗證

🚀 快速開始 (Setup & Installation)
由於使用了 ES Modules 與 Firebase，請勿直接雙擊 .html 檔案開啟，需透過本機伺服器運行。

1. 取得專案
Bash

git clone https://github.com/your-username/weiweiwei-erp.git
cd weiweiwei-erp
2. 設定 Firebase
前往 Firebase Console 建立新專案。

啟用 Firestore Database (設定規則為測試模式或自行設定讀寫權限)。

啟用 Storage (用於儲存圖片)。

啟用 Authentication (開啟 Anonymous 匿名登入)。

複製您的 Web App 設定檔 (包含 apiKey, projectId 等)。

3. 更新設定
打開 index.html (或您的主檔名)，找到以下區塊並替換為您的 Firebase 設定：

JavaScript

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
4. 啟動專案
推薦使用 VS Code 的 Live Server 插件：

在 VS Code 安裝 Live Server。

在 HTML 檔案上按右鍵 -> Open with Live Server。

系統將自動在瀏覽器開啟。

📖 使用指南 (Workflow)
建立工單 (Create)
點擊「生產排程」頁面的 + 新增工單。

填寫品名、類別、製作人。

關鍵步驟：若布料已確定，可直接上傳多張布料/半成品照片；若無，可先輸入數量建立空單。

生產回報 (Update)
製作人完成後，點擊工單的 鉛筆 (Edit) 按鈕。

更新狀態為 Ready。

若先前未上傳照片，在此步驟使用 追加照片 功能上傳成品圖。

庫存分配 (Allocate)
進入「庫存管理」頁面。

點擊照片打開詳情卡片。

勾選商品所在位置 (如 Studio, Online)。

若商品售出，點擊 標記為已售出 (SOLD)。

📝 授權 (License)
Copyright © 2025 Weiweiwei. 本系統為品牌內部管理工具，未經授權請勿商業轉載。

💡 開發者筆記 (Dev Notes)
目前版本：v11.3 (Stable)

已解決 v11.2 中補上傳照片導致庫存數量重複計算的 Bug。

未來規劃：加入 QR Code 掃描入庫功能、財務報表匯出。
