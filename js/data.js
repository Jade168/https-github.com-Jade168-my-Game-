// js/data.js — 星球、語言、AI 動物助手資料（由舊 characters.js 修復整理）
// 只放資料，不含遊戲邏輯。

export const LANGUAGES = {
  zh_HK: "繁體中文（粵語）",
  zh_CN: "簡體中文",
  en: "English",
  ja: "日本語",
  fr: "Français",
  es: "Español"
};

// 星球主題色 + 地表色，用於 3D 世界生成
export const PLANETS = [
  { id: "earth",      name: "英國星球",   language: "English",        locale: "en-GB", flag: "🇬🇧", sky: "#7fb8e6", ground: "#4c8a3f", accent: "#3b82f6", assistant: "lupus" },
  { id: "mars",       name: "日本星球",   language: "Japanese",       locale: "ja-JP", flag: "🇯🇵", sky: "#f6b6a8", ground: "#c56b52", accent: "#ef4444", assistant: "felis" },
  { id: "ocean",      name: "法國星球",   language: "French",         locale: "fr-FR", flag: "🇫🇷", sky: "#8fd0f0", ground: "#2f7fa8", accent: "#0ea5e9", assistant: "delphinus" },
  { id: "jungle",     name: "西班牙星球", language: "Spanish",        locale: "es-ES", flag: "🇪🇸", sky: "#a8d98a", ground: "#2f6b33", accent: "#16a34a", assistant: "simia" },
  { id: "planet05",   name: "德國星球",   language: "German",         locale: "de-DE", flag: "🇩🇪", sky: "#c7cbd1", ground: "#5b6470", accent: "#64748b", assistant: "ursus" },
  { id: "planet06",   name: "意大利星球", language: "Italian",        locale: "it-IT", flag: "🇮🇹", sky: "#ffd9a0", ground: "#b57b3a", accent: "#f59e0b", assistant: "vulpes" },
  { id: "planet07",   name: "俄羅斯星球", language: "Russian",        locale: "ru-RU", flag: "🇷🇺", sky: "#bcd3e8", ground: "#7d8fa6", accent: "#3b82f6", assistant: "maritimus" },
  { id: "planet08",   name: "韓國星球",   language: "Korean",         locale: "ko-KR", flag: "🇰🇷", sky: "#d8c2f0", ground: "#5f4b8b", accent: "#a855f7", assistant: "draco" },
  { id: "planet09",   name: "泰國星球",   language: "Thai",           locale: "th-TH", flag: "🇹🇭", sky: "#ffe0a8", ground: "#a8863a", accent: "#eab308", assistant: "camelus" },
  { id: "planet10",   name: "越南星球",   language: "Vietnamese",     locale: "vi-VN", flag: "🇻🇳", sky: "#a8e0c8", ground: "#2f7a55", accent: "#10b981", assistant: "crocodylus" },
  { id: "planet11",   name: "印度星球",   language: "Hindi",          locale: "hi-IN", flag: "🇮🇳", sky: "#ffd2a8", ground: "#b06a2f", accent: "#f97316", assistant: "aquila" },
  { id: "planet12",   name: "阿拉伯星球", language: "Arabic",         locale: "ar-SA", flag: "🇸🇦", sky: "#f0dfa8", ground: "#b39a4a", accent: "#d97706", assistant: "equus" },
  { id: "planet13",   name: "巴西星球",   language: "Portuguese",     locale: "pt-BR", flag: "🇧🇷", sky: "#a8e0b8", ground: "#2f8a45", accent: "#22c55e", assistant: "lepus" },
  { id: "planet14",   name: "墨西哥星球", language: "Spanish (MX)",   locale: "es-MX", flag: "🇲🇽", sky: "#ffc9a8", ground: "#a86a3a", accent: "#ea580c", assistant: "bison" },
  { id: "planet15",   name: "希臘星球",   language: "Greek",          locale: "el-GR", flag: "🇬🇷", sky: "#a8d8f0", ground: "#4a7fa8", accent: "#0ea5e9", assistant: "lynx" },
  { id: "planet16",   name: "土耳其星球", language: "Turkish",        locale: "tr-TR", flag: "🇹🇷", sky: "#e0b8c8", ground: "#8b4a5f", accent: "#e11d48", assistant: "ovis" },
  { id: "planet17",   name: "北歐星球",   language: "Swedish",        locale: "sv-SE", flag: "🇸🇪", sky: "#cfe4f5", ground: "#6b8fa8", accent: "#38bdf8", assistant: "alcedo" },
  { id: "planet18",   name: "澳洲星球",   language: "English (AU)",   locale: "en-AU", flag: "🇦🇺", sky: "#f0c8a8", ground: "#b06a3a", accent: "#f59e0b", assistant: "giraffa" },
  { id: "planet19",   name: "非洲星球",   language: "Swahili",        locale: "sw-KE", flag: "🇰🇪", sky: "#f5d9a8", ground: "#a8853a", accent: "#eab308", assistant: "phoenix" },
  { id: "planet20",   name: "中原星球",   language: "Cantonese",      locale: "zh-HK", flag: "🇭🇰", sky: "#f0a8b8", ground: "#8b3a4a", accent: "#ec4899", assistant: "orca" }
];

// 助手：外形參數餵入 characters3d.js 產生卡通 3D 動物
export const ASSISTANTS = {
  lupus:         { name: "Lupus",      species: "wolf",       kind: "quadruped", color: "#9aa7b8", color2: "#e6edf5", ears: "pointed", tail: "bushy",  emoji: "🐺", trait: "勇敢" },
  felis:         { name: "Felis",      species: "cat",        kind: "quadruped", color: "#f4a261", color2: "#fff3e0", ears: "pointed", tail: "thin",   emoji: "🐱", trait: "好奇" },
  delphinus:     { name: "Delphinus",  species: "dolphin",    kind: "aquatic",   color: "#5aa9e6", color2: "#e8f4ff", ears: "none",    tail: "fin",    emoji: "🐬", trait: "友善" },
  simia:         { name: "Simia",      species: "monkey",     kind: "biped",     color: "#a97c50", color2: "#f0dcc0", ears: "round",   tail: "thin",   emoji: "🐵", trait: "調皮" },
  ursus:         { name: "Ursus",      species: "bear",       kind: "quadruped", color: "#8b5a3c", color2: "#e0c4a8", ears: "round",   tail: "tiny",   emoji: "🐻", trait: "穩重" },
  vulpes:        { name: "Vulpes",     species: "fox",        kind: "quadruped", color: "#e07a3f", color2: "#ffe6d0", ears: "pointed", tail: "bushy",  emoji: "🦊", trait: "機智" },
  camelus:       { name: "Camelus",    species: "camel",      kind: "quadruped", color: "#d9a05b", color2: "#f5e6cc", ears: "small",   tail: "thin",   emoji: "🐪", trait: "堅毅" },
  aquila:        { name: "Aquila",     species: "eagle",      kind: "bird",      color: "#8d7b68", color2: "#f0e6d8", ears: "none",    tail: "fan",    emoji: "🦅", trait: "銳利" },
  lepus:         { name: "Lepus",      species: "rabbit",     kind: "quadruped", color: "#e8e0d0", color2: "#ffffff", ears: "long",    tail: "puff",   emoji: "🐰", trait: "敏捷" },
  equus:         { name: "Equus",      species: "horse",      kind: "quadruped", color: "#b08968", color2: "#f0dcc0", ears: "pointed", tail: "bushy",  emoji: "🐴", trait: "自由" },
  draco:         { name: "Draco",      species: "lizard",     kind: "dragon",    color: "#c0392b", color2: "#ffd76a", ears: "horn",    tail: "spiky",  emoji: "🐉", trait: "威嚴" },
  maritimus:     { name: "Maritimus",  species: "polar bear", kind: "quadruped", color: "#eaf2fa", color2: "#c9dcef", ears: "round",   tail: "tiny",   emoji: "🐻‍❄️", trait: "冷靜" },
  crocodylus:    { name: "Crocodylus", species: "crocodile",  kind: "reptile",   color: "#4e8b3c", color2: "#c8e0b0", ears: "none",    tail: "spiky",  emoji: "🐊", trait: "耐心" },
  giraffa:       { name: "Giraffa",    species: "giraffe",    kind: "quadruped", color: "#e0b060", color2: "#8b5a2b", ears: "small",   tail: "thin",   emoji: "🦒", trait: "高瞻" },
  phoenix:       { name: "Phoenix",    species: "peacock",    kind: "bird",      color: "#1f8a8a", color2: "#ffd76a", ears: "none",    tail: "fan",    emoji: "🦚", trait: "華麗" },
  orca:          { name: "Orca",       species: "orca",       kind: "aquatic",   color: "#1b2a4a", color2: "#ffffff", ears: "none",    tail: "fin",    emoji: "🐋", trait: "睿智" },
  ovis:          { name: "Ovis",       species: "sheep",      kind: "quadruped", color: "#f2ece0", color2: "#d8ccb8", ears: "small",   tail: "puff",   emoji: "🐑", trait: "溫馴" },
  lynx:          { name: "Lynx",       species: "lynx",       kind: "quadruped", color: "#c99a5b", color2: "#f0dcc0", ears: "tufted",  tail: "tiny",   emoji: "🐈", trait: "獨立" },
  bison:         { name: "Bison",      species: "bison",      kind: "quadruped", color: "#6b4a2b", color2: "#c8a878", ears: "small",   tail: "thin",   emoji: "🦬", trait: "力量" },
  alcedo:        { name: "Alcedo",     species: "kingfisher", kind: "bird",      color: "#1a7fa8", color2: "#f59e0b", ears: "none",    tail: "fan",    emoji: "🐦", trait: "精準" }
};

// 對話池（粵語為主，配少量多語示範）
export const DIALOGUES = {
  greet: [
    "你好呀～我係 {name} {emoji}",
    "歡迎嚟到 {planet}！",
    "準備好用學習外語嚟挖 AENO 未？"
  ],
  idle: [
    "你可以喺領土空地起建築。",
    "資源唔夠？可以派機器人去探索星球。",
    "記住：離線最多只計 24 小時收益。",
    "呢度講 {language}，學多幾句有著數。",
    "文明等級越高，解鎖嘅星球越多。"
  ],
  study: [
    "{language} 嘅發音練習：試跟住讀一次！",
    "學識新詞，AENO 掉落率會上升～",
    "語言掌握度 +1，繼續加油！"
  ],
  mutate: [
    "DNA 變異啟動… 有嘢進化咗！",
    "突變成功，特徵已經改寫。",
    "基因重組中，留意你嘅文明變化。"
  ],
  warning: [
    "⚠️ 黑洞唔開放俾普通玩家。",
    "⚠️ 母鑰權限只有你擁有（隱藏）。"
  ]
};

export function assistantFor(planetId) {
  const planet = PLANETS.find(p => p.id === planetId) || PLANETS[0];
  return { planet, assistant: ASSISTANTS[planet.assistant] || ASSISTANTS.lupus };
}

export function pickDialog(key, planet, assistant) {
  const pool = DIALOGUES[key] || DIALOGUES.idle;
  const line = pool[Math.floor(Math.random() * pool.length)];
  return line
    .replace(/{name}/g, assistant.name)
    .replace(/{emoji}/g, assistant.emoji)
    .replace(/{planet}/g, planet.name)
    .replace(/{language}/g, planet.language);
}
