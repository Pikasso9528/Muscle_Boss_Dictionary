---
name: manage-tags
description: 新增、移除、改名老大教學字典的主題標籤或個股標籤，並依內容自動補上個股標籤。當使用者說「新增主題」「刪除標籤」「加個股」「移除個股」「主題改名」「改顏色」「自動標個股」「整理標籤」等，或剛寫入新內容到 data/entries.js 之後使用。
---

# 管理主題與個股標籤

## 檔案
- `data/tags.js`：標籤登記表（主題與顏色、個股代號/名稱/別名）。網站從這裡讀主題順序與顏色。
- `data/entries.js`：每日內容，包含群組教學 `group`、語音直播 `live`、週末複習 `review`、MSBK 圖文教學 `msbk`。每則都有 `tags`（主題）與 `stocks`（個股，格式固定為「代號 名稱」，如 `2330 台積電`）。
- `data/weeks.js`：週總結，每週一筆，也有 `tags` 與 `stocks`。腳本的所有指令都會一併處理日資料與週總結。
- `scripts/tags.js`：所有操作都透過它執行，它會同步修改這些檔案。**不要手動逐筆改 entries.js 的標籤，也不要 Read `entries.js`／`weeks.js`**（檔案會越來越大，浪費 token）。要看某天內容，用 `node scripts/add.js show <日期>`；要找某個詞出現在哪些天，用 `node scripts/add.js find <關鍵字>`。

## 指令（在專案根目錄執行）
```
node scripts/tags.js list                                  # 現況與使用次數，先跑這個
node scripts/tags.js scan                                  # 預覽自動個股標籤
node scripts/tags.js apply                                 # 套用自動個股標籤
node scripts/tags.js add-topic <名稱> [#顏色]
node scripts/tags.js remove-topic <名稱> [--remap <主題>]
node scripts/tags.js rename-topic <舊> <新>
node scripts/tags.js topic-color <名稱> <#rrggbb>
node scripts/tags.js add-stock <代號> <名稱> [別名...]     # 已存在則補別名
node scripts/tags.js remove-stock <代號|名稱> [--keep-entries]
node scripts/tags.js remove-alias <代號|名稱> <別名>
```

## 流程
1. 先執行 `list` 看現況。
2. **會刪除或改動既有內容的操作**（`remove-topic`、`remove-stock`、`rename-topic`）：先用 `list` 的數字告訴使用者會影響幾則，並問清楚：
   - 移除主題：內容裡的這個標籤是要直接刪掉，還是改標成另一個主題（`--remap`）？
   - 移除個股：要連內容中的標籤一起刪（預設），還是只從登記表移除（`--keep-entries`）？
   使用者確認後才執行。新增、改顏色、補別名可直接做。
3. 新增個股時：
   - 代號要正確。不確定時先問使用者，不要猜。
   - 別名只放**專指這檔股票**的叫法，例如「台積」「TSMC」「發哥」。不要放產業或題材詞（如「AI 伺服器」「散熱」），否則所有提到該題材的內容都會被誤標。
   - 新增後執行 `scan`，把建議列給使用者看，確認後再 `apply`。
4. 自動個股標籤：
   - 每次有新內容寫進 `data/entries.js`（例如整理 inbox 之後），都要執行 `scan`，再 `apply`。
   - `scan` 會列出「內容使用但未登記」的個股。對於內容中提到、但還沒登記的個股，先用 `add-stock` 登記，再重新 `scan`。
   - 自動判斷依據是名稱、別名或代號出現在標題、摘要、重點或引言中。只是附帶提到、不是討論重點的個股，可以跟使用者確認是否要保留。
5. 完成後執行 `node --check data/entries.js && node --check data/tags.js` 確認語法正確，再告訴使用者重新整理網頁查看。不要自動 commit 或 push。

## 顏色
主題顏色填一個鮮明的主色（#rrggbb）即可。網站會自動產生淺色和深色模式的文字色與底色。沒指定顏色時，會從調色盤挑一個還沒用過的。
