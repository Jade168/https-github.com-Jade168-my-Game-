// js/ui.js — HUD 綁定：數值、星球列、助手對話、toast、選單
import { PLANETS, assistantFor, pickDialog } from "./data.js";
import { state, saveState, resetState, currentPlanet, planetIndex, unlockNext, tryLevelUp } from "./state.js";

let onPlanetChange = null;

const $ = id => document.getElementById(id);

export function initUI(handlers) {
  onPlanetChange = handlers.onPlanetChange;

  $("loginBtn").addEventListener("click", () => handlers.onLogin($("playerName").value.trim()));
  $("playerName").addEventListener("keydown", e => { if (e.key === "Enter") handlers.onLogin($("playerName").value.trim()); });

  $("planetPrev").addEventListener("click", () => stepPlanet(-1));
  $("planetNext").addEventListener("click", () => stepPlanet(1));

  $("btnTalk").addEventListener("click", () => handlers.onAction("talk"));
  $("btnFeed").addEventListener("click", () => handlers.onAction("feed"));
  $("btnScan").addEventListener("click", () => handlers.onAction("scan"));

  document.querySelectorAll(".action").forEach(btn => {
    btn.addEventListener("click", () => handlers.onAction(btn.dataset.action));
  });

  $("btnMenu").addEventListener("click", () => $("menuPanel").classList.toggle("hidden"));
  $("btnClose").addEventListener("click", () => $("menuPanel").classList.add("hidden"));
  $("btnSave").addEventListener("click", () => { saveState(); toast("進度已儲存", "ok"); });
  $("btnReset").addEventListener("click", () => { if (confirm("確定重置所有進度？")) resetState(); });

  window.addEventListener("beforeunload", saveState);
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveState(); });
}

export function showGame() {
  $("loginScreen").classList.add("hidden");
  $("hud").classList.remove("hidden");
  renderPlanets();
}

export function hideLoading() {
  const el = $("loading");
  el.style.opacity = "0";
  setTimeout(() => el.remove(), 650);
}

export function renderPlanets() {
  const list = $("planetList");
  list.innerHTML = "";
  PLANETS.forEach(p => {
    const locked = !state.unlocked.includes(p.id);
    const chip = document.createElement("button");
    chip.className = "planet-chip" + (p.id === state.planetId ? " active" : "") + (locked ? " locked" : "");
    chip.innerHTML = `<span>${p.flag}</span>${locked ? "🔒 " + p.name : p.name}`; // 未解鎖顯示 🔒＋星球名（舊版「？？？」成排睇落似渲染甩漏）
    chip.title = locked ? "尚未解鎖" : `${p.name} · ${p.language}`;
    chip.addEventListener("click", () => {
      if (locked) { toast("文明等級不足，未解鎖呢個星球", "warn"); return; }
      if (p.id === state.planetId) return;
      state.planetId = p.id;
      saveState();
      renderPlanets();
      onPlanetChange && onPlanetChange(p);
      refreshAssistant();
    });
    list.appendChild(chip);
  });
  const active = list.querySelector(".active");
  if (active) active.scrollIntoView({ inline: "center", block: "nearest" });
}

function stepPlanet(dir) {
  const unlocked = PLANETS.filter(p => state.unlocked.includes(p.id));
  const i = unlocked.findIndex(p => p.id === state.planetId);
  const next = unlocked[(i + dir + unlocked.length) % unlocked.length];
  if (next && next.id !== state.planetId) {
    state.planetId = next.id;
    saveState();
    renderPlanets();
    onPlanetChange && onPlanetChange(next);
    refreshAssistant();
  }
}

export function refreshAssistant() {
  const { planet, assistant } = assistantFor(state.planetId);
  $("assistantName").textContent = assistant.name;
  $("assistantSpecies").textContent = assistant.species;
  setDialog(pickDialog("greet", planet, assistant));
  return { planet, assistant };
}

export function setDialog(text) {
  const el = $("assistantDialog");
  el.style.opacity = "0";
  setTimeout(() => { el.textContent = text; el.style.opacity = "1"; }, 140);
}

export function refreshStats() {
  $("statAeno").textContent = Math.floor(state.aeno).toLocaleString();
  $("statCiv").textContent = "Lv." + state.civ;
  $("statPlanets").textContent = `${state.unlocked.length}/${PLANETS.length}`;
}

let toastTimer = null;
export function toast(msg, type = "") {
  const el = $("toast");
  el.textContent = msg;
  el.className = "show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ""; }, 2200);
}

export function showUnlock(planet) {
  toast(`🎉 解鎖新星球：${planet.name}（${planet.language}）`, "ok");
}
