// js/main.js — 進入點：Three.js 場景、相機、玩家公仔、寵物跟班、操控、動畫迴圈
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildWorld, rebuildIsland } from "./world3d.js";
import { createCharacter, updateCharacter } from "./characters3d.js";
import { createPlayer } from "./player3d.js";
import { createPetModel } from "./pet3d.js";
import { assistantFor } from "./data.js";
import { loadState, saveState, state, currentPlanet } from "./state.js";
import { initUI, showGame, hideLoading, refreshStats, refreshAssistant, renderPlanets } from "./ui.js";
import { handlers, startTicking } from "./game.js";

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0f22, 90, 260);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(6.5, 4.6, 9.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enableZoom = true;              // 雙指／滾輪縮放
controls.zoomSpeed = 1.15;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.minDistance = 3;
controls.maxDistance = 34;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 1.4, 0);
renderer.domElement.style.touchAction = "none";

// 鏡頭縮放掣（＋拉近／－拉遠）：直接改鏡頭同目標嘅距離，跟隨邏輯會保留呢個距離
function dollyBy(factor) {
  const off = camera.position.clone().sub(controls.target);
  const len = THREE.MathUtils.clamp(off.length() * factor, controls.minDistance, controls.maxDistance);
  off.setLength(len);
  camera.position.copy(controls.target).add(off);
}
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
if (zoomInBtn) zoomInBtn.addEventListener("click", () => dollyBy(0.75));
if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => dollyBy(1.33));

// 光源
scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3550, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(12, 20, 10);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -30;
key.shadow.camera.right = 30;
key.shadow.camera.top = 30;
key.shadow.camera.bottom = -30;
key.shadow.camera.far = 90;
key.shadow.bias = -0.0006;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fd4ff, 0.7);
rim.position.set(-14, 8, -10);
scene.add(rim);

let world = null;
let pet = null;            // 動物助手（寵物跟班）
let petKind = "quadruped";
let petCtl = null;         // 真・動物模型控制器（有真模型嘅物種先有，冇就用程式動物）
window.__aenoPetGlb = false; // 驗收診斷：true = 寵物已換上真 GLB 模型，false = 程式動物後備
window.__aenoPetError = "";  // 驗收診斷：最近一次寵物真模型載入失敗原因（空字串 = 無失敗／已成功）
window.__aenoPetFetch = "";  // 驗收診斷：petdebug 模式先做 fox.glb fetch 探測
let petSeq = 0;            // placePet 序號，防 async 載入換錯星球
const _petPrev = new THREE.Vector3();
let playerCtl = null;      // 真・GLB 公仔（載入失敗 = null，改用寵物做可操控角色）
let avatar = null;         // 被操控移動嘅 Object3D（優先玩家公仔）
let clock = new THREE.Clock();

const ISLAND_R = 23;       // 可行走半徑（浮島頂半徑 26，留邊）
// 行走 2.6 m/s：舊 3.4 m/s 係競步速度，步頻要 4.2 步/秒先跟得上地面，
// 睇落急促；2.6 m/s 配速度對齊步頻約 3.2 步/秒，步態自然啲。
const WALK_SPEED = 2.6, RUN_SPEED = 6.8;

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => m.dispose());
    }
  });
}

function placePet() {
  const { assistant } = assistantFor(state.planetId);
  const seq = ++petSeq;
  if (petCtl) { petCtl.dispose(); petCtl = null; }
  window.__aenoPetGlb = false;
  if (pet) { scene.remove(pet); disposeTree(pet); }
  pet = createCharacter(assistant);
  petKind = assistant.kind;
  pet.userData.baseY = 0;
  // 有玩家公仔就企喺公仔側邊做跟班；冇就企中間做主角
  if (avatar && avatar !== pet) pet.position.set(avatar.position.x + 1.6, 0, avatar.position.z + 0.8);
  else pet.position.set(0, 0, 2.5);
  scene.add(pet);
  if (!playerCtl) avatar = pet;
  _petPrev.copy(pet.position);
  // 有真模型嘅物種：async 載入後無縫換走程式動物（載入期間照用住程式動物先）
  createPetModel(assistant).then(ctl => {
    if (!ctl || seq !== petSeq || !pet) { if (ctl) ctl.dispose(); return; }
    const old = pet;
    ctl.object.position.copy(old.position);
    ctl.object.rotation.copy(old.rotation);
    scene.remove(old);
    disposeTree(old);
    pet = ctl.object;
    petCtl = ctl;
    window.__aenoPetGlb = true;
    window.__aenoPetError = "";
    console.info("[aeno] 寵物真模型已載入：", assistant.species);
    petKind = "glbpet"; // GLB 動物面向 +Z（同公仔一樣），headingFor 用預設公式
    scene.add(pet);
    if (avatar === old) avatar = pet;
    _petPrev.copy(pet.position);
  }).catch(err => { window.__aenoPetError = String((err && err.message) || err); console.warn("[aeno] 寵物真模型載入失敗，保留程式動物：", assistant.species, err); });
}

function switchPlanet(planet) {
  rebuildIsland(world, planet);
  placePet();
}

// ---------- 操控：鍵盤 + 虛擬搖桿 ----------
const keys = {};
// 驗收鉤子 ?autowalk=1：自動向前行，畀雲端瀏覽器驗收行走動畫用
// （瀏覽器工具做唔到長按 W）；正常開 game 唔帶參數就完全唔受影響。
const AUTO_WALK = new URLSearchParams(location.search).has("autowalk");
// 驗收鉤子 ?facecam=1：鏡頭移到主角正面，睇面孔／眨眼用（正常遊玩唔帶參數就唔受影響）
const FACE_CAM = new URLSearchParams(location.search).has("facecam");
window.addEventListener("keydown", e => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  keys[e.code] = true;
  if (e.code === "KeyE" && playerCtl) playerCtl.playEmote("agree");
});
window.addEventListener("keyup", e => { keys[e.code] = false; });

const joy = { x: 0, y: 0, active: false };
function initJoystick() {
  const base = document.getElementById("joy");
  const knob = document.getElementById("joyKnob");
  if (!base || !knob) return;
  let pid = null;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  const handle = e => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 8;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    joy.x = dx / max; joy.y = dy / max; joy.active = true;
    setKnob(dx, dy);
  };
  base.addEventListener("pointerdown", e => { pid = e.pointerId; base.setPointerCapture(pid); handle(e); });
  base.addEventListener("pointermove", e => { if (e.pointerId === pid) handle(e); });
  const end = e => { if (e.pointerId === pid) { pid = null; joy.x = 0; joy.y = 0; joy.active = false; setKnob(0, 0); } };
  base.addEventListener("pointerup", end);
  base.addEventListener("pointercancel", end);
}

function inputVector() {
  let f = 0, r = 0;
  if (AUTO_WALK) f += 1; // 驗收鉤子：自動向前行
  if (keys["KeyW"] || keys["ArrowUp"]) f += 1;
  if (keys["KeyS"] || keys["ArrowDown"]) f -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) r += 1;
  if (keys["KeyA"] || keys["ArrowLeft"]) r -= 1;
  if (joy.active) { f += -joy.y; r += joy.x; }
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }
  return { f, r, mag: Math.min(1, len) };
}

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// 朝向公式：GLB 公仔面向 +Z；四足／龍／水生／爬行寵物面向 +X，要減 90°
function headingFor(obj, dx, dz) {
  const base = Math.atan2(dx, dz);
  if (obj === pet && ["quadruped", "dragon", "aquatic", "reptile"].includes(petKind)) return base - Math.PI / 2;
  return base;
}

const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _dir = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3(), _prevTarget = new THREE.Vector3(), _targetDelta = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function updateMovement(dt) {
  if (!avatar) return;
  const { f, r, mag } = inputVector();
  const running = keys["ShiftLeft"] || keys["ShiftRight"] || mag > 0.92;
  let speed01 = 0;

  if (mag > 0.08) {
    // 以鏡頭方向為前方（第三身稱標準）：W = 向鏡頭指住嘅方向行
    _fwd.subVectors(controls.target, camera.position); _fwd.y = 0; _fwd.normalize();
    _right.crossVectors(_fwd, UP); // fwd × up = 右手方向
    _dir.set(0, 0, 0).addScaledVector(_fwd, f).addScaledVector(_right, r);
    if (_dir.lengthSq() > 0.0001) {
      _dir.normalize();
      const speed = (running ? RUN_SPEED : WALK_SPEED) * mag;
      avatar.position.addScaledVector(_dir, speed * dt);
      // 島邊界
      const d = Math.hypot(avatar.position.x, avatar.position.z);
      if (d > ISLAND_R) { avatar.position.x *= ISLAND_R / d; avatar.position.z *= ISLAND_R / d; }
      const targetRot = headingFor(avatar, _dir.x, _dir.z);
      avatar.rotation.y = angleLerp(avatar.rotation.y, targetRot, Math.min(1, dt * 12));
      speed01 = speed / RUN_SPEED;
    }
  }
  if (playerCtl && avatar === playerCtl.object) playerCtl.setLocomotion(speed01);
}

function updatePetFollow(dt, t) {
  if (!pet) return;
  if (petCtl) {
    // 真模型：按實際移動速度切換 Survey/Walk/Run 動畫
    const moved = pet.position.distanceTo(_petPrev);
    petCtl.setLocomotion(THREE.MathUtils.clamp(moved / Math.max(dt, 0.001) / RUN_SPEED, 0, 1));
    petCtl.update(dt);
    _petPrev.copy(pet.position);
  } else {
    updateCharacter(pet, t, dt);
  }
  if (!playerCtl || avatar !== playerCtl.object) return; // 冇公仔時寵物自己係主角，唔使跟
  // 跟班錨點：公仔身後左側
  const h = playerCtl.object.rotation.y;
  const back = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
  const side = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
  const anchor = playerCtl.object.position.clone().addScaledVector(back, -1.9).addScaledVector(side, 1.1);
  const to = anchor.clone().sub(pet.position); to.y = 0;
  const dist = to.length();
  if (dist > 0.35) {
    const dir = to.normalize();
    const speed = dist > 5 ? RUN_SPEED : WALK_SPEED * 0.92;
    pet.position.addScaledVector(dir, Math.min(dist, speed * dt));
    const targetRot = headingFor(pet, dir.x, dir.z);
    pet.rotation.y = angleLerp(pet.rotation.y, targetRot, Math.min(1, dt * 10));
  }
}

function updateCameraFollow(dt) {
  if (!avatar) return;
  _desiredTarget.set(avatar.position.x, avatar.position.y + 1.35, avatar.position.z);
  _prevTarget.copy(controls.target);
  controls.target.lerp(_desiredTarget, Math.min(1, dt * 6));
  _targetDelta.subVectors(controls.target, _prevTarget);
  camera.position.add(_targetDelta);
  if (FACE_CAM) {
    // 驗收鉤子：鏡頭企喺主角正面 4.2 米外、1.9 米高，主角行過嚟都保持正面
    const fwd = new THREE.Vector3(Math.sin(avatar.rotation.y), 0, Math.cos(avatar.rotation.y));
    camera.position.copy(avatar.position).addScaledVector(fwd, 4.2).add(new THREE.Vector3(0, 1.9, 0));
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();
  updateMovement(dt);
  if (playerCtl) playerCtl.update(dt);
  updatePetFollow(dt, t);
  updateCameraFollow(dt);
  if (world && world.stars) world.stars.rotation.y = t * 0.012;
  if (world && world.clouds) world.clouds.rotation.y = t * 0.02;
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

// 啟動
const offlineGain = loadState();
world = buildWorld(currentPlanet());
scene.add(world.group);

// 玩家公仔：非同步載入 GLB，成功就用公仔做主角，失敗退回寵物主角（placePet 會處理）
createPlayer().then(ctl => {
  playerCtl = ctl;
  ctl.object.position.set(0, 0, 7);
  ctl.object.rotation.y = Math.PI; // 面向島中心
  scene.add(ctl.object);
  avatar = ctl.object;
  placePet();
  // 驗收鉤子 ?emotetest=1：載入後自動打招呼（hold 9 秒，平台包絡）＋每 12 秒重播一次，
  // 畀靜態截圖捉到笑容／點頭一刻；畫面左下角 overlay 列出 VRM 表情名，定位 run#4 笑容失效原因。
  // 正常遊玩唔帶參數就唔受影響。
  if (new URLSearchParams(location.search).has("emotetest")) {
    const fire = () => { if (playerCtl) playerCtl.playEmote("agree", 9000); };
    setTimeout(fire, 1500);
    setInterval(fire, 12000);
    const dbg = document.createElement("div");
    dbg.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99;background:rgba(0,0,0,.75);color:#fff;font:12px/1.5 monospace;padding:6px 8px;border-radius:6px;white-space:pre;";
    dbg.textContent = "表情：檢查中…";
    document.body.appendChild(dbg);
    setInterval(() => {
      const names = window.__aenoExprNames || [];
      const list = names.length ? names.join("、") : (playerCtl ? "非 VRM 公仔（GLB 後備）" : "檢查中…");
      dbg.textContent = `表情清單：${list}\nhappy：${names.includes("happy") ? "有" : "無"}｜joy：${names.includes("joy") ? "有" : "無"}｜fun：${names.includes("fun") ? "有" : "無"}｜blink：${names.includes("blink") ? "有" : "無"}\n打招呼權重：${(window.__aenoEmoteW || 0).toFixed(2)}｜t：${(window.__aenoEmoteT ?? -1) < 0 ? "未進行" : (window.__aenoEmoteT).toFixed(2)}`;
    }, 500);
  }
}).catch(err => {
  console.warn("公仔模型載入失敗，退回程式角色：", err);
  placePet();
});
placePet();
animate();
initJoystick();

initUI({
  onLogin: handlers.onLogin,
  onAction: handlers.onAction,
  onPlanetChange: switchPlanet
});
handlers.onPlanetChange = switchPlanet;

const talkBtn = document.getElementById("btnTalk");
if (talkBtn) talkBtn.addEventListener("click", () => { if (playerCtl) playerCtl.playEmote("agree"); });

if (state.player) {
  showGame();
  refreshStats();
  refreshAssistant();
  renderPlanets();
  startTicking();
  toast(offlineGain > 0 ? `離線收益 +${offlineGain} AENO` : `歡迎返嚟，${state.player}`, offlineGain > 0 ? "ok" : "");
}

window.addEventListener("aeno:login", () => {
  refreshStats();
  refreshAssistant();
  renderPlanets();
  startTicking();
});

function toast(msg, type) {
  import("./ui.js").then(ui => ui.toast(msg, type));
}

// 首次載入即隱藏 loading（3D 已就緒）
hideLoading();

// 驗收診斷 ?petdebug=1：畫面左下角顯示寵物模型狀態＋載入錯誤＋fox.glb 探測結果
// （雲端瀏覽器開唔到 DevTools，靠呢個 overlay 讀數；正常遊玩唔帶參數就唔出現）
if (new URLSearchParams(location.search).has("petdebug")) {
  const dbg = document.createElement("div");
  dbg.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99;background:rgba(0,0,0,.75);color:#fff;font:12px/1.5 monospace;padding:6px 8px;border-radius:6px;white-space:pre;";
  dbg.textContent = "寵物模型：檢查中…";
  document.body.appendChild(dbg);
  setInterval(() => {
    dbg.textContent = `寵物模型：${window.__aenoPetGlb ? "真 GLB" : "程式後備"}\n載入錯誤：${window.__aenoPetError || "無"}\nfox.glb 探測：${window.__aenoPetFetch || "檢查中…"}`;
  }, 500);
  setTimeout(() => {
    fetch("./assets/models/fox.glb").then(r => {
      window.__aenoPetFetch = `HTTP ${r.status}，${r.headers.get("content-length") || "?"} bytes`;
    }).catch(e => { window.__aenoPetFetch = "fetch 失敗：" + String((e && e.message) || e); });
  }, 2000);
}
saveState();

// PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
