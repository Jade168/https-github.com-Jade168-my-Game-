// js/main.js — 進入點：Three.js 場景、相機、角色、動畫迴圈，串接 UI 與遊戲邏輯
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildWorld, rebuildIsland } from "./world3d.js";
import { createCharacter, updateCharacter } from "./characters3d.js";
import { assistantFor } from "./data.js";
import { loadState, saveState, state, currentPlanet } from "./state.js";
import { initUI, showGame, hideLoading, refreshStats, refreshAssistant, renderPlanets } from "./ui.js";
import { handlers, startTicking } from "./game.js";

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0f22, 90, 260);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(9, 7, 12);

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
controls.minDistance = 6;
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
let character = null;
let characterTarget = null;
let clock = new THREE.Clock();

function placeCharacter() {
  const { assistant } = assistantFor(state.planetId);
  if (character) { scene.remove(character); disposeTree(character); }
  character = createCharacter(assistant);
  character.position.set(0, 0, 2.5);
  character.userData.baseY = 0;
  scene.add(character);
  controls.target.set(0, 1.4, 0);
  controls.update();
}

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => m.dispose());
    }
  });
}

function switchPlanet(planet) {
  rebuildIsland(world, planet);
  placeCharacter();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();
  if (character) updateCharacter(character, t, dt);
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
placeCharacter();
animate();

initUI({
  onLogin: handlers.onLogin,
  onAction: handlers.onAction,
  onPlanetChange: switchPlanet
});
handlers.onPlanetChange = switchPlanet;

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
