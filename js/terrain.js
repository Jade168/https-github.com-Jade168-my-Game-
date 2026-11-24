// js/terrain.js — 新第 2 步：起伏手繪地形（研究 2 §1＋§7#2）
// 一個共用 heightAt(x,z)：地形網格＋全部物件擺位＋角色企位都用佢，唔可以有兩個
// 高度來源（Sakura Crossing 教訓：兩個來源不一致會令地面穿過道路／物件）。
// 高度來源：種子亂數 value-noise fBm（唔使新 dependency）＋島緣 radial falloff
// ＋屋地台／出生點 flatten pad（pad 內完全平，邊緣平滑過渡）。
// 上色：頂點色按高度＋坡度＋濕度＋花田／泥路 mask——唔係貼圖（報告優先做法：
// 色斑先係遠睇讀得出嘅嘢；v23 嘅 canvas 貼圖喺遠睇太 subtle）。
// 色板要暖返（v25 驗收：地面同樹仲係冷淡綠灰）——草地底色向暖黃推、
// 花田用暖粉／黃／白／紫、泥路暖沙色、島緣沙灘色。
// 地形最低 0.05，永遠高過舊圓柱頂蓋 y=0，頂蓋唔會穿出嚟；島緣收落 0.05，
// 同圓柱頂邊對齊，唔會有窿。
import * as THREE from "three";
import { TOON_RAMP } from "./toon.js";

export const ISLAND_TOP_R = 26; // 島頂半徑（同舊圓盤一致）
const BASE_Y = 0.05;            // 地形最低高度（島緣）
const HILL_AMP = 1.6;           // 起伏總幅度（丘陵波長約 15 單位，斜度多數 10–15°）
const BUMP = { x: -13, z: -6, r: 9, h: 0.9 }; // 背景大丘（遠景剪影，出生點望過去有山形）
const RINGS = 72, SECTORS = 144; // 徑向網格：約 1 萬頂點，手機夠用

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
// 種子雜湊：整數格點 → [0,1) 決定性亂數
function hash2(ix, iz, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 974634211)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const u = smoothstep(0, 1, fx), v = smoothstep(0, 1, fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, seed) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * vnoise(x * freq, z * freq, seed + o * 101);
    norm += amp; amp *= 0.5; freq *= 2.1;
  }
  return sum / norm; // 0..1
}
function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = clamp01(t);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

// 建立一個星球嘅高度場。spots：要壓平嘅地台 [{x, z, r}]（屋＋出生點），
// pad 高度由地台中心嘅原始高度定（唔使 caller 自己計，唔會有兩個來源）。
export function createHeightField(planet, spots) {
  let seed = 2166136261;
  for (const ch of planet.id) { seed ^= ch.charCodeAt(0); seed = Math.imul(seed, 16777619); }
  seed >>>= 0;
  const FREQ = 1 / 15;
  function raw(x, z) {
    const n = fbm(x * FREQ, z * FREQ, seed);
    let h = BASE_Y + HILL_AMP * n;
    const dx = x - BUMP.x, dz = z - BUMP.z;
    const d2 = (dx * dx + dz * dz) / (BUMP.r * BUMP.r);
    if (d2 < 4) h += BUMP.h * Math.exp(-d2);
    return h;
  }
  function falloff(x, z) {
    const r = Math.hypot(x, z) / ISLAND_TOP_R;
    return 1 - smoothstep(0.72, 1.0, r); // 島緣收落去 BASE_Y
  }
  function rawWithFalloff(x, z) {
    return BASE_Y + (raw(x, z) - BASE_Y) * falloff(x, z);
  }
  const pads = spots.map(s => ({ x: s.x, z: s.z, r: s.r, h: rawWithFalloff(s.x, s.z) }));
  function heightAt(x, z) {
    let h = rawWithFalloff(x, z);
    for (const p of pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r + 1.6) {
        const t = smoothstep(p.r, p.r + 1.6, d); // 0 = pad 內（完全平），1 = pad 外
        h = p.h + (h - p.h) * t;
      }
    }
    return h;
  }
  return heightAt;
}

// 泥路：由出生點 (0,7) 蜿蜒穿過島中心去對面山腳嘅折線（距離 mask，唔另鋪 mesh）
const PATH = [[0, 7], [2, 2], [1, -4], [-3, -9]];
function pathDist(x, z) {
  let d = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) {
    d = Math.min(d, distToSeg(x, z, PATH[i][0], PATH[i][1], PATH[i + 1][0], PATH[i + 1][1]));
  }
  return d;
}

// 頂點色：高度（低深濕綠／高淺黃綠）＋坡度（陡變岩色）＋濕度（低窪深綠）＋
// 花田 mask（一撻撻暖粉／黃／白／紫）＋泥路／泥斑（暖沙色）＋島緣沙灘。
// 低頻噪聲防 banding；全部由星球 ground 底色衍生，換星球主題不變。
function paintVertexColors(geo, planet, heightAt, seed) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(planet.ground);
  base.lerp(new THREE.Color(0xe8c96a), 0.10); // 輕推暖色（v25 冷綠灰問題）
  const deep = base.clone().lerp(new THREE.Color(0x000000), 0.25);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.38);
  const rock = base.clone().lerp(new THREE.Color(0x8a7f70), 0.6).lerp(new THREE.Color(0x000000), 0.15);
  const dirt = new THREE.Color(0xc9a06b);
  const sand = new THREE.Color(0xd9c08a);
  const flowerCols = [
    new THREE.Color(0xe89bb8), new THREE.Color(0xf2d06b),
    new THREE.Color(0xf5f0e6), new THREE.Color(0xb9a7e6)
  ];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const h = (y - BASE_Y) / (HILL_AMP + BUMP.h); // 0..1 高度
    c.copy(deep).lerp(light, 0.25 + 0.75 * clamp01(h));
    if (y < 0.6) c.lerp(deep, 0.25); // 低窪濕綠
    // 低頻噪聲色斑（防 banding，一撻撻手繪感）
    const blotch = fbm(x / 6, z / 6, seed + 7);
    c.multiplyScalar(0.92 + 0.16 * blotch);
    // 花田 mask：低頻噪聲門檻切出一撻撻 3–8 米花田，每撻一種花色
    const fm = fbm(x / 9, z / 9, seed + 13);
    const fAmt = smoothstep(0.60, 0.68, fm) * 0.55;
    if (fAmt > 0) {
      const cell = hash2(Math.floor(x / 9), Math.floor(z / 9), seed + 29);
      c.lerp(flowerCols[Math.floor(cell * flowerCols.length)], fAmt);
    }
    // 泥路＋泥斑
    const pd = pathDist(x, z);
    const pAmt = (1 - smoothstep(0.8, 1.4, pd)) * 0.75;
    if (pAmt > 0) c.lerp(dirt, pAmt);
    const dm = fbm(x / 11, z / 11, seed + 21);
    const dAmt = smoothstep(0.68, 0.74, dm) * 0.4;
    if (dAmt > 0) c.lerp(dirt, dAmt);
    // 坡度陡 → 岩色
    const slope = 1 - nrm.getY(i);
    const sAmt = smoothstep(0.35, 0.6, slope);
    if (sAmt > 0) c.lerp(rock, sAmt);
    // 島緣沙灘
    const r = Math.hypot(x, z);
    const rimAmt = smoothstep(23, 26, r) * 0.7;
    if (rimAmt > 0) c.lerp(sand, rimAmt);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// 建立地形網格（徑向網格：中心＋72 圈 × 144 扇，圓形島，唔用方形平面）。
// 回傳 { mesh, heightAt }；heightAt 係傳入嗰個（同 mesh 用同一函數）。
export function buildTerrain(planet, heightAt) {
  let seed = 2166136261;
  for (const ch of planet.id) { seed ^= ch.charCodeAt(0); seed = Math.imul(seed, 16777619); }
  seed >>>= 0;

  const positions = [0, heightAt(0, 0), 0];
  const uvs = [0.5, 0.5];
  for (let i = 1; i <= RINGS; i++) {
    const r = (i / RINGS) * ISLAND_TOP_R;
    for (let j = 0; j < SECTORS; j++) {
      const a = (j / SECTORS) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      positions.push(x, heightAt(x, z), z);
      uvs.push(x / (2 * ISLAND_TOP_R) + 0.5, z / (2 * ISLAND_TOP_R) + 0.5);
    }
  }
  // 捲繞方向：由上望落要逆時針（法線向上）。舊版寫反咗（法線向下、由上睇唔到），
  // smoke test 捉到（最大坡度 2.0 = 法線 y=-1）。扇形 (0, B, A)、四邊形 (a, b, d)、(b, e, d)。
  const indices = [];
  const ringStart = i => 1 + (i - 1) * SECTORS;
  for (let j = 0; j < SECTORS; j++) {
    indices.push(0, ringStart(1) + ((j + 1) % SECTORS), ringStart(1) + j);
  }
  for (let i = 1; i < RINGS; i++) {
    for (let j = 0; j < SECTORS; j++) {
      const j2 = (j + 1) % SECTORS;
      const a = ringStart(i) + j, b = ringStart(i) + j2;
      const d = ringStart(i + 1) + j, e = ringStart(i + 1) + j2;
      indices.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  paintVertexColors(geo, planet, heightAt, seed);

  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TOON_RAMP });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; // 接樹／屋／公仔嘅長影；本身唔投射（免 toon 自陰影 acne）
  mesh.castShadow = false;
  return { mesh, heightAt };
}
