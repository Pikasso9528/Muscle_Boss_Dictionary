---
name: create-folder
description: 在老大教學字典的 inbox/ 建立素材資料夾（日期、直播 live、複習 review、MSBK 圖文教學 msbk、週總結 week）。當使用者說「建資料夾」「create-folder」「準備放素材」「開一個 10/23 的直播資料夾」時使用。
---

# 建立 inbox 資料夾

1. 把使用者的話轉成參數：
   - 日期：`YYYY-MM-DD`、`M/D`（今年）或 `today`；沒說就省略（= 今天）。
   - 類型：群組 = `group`（預設）、直播 = `live`、複習 = `review`、MSBK 圖文教學 = `msbk`、週總結 = `week`，可多個。
2. 執行 `node scripts/inbox.js new <日期> <類型...>`。不要用其他方式建資料夾。
3. 把輸出的路徑回報給使用者，提醒放好素材後說「整理 inbox」。

不要讀 `data/` 下的任何檔案。
