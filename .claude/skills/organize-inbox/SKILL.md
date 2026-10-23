---
name: organize-inbox
description: 把 inbox/ 裡的群組截圖、.txt、直播、週末複習與週總結素材整理成老大教學字典的內容（data/entries.js、data/weeks.js）。當使用者說「整理 inbox」「新增內容」「上傳了截圖」「補登某天」「整理週總結」「產生週總結」時使用。
---

# 整理 inbox

## 最重要的原則：不讀過往資料
**不要 Read `data/entries.js` 或 `data/weeks.js`**，那是會越來越大的檔案。需要過往資料時只用以下指令，它們只輸出精簡結果：
- `node scripts/add.js show <日期>`：某天現況（要合併前確認）
- `node scripts/add.js context <該週任一日期>`：一週的每日內容（產生週總結用）
- `node scripts/add.js find <關鍵字>`：哪些日期提過某主題（找複習的 refs 用）

主題清單請讀 `data/tags.js`（小檔），不用讀內容檔。

## inbox 結構
```
inbox/
  2026-10-23/            群組教學：截圖 *.png/*.jpg 或 *.txt
    live/                語音直播
    review/              週末複習
  weeks/
    2026-10-19.txt       網頁版 Claude 整理的週總結（檔名 = 週一日期）
  _done/                 已處理的素材（整理完移到這裡）
```
`_done/` 以外的資料夾都是待處理。用 `node scripts/inbox.js list` 列出待處理素材，**不要用 Glob 掃描 `inbox/**`**（會連 `_done/` 一起列出，越來越長）。
使用者有指定日期（例如「整理 inbox 10/18」）就只處理那天；沒指定就處理全部待處理素材。

## 流程
1. 列出待處理素材，告訴使用者這次會處理哪些日期／週。
2. 讀素材（截圖用 Read 直接看，.txt 直接讀）。
3. 每個日期資料夾寫一個 `inbox/<日期>/entry.json`；每個週總結寫 `inbox/weeks/<週一日期>.json`。格式見下方。
4. 執行 `node scripts/add.js add <json 檔...>`（可一次給多個）。逐行檢查輸出：
   - `⚠ 未登記主題`：改用既有主題，或問使用者要不要新增主題（manage-tags skill）。
   - `⚠ 未登記個股`：問使用者確認代號後，用 `node scripts/tags.js add-stock` 登記，再執行 `node scripts/tags.js scan`／`apply`。
   - `⚠ refs ... 沒有對應的日資料`：確認日期是否寫錯。
   - `～ 合併到既有的…`：輸出會列出當天全部內容的標題。若當天概要已不能涵蓋全部內容，用 `set-title` 更新。
5. 處理成功後，把素材資料夾（含 entry.json）移到 `inbox/_done/`，例如 `inbox/_done/2026-10-23/`、`inbox/_done/weeks/2026-10-19.*`。
6. `node --check data/entries.js && node --check data/weeks.js`。
7. 向使用者回報：新增／合併了哪些日期與週、自動標了哪些個股，以及有哪些需要他確認的地方。**不要自動 commit 或 push。**

## 內容撰寫規則
- 只整理老大的教學，略過其他成員閒聊、貼圖、無關訊息。
- 當天如果沒有值得記錄的教學，就不要建立那天，並告訴使用者已略過。
- `title`（當天概要）：綜合當天所有內容的一句話，20 字內，不是抄第一則的標題。
- 群組內容按主題拆成多則（`group` 陣列），每則一個重點概念。
- `summary`：1–2 句話。`points`：短句，每點 30 字內。
- `quote`：只放老大的原話，必須逐字照抄；沒有就省略。
- `tags`：只用 `data/tags.js` 裡的主題，可複選。
- `stocks`：格式為「代號 名稱」，例如 `2330 台積電`。內容提到的登記個股，腳本會自動補上。
- 直播（`live`）：截圖或 .txt 有時間就填 `time`（例如 `"21:00"`）。
- 複習（`review`）：先用 `find` 找出這次複習對應的原始教學日期，填進 `refs`。

## JSON 格式
日資料（`entry.json`）。新的一天必須有 `title`；合併到既有日期時，`title` 可省略（給了就會覆蓋）。同一天同類型裡，標題相同的那則會被更新而不是重複新增。
```json
{
  "date": "2026-10-23",
  "title": "當天一句話概要",
  "group":  [{ "title": "", "tags": [], "stocks": [], "summary": "", "points": [], "quote": "" }],
  "live":   [{ "title": "", "time": "21:00", "tags": [], "stocks": [], "summary": "", "points": [] }],
  "review": [{ "title": "", "refs": ["2026-10-14"], "tags": [], "stocks": [], "summary": "", "points": [] }]
}
```
週總結（`inbox/weeks/<週一>.json`）。`start` 必須是週一，`end` 可省略。同一週再新增會覆蓋。
```json
{
  "start": "2026-10-19",
  "title": "本週一句話主軸",
  "tags": [], "stocks": [],
  "summary": "2–3 句",
  "sections": [{ "heading": "技術", "points": ["..."] }],
  "quote": "老大原話（選填）"
}
```

## 週總結的兩種來源
- **網頁版 Claude 整理的 .txt**：使用者依 `prompts/weekly-summary.md` 的格式產生。直接把各欄位轉成上方 JSON。
- **使用者要求「產生第 N 週的週總結」**，或該週沒有 .txt：執行 `node scripts/add.js context <該週日期>`，根據輸出寫週總結。週總結只能根據這些內容撰寫，不要補入沒出現過的觀點。

## 修正與刪除
- 改某天概要：`node scripts/add.js set-title <日期> <新概要>`
- 移除某則：`node scripts/add.js remove-day <日期> <該則標題>`；移除整天：`remove-day <日期>`
- 移除週總結：`node scripts/add.js remove-week <週一日期>`

刪除前，先用 `show` 讓使用者確認要刪的內容。
