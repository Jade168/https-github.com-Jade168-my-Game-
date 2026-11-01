// js/game.js — 遊戲邏輯：動作處理、經濟結算
import { assistantFor, pickDialog } from "./data.js";
import { state, addAeno, saveState, currentPlanet, unlockNext, tryLevelUp, civThreshold } from "./state.js";
import { refreshStats, setDialog, toast, showUnlock, renderPlanets } from "./ui.js";

export const handlers = {
  onAction,
  onLogin,
  onPlanetChange: null   // 由 main.js 注入（切換 3D 世界）
};

function onLogin(name) {
  if (!name) { toast("請輸入代號", "warn"); return; }
  state.player = name;
  saveState();
  import("./ui.js").then(ui => { ui.showGame(); });
  refreshStats();
  refreshAssistantDialog();
  toast(`歡迎，${name}！`, "ok");
  window.dispatchEvent(new CustomEvent("aeno:login"));
}

export function refreshAssistantDialog() {
  const { planet, assistant } = assistantFor(state.planetId);
  setDialog(pickDialog("greet", planet, assistant));
}

function onAction(action) {
  const { planet, assistant } = assistantFor(state.planetId);
  switch (action) {
    case "talk":
      setDialog(pickDialog("idle", planet, assistant));
      break;
    case "feed": {
      addAeno(12 * state.civ);
      setDialog(`${assistant.name} 食飽飽，開心咁叫咗一聲 ${assistant.emoji}（+${12 * state.civ} AENO）`);
      toast(`+${12 * state.civ} AENO`, "ok");
      break;
    }
    case "scan": {
      const gain = 20 + Math.floor(Math.random() * 40);
      addAeno(gain * state.civ);
      setDialog(`掃描 ${planet.name} 完成，搵到 ${gain} 單位 AENO！`);
      toast(`掃描 +${gain * state.civ} AENO`, "ok");
      break;
    }
    case "build":
      if (state.aeno < 100) { toast("AENO 不足（需要 100）", "warn"); break; }
      addAeno(-100);
      setDialog(`${planet.name} 起咗新建築，文明成長中 🏗️`);
      toast("建造完成 −100 AENO", "ok");
      break;
    case "robot": {
      const gain = 30 * state.civ;
      addAeno(gain);
      setDialog("🤖 機器人完成探索任務，帶咗資源返嚟！");
      toast(`探索 +${gain} AENO`, "ok");
      break;
    }
    case "study":
      addAeno(8 * state.civ);
      setDialog(pickDialog("study", planet, assistant));
      toast(`語言學習 +${8 * state.civ} AENO`, "ok");
      break;
    case "mutate":
      setDialog(pickDialog("mutate", planet, assistant));
      break;
  }
  afterAction();
}

function afterAction() {
  if (tryLevelUp()) {
    toast(`✨ 文明升級！Lv.${state.civ}`, "ok");
    const next = unlockNext();
    if (next) { renderPlanets(); showUnlock(next); }
    setDialog(`文明升到 Lv.${state.civ}！${next ? "新星球已解鎖！" : ""}`);
  }
  refreshStats();
  saveState();
}

// 每 3 秒自動結算（在線收益）
let tickTimer = null;
export function startTicking() {
  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    addAeno(0.05 * state.civ * 3);
    afterAction();
  }, 3000);
}

export { civThreshold };
