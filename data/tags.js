// 標籤登記表：由 scripts/tags.js 維護（也可手動編輯）
// topics：主題標籤，順序即頂部篩選按鈕順序；color 為主色，深淺版本自動產生
// stocks：個股登記，內容提到 code / name / aliases 任一個就自動加上「代號 名稱」標籤
window.TAG_CONFIG = {
  topics: [
    { name: "產業", color: "#3ccf91" },
    { name: "技術", color: "#4fb3e0" },
    { name: "心態", color: "#ff7eb8" },
    { name: "個股", color: "#ff9a5a" },
    { name: "大盤總經", color: "#e6c229" },
    { name: "操作紀錄", color: "#9a7cff" }
  ],
  stocks: [
    { code: "2330", name: "台積電", aliases: ["台積", "TSMC"] },
    { code: "2454", name: "聯發科", aliases: ["發哥", "MTK"] },
    { code: "3017", name: "奇鋐", aliases: [] },
    { code: "3324", name: "雙鴻", aliases: [] },
    { code: "2382", name: "廣達", aliases: [] },
    { code: "3231", name: "緯創", aliases: [] },
    { code: "3131", name: "弘塑", aliases: [] },
    { code: "6187", name: "萬潤", aliases: [] },
    { code: "3105", name: "穩懋", aliases: [] },
    { code: "2383", name: "台光電", aliases: ["台光"] },
    { code: "1303", name: "南亞", aliases: [] },
    { code: "6672", name: "騰輝電子-KY", aliases: ["騰輝", "騰輝-KY"] },
    { code: "2408", name: "南亞科", aliases: [] },
    { code: "2308", name: "台達電", aliases: ["台達"] },
    { code: "2301", name: "光寶科", aliases: ["光寶"] },
    { code: "2345", name: "智邦", aliases: [] },
    { code: "6669", name: "緯穎", aliases: [] }
  ]
};
