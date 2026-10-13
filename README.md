# 📦 補貨大作戰：今天補哪個？

一個免費、免登入、能在手機或電腦上玩的庫存補貨小遊戲。

## [遊戲頁面連結](https://tim32142000.github.io/inventory-replenishment-pages/)

> 每天只能選 **一種商品補貨 10 件**。每天的需求都是隨機的，庫存不夠就會錯過銷售機會。你能撐過挑戰嗎？

## 🎮 玩法

1. 選擇 3～8 種商品、7／14／21／30 天的挑戰。
2. 每種商品一開始有 5 件庫存，每日需求有不同且公開的範圍。
3. 每天開店前只能挑一種商品，立刻補貨 10 件。
4. 補完貨後，揭曉當天所有商品的需求、賣出與少賣數。
5. 繼續隔天，最後以 **需求滿足率 = 賣出數量 ÷ 總需求** 計分。
6. 結算時與兩個不偷看需求的電腦店長比較；可重玩相同局號或產生新的一局。

補貨不會有運輸等待，缺貨損失不留到隔天。當日需求在開局時就決定，但玩家補貨前看不到結果；因此「重玩同一局」可以公平比較不同選法。

<!--

## 🚀 只用 GitHub 網站部署（不需要安裝任何套件）

1.  `index.html` 必須在 Repository 最外層。
2. 進入 Repository 的 `Settings` → `Pages`。
3. `Build and deployment` 的 `Source` 選 **Deploy from a branch**。
4. `Branch` 選 **main**，資料夾選 **/(root)**，按 **Save**。
5. 等待部署完成後，點 `Visit site`，就能玩了。

預設遊戲網址形式：

`https://你的帳號.github.io/restock-game/`

通常幾分鐘內可完成部署，官方表示變更可能需要最多約 10 分鐘才能發布。

官方文件：[GitHub Pages：Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

-->

## 📂 上傳的內容

```text
index.html          網頁入口（一定要在根目錄）
styles.css          畫面與手機版排版
app.js              按鈕、每日操作、結果和儲存
game-logic.mjs     隨機需求、補貨規則與電腦策略
favicon.svg         網站小圖示
.nojekyll           告訴 GitHub Pages 不需要 Jekyll 處理
README.md           這份說明
test/game.test.mjs 規則自動測試（部署不需要執行）
```

檔案是原生 HTML/CSS/JavaScript，GitHub Pages 可以直接部署。

> 本機若要預覽，請使用像 VS Code Live Server 這類簡單的靜態網頁伺服器；直接雙擊 `index.html` 可能因為瀏覽器對 JavaScript 模組的本機檔案安全限制而無法啟動。上傳 GitHub Pages 後則不需要額外設定。

## 🔖 進度與分享

- 挑戰進度與同難度的最高分使用瀏覽器 `localStorage` 保存；清除瀏覽器資料或換裝置，紀錄就不會跟著過去。
- 網址的 `?n=5&days=14&seed=...` 可重現同一組需求，方便朋友挑戰同一關。
- 分享的是**需求序列**，不是你的操作或遊玩進度。每個玩家各自進貨。
- 遊戲完全在瀏覽器運作；沒有雲端排行榜。

## ✅ 開發測試

有 Node.js 時，根目錄執行：

```bash
node --test test/game.test.mjs
```

測試涵蓋補貨一次、需求範圍、庫存守恆、少賣、終局、隨機種子、電腦對照與存檔復原。

## 🎯 遊戲設計原則

**先好玩、再考慮新功能。** 目前刻意保留簡單規則，不加入進貨成本、營收、員工、人力管理等內容。未來如果要新增內容，應優先考慮是否更有趣、更值得重玩。
