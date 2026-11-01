// js/state.js — 遊戲狀態與存檔
import { PLANETS } from "./data.js";

const KEY = "aeno_v3_save";

export const state = {
  player: "",
  aeno: 0,
  civ: 1,
  planetId: PLANETS[0].id,
  unlocked: [PLANETS[0].id],
  lastTick: Date.now()
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch { /* 存檔壞咗就當新遊戲 */ }
  // 離線收益：最多累計 24 小時
  const elapsed = Math.min(Date.now() - (state.lastTick || Date.now()), 24 * 3600 * 1000);
  const gained = Math.floor((elapsed / 1000) * 0.02 * state.civ);
  state.aeno += gained;
  state.lastTick = Date.now();
  return gained;
}

export function saveState() {
  state.lastTick = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 私密模式可能失敗 */ }
}

export function resetState() {
  localStorage.removeItem(KEY);
  location.reload();
}

export function addAeno(n) {
  state.aeno = Math.max(0, state.aeno + n);
}

export function currentPlanet() {
  return PLANETS.find(p => p.id === state.planetId) || PLANETS[0];
}

export function planetIndex() {
  return PLANETS.findIndex(p => p.id === state.planetId);
}

export function unlockNext() {
  const i = planetIndex();
  const next = PLANETS[i + 1];
  if (next && !state.unlocked.includes(next.id)) {
    state.unlocked.push(next.id);
    return next;
  }
  return null;
}

// 文明升級門檻（每級需要 aeno * 遞增）
export function civThreshold(level) {
  return Math.floor(500 * Math.pow(1.7, level - 1));
}

export function tryLevelUp() {
  if (state.aeno >= civThreshold(state.civ)) {
    state.civ += 1;
    return true;
  }
  return false;
}
