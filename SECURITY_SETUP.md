# Admin 登入與 Firebase 安全設定

唯一允許登入的帳號是 `heyweiweiweimy@gmail.com`。Rie 與 Raina 共用這個帳號；密碼只在 Firebase Console 建立與管理，不應提交到 GitHub。

## 上線順序

1. 在 Firebase Console 開啟 **Authentication → Sign-in method → Email/Password**。
2. 在 **Authentication → Users → Add user** 建立 `heyweiweiweimy@gmail.com`，並設定一組強密碼。
3. 合併此 PR，等待 GitHub Pages 更新後，確認能登入網站且資料正常顯示。
4. 登入 Firebase CLI 後，在專案目錄執行：

   ```bash
   npx firebase-tools deploy --only firestore:rules,storage
   ```

5. 登出再登入一次，確認資料讀取、修改及圖片上傳都正常。

## 回復方式

如果第 3 步登入失敗，先回復 GitHub Pages 到合併前版本；此時不要部署規則。如果第 5 步失敗，可在 Firebase Console 的 Firestore Database 與 Storage Rules 頁面回復上一個 rules 版本。
