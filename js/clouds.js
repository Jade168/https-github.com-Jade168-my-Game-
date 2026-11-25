// js/clouds.js — 新第 3 步：大朵積雲（路線 B billboard puffs，研究報告 §3＋§7 第 3 步）
// 做法：canvas 畫成簇 radial-gradient 積雲團貼圖（paint.js cloudPuffTexture，三色調：
// 暖奶油頂／飽和藍綠中／暖淡紫底），每朵雲一塊 Plane billboard 對住鏡頭，
// 暖太陽 Lambert 光照，慢速漂移＋邊緣 wrap。舊球形雲（v23 實色藍碟底）成組換走。
// 唔郁：v25 光／天／霧、v26 地形、樹／屋／水晶／花、狐狸、VRM 主角、操控。
import * as THREE from "three";
import { cloudPuffTexture } from "./paint.js";

// 風向：同太陽方向一致（+X 為主，微偏 +Z），成個場景同一陣風
export const WIND_DIR = new THREE.Vector3(1, 0, 0.18).normalize();
const DRIFT_SPEED = 0.35; // 單位／秒，慢速漂移
const WRAP_X = 170, WRAP_Z = 150; // 漂移 wrap 邊界（島半徑 26，天空球半徑 600，雲唔會漂出天）
const CLOUD_COUNT_DESKTOP = 70, CLOUD_COUNT_MOBILE = 40;
// 逐朵 tint（近白／暖色為主：三色調已經畫入貼圖，tint 唔可以再將成朵雲染粉／染綠）
const TINTS = [0xffffff, 0xfff6da, 0xffeec9, 0xf2f6ff, 0xffffff];

// 手機／低效能：約 40 朵（overdraw 係 billboard 雲嘅主要成本）；桌面：約 70 朵
export function cloudCount() {
  if (typeof window === "undefined") return CLOUD_COUNT_DESKTOP;
  const coarse = window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false;
  const small = window.innerWidth <= 768 || coarse || "ontouchstart" in window;
  return small ? CLOUD_COUNT_MOBILE : CLOUD_COUNT_DESKTOP;
}

export function makeClouds() {
  const tex = cloudPuffTexture();
  // 一塊 2:1 plane（貼圖 512×256），逐朵 scale——一塊 geometry 全場共用
  const geo = new THREE.PlaneGeometry(1, 0.5);
  const mats = TINTS.map(t => new THREE.MeshLambertMaterial({
    map: tex, color: t, transparent: true, opacity: 0.6, depthWrite: false
  }));
  const group = new THREE.Group();
  // 決定性種子：同一個星球／裝置每次入去雲佈置一樣（唔隨機重掟）
  let seed = 987654321;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const clouds = [];
  const count = cloudCount();
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mats[Math.floor(rand() * mats.length)]);
    // 分佈闊而扁：近 2 成係主角雲（半徑 38–75，睇得清三色調同花椰菜輪廓），
    // 其餘 8 成係遠景雲（半徑 75–130，霧會將佢哋溶成淡色地平線雲，唔搶主角雲）；
    // 唔入島上空中心（半徑 < 38 唔擺），唔遮開場鏡頭／唔擋公仔。
    // 之前 6 成近雲太多：一塊 26–52 闊嘅 plane 喺 40–80 單位外已經佔半個畫面闊，
    // 70 朵圍住鏡頭變咗成幅波點牆，藍天冇晒空隙
    const a = rand() * Math.PI * 2;
    const near = rand() < 0.2;
    const r = near ? 38 + rand() * 37 : 75 + rand() * 55;
    const w = near ? 30 + rand() * 22 : 30 + rand() * 25; // 闊 30–55（大朵，唔係細波波）
    mesh.scale.set(w, w, 1);
    mesh.position.set(
      Math.cos(a) * r,
      near ? 10 + rand() * 10 : 14 + rand() * 18, // 近雲高 10–20，遠雲高 14–32
      Math.sin(a) * r
    );
    mesh.renderOrder = 2;
    mesh.userData.spin = (rand() - 0.5) * 0.16; // ±0.08 rad/s 慢速自轉
    mesh.userData.phase = rand() * Math.PI * 2;
    mesh.userData.baseY = mesh.position.y;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    clouds.push(mesh);
  }
  // 每幀：慢速漂移＋邊緣 wrap、billboard 對住鏡頭＋慢速 rotateZ、輕微上下浮動
  group.userData.update = (dt, t, camera) => {
    if (!camera) return;
    for (const c of clouds) {
      c.position.addScaledVector(WIND_DIR, DRIFT_SPEED * dt);
      if (c.position.x > WRAP_X) c.position.x -= WRAP_X * 2;
      else if (c.position.x < -WRAP_X) c.position.x += WRAP_X * 2;
      if (c.position.z > WRAP_Z) c.position.z -= WRAP_Z * 2;
      else if (c.position.z < -WRAP_Z) c.position.z += WRAP_Z * 2;
      c.position.y = c.userData.baseY + Math.sin(t * 0.3 + c.userData.phase) * 1.2;
      c.quaternion.copy(camera.quaternion);
      c.rotateZ(c.userData.spin * t + c.userData.phase);
    }
  };
  group.userData.count = count;
  if (typeof window !== "undefined") window.__aenoClouds = { count, tier: count === CLOUD_COUNT_DESKTOP ? "desktop" : "mobile" };
  return group;
}
