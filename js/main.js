// js/main.js — 進入點：Three.js 場景、相機、玩家公仔、寵物跟班、操控、動畫迴圈
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildWorld, rebuildIsland } from "./world3d.js";
import { createCharacter, updateCharacter } from "./characters3d.js";
import { createPlayer } from "./player3d.js";
import { assistantFor } from "./data.js";
import { loadState, saveState, state, currentPlanet } from "./state.js";
import { initUI, showGame, hideLoading, refreshStats, refreshAssistant, renderPlanets } from "./ui.js";
import { handlers, startTicking } from "./game.js";

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0f22, 90, 260);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(9, 7, 14);

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
controls.minDistance = 4;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 1.4, 0);

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
let playerCtl = null;      // 真・GLB 公仔（載入失敗 = null，改用寵物做可操控角色）
let avatar = null;         // 被操控移動嘅 Object3D（優先玩家公仔）
let clock = new THREE.Clock();

const ISLAND_R = 23;       // 可行走半徑（浮島頂半徑 26，留邊）
const WALK_SPEED = 3.4, RUN_SPEED = 6.8;

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
  if (pet) { scene.remove(pet); disposeTree(pet); }
  pet = createCharacter(assistant);
  petKind = assistant.kind;
  pet.userData.baseY = 0;
  // 有玩家公仔就企喺公仔側邊做跟班；冇就企中間做主角
  if (avatar && avatar !== pet) pet.position.set(avatar.position.x + 1.6, 0, avatar.position.z + 0.8);
  else pet.position.set(0, 0, 2.5);
  scene.add(pet);
  if (!playerCtl) avatar = pet;
}

function switchPlanet(planet) {
  rebuildIsland(world, planet);
  placePet();
}

// ---------- 操控：鍵盤 + 虛擬搖桿 ----------
const keys = {};
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
  updateCharacter(pet, t, dt);
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
saveState();

// PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
