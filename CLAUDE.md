# 老大教學字典

把群組老大的教學（產業、技術、心態等）依時間軸整理成靜態網站，部署在 GitHub Pages。純 HTML/CSS/JS，沒有建置步驟。

## 修改紀錄（必做）
每次修改專案都要在 `log.txt` **最後面附加**一筆紀錄，不要改動舊紀錄：
```
[YYYY-MM-DD HH:MM] [類別] 一句話摘要
    細節（選填，每行縮排 4 格）
```
- 類別：`介面`、`工具`、`部署`，由你手動附加（時間用 `date "+%Y-%m-%d %H:%M"` 取得）。
- `內容`、`標籤` 類別由 `scripts/add.js`、`scripts/tags.js` 自動寫入，不用重複記錄。
- 一次對話中的多個相關修改，合併成一筆紀錄。
- 附加紀錄時不要 Read 整個 log.txt；用 Bash 的 `>>` 附加即可。

## 省 token 規則
- 不要 Read `data/entries.js`、`data/weeks.js`（會越來越大）。新增內容用 `scripts/add.js`；需要查看資料時用 `add.js show/context/find`。
- 建立 inbox 素材資料夾：使用 `create-folder` skill（`scripts/inbox.js`）。新增教學內容：使用 `organize-inbox` skill。標籤管理：使用 `manage-tags` skill。

## 檔案
- `index.html`、`assets/app.js`、`assets/style.css`（Tactile 風格）、`assets/style-classic.css`（舊版樣式備份）
- `manifest.json`、`favicon.ico`、`assets/icons/` 加入主畫面用的 App 設定與圖示（圖示為果凍風「師」字）
- `data/entries.js` 每日內容、`data/weeks.js` 週總結、`data/tags.js` 標籤登記表
- `scripts/add.js` 新增內容、`scripts/tags.js` 標籤管理、`scripts/lib.js` 兩者共用、`scripts/inbox.js` 建立 inbox 資料夾
- `inbox/` 原始素材（不上傳 GitHub）、`prompts/weekly-summary.md` 給網頁版 Claude 的週總結提示詞

## 注意
- 不要自動 commit 或 push，先問使用者。
- 週總結目前暫停，使用者要求才產生（介面在沒有週總結時自動隱藏週次欄與日/週切換）。
- 改完 JS 後跑 `node --check`；介面修改後用 headless Edge 截圖確認（桌機 1280px、手機 375px）。
