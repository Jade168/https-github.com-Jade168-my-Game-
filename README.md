# AENO V3 · 量子星球文明模擬

3D 動漫風星際文明遊戲（browser-based，無需 build）。

## 玩法
- 20 個語言星球，每個有專屬 AI 動物助手（卡通渲染 3D）
- 學習外語 / 派機器人探索 / 建造 / DNA 變異 → 賺 AENO 幣
- 文明升級 → 解鎖下一個星球
- 進度存 localStorage，離線最多計 24 小時收益

## 技術
- **Three.js r158**（ESM + importmap，CDN 載入，免打包）
- **卡通渲染**：`MeshToonMaterial` 3 段漸層 + 背面描邊 + 動漫大眼
- 漸層天空 shader、星空、浮空島、OrbitControls 環繞視角
- PWA：Service Worker 離線快取

## 檔案結構
```
index.html          遊戲外殼（importmap + HUD）
style.css           動漫風 UI（玻璃擬態 / 漸層 / 發光）
manifest.json       PWA manifest
sw.js               Service Worker
planets.json        星球資料（備份）
js/main.js          進入點：場景、相機、動畫迴圈
js/data.js          20 星球 + 20 動物助手 + 對話池
js/state.js         遊戲狀態 + 存檔 + 離線收益
js/ui.js            HUD 綁定
js/game.js          動作處理 + 經濟結算
js/world3d.js       3D 世界（天空 / 星空 / 浮空島 / 星球主題）
js/characters3d.js  卡通渲染動物角色產生器 + 動畫
```

## 本機執行
```bash
python3 -m http.server 8000
# 開 http://localhost:8000
```
（必須用 http server，因為用了 ES module + importmap）

## 部署
GitHub Pages：repo → Settings → Pages → Source 揀 `main` / root。
已加 `.nojekyll` 避免 Jekyll 處理。
