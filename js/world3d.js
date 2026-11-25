// js/world3d.js — 3D 世界：漸層天空、星空、動漫風浮空島（toon 上色小屋／櫻花樹／雲朵／花草／水晶）
import * as THREE from "three";
import { TOON_RAMP, toonMaterial as toon } from "./toon.js"; // 第 2 步：全場共用同一條 3 段 ramp
import { painted } from "./paint.js"; // 第 3 步：canvas 手繪／漸變貼圖
import { createHeightField, buildTerrain } from "./terrain.js"; // 新第 2 步：起伏手繪地形
import { makeClouds } from "./clouds.js"; // 新第 3 步：大朵積雲（billboard puffs，舊球形雲已換走）

const SKY_VERT = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 horizonWarm;
uniform float offset;
varying vec3 vPos;
void main() {
  float h = normalize(vPos + vec3(0.0, offset, 0.0)).y;
  vec3 col = mix(bottomColor, topColor, max(pow(max(h, 0.0), 0.6), 0.0));
  vec3 dir = normalize(vPos);
  float sunAmt = max(dot(dir, sunDir), 0.0);
  // 地平線附近加暖色帶：太陽嗰邊最暖，對面地平線都有 0.30 底色，唔會得一邊暖
  // （第 6 輪微調：v24 驗收話暖色只喺太陽嗰邊，對面地平線係冷灰）
  float band = (1.0 - smoothstep(0.0, 0.35, h)) * (0.30 + 0.70 * smoothstep(0.2, 0.9, sunAmt));
  col = mix(col, horizonWarm, band * 0.55);
  // 柔和太陽光暈——唔要硬圓盤
  col += sunColor * (pow(sunAmt, 24.0) * 0.9 + pow(sunAmt, 6.0) * 0.22);
  gl_FragColor = vec4(col, 1.0);
}`;

function hex(c) { return new THREE.Color(c); }

// 第 5 輪新第 1 步：暖斜陽——太陽 16° 側光（+X 方向，唔係頭頂，唔係鏡頭後面），
// 暖色 #fff3df 強度 4；陰影繼續有色。
// 數字係已發表嘅起始值（Just-a-Simple-Tree celShade／Forest Stroll 黃金時刻），唔係對住目標圖量出嚟嘅。
// 第 6 輪微調（v24 驗收：暖色只喺太陽嗰邊，陰面冷藍灰去飽和）：
// 半球光天空色由冷藍 #bfd8ff 改暖奶油 #ffe3b8（照住全場向上嘅面，係陰面變冷嘅主因）、
// 地面色由 #6b5a45 推暖到蜜糖啡 #8a6a45、強度 1.0→1.1；
// rim 燈由冷藍 #9fd4ff 改暖色 #ffd9a8 做弱暖補光（由對面低角度補，強度 0.7→0.5，
// 唔可以消滅長影同斜陽方向感）；地平線混暖奶油 0.55→0.72，霧同天空底同步暖埋。
export const SUN_ELEVATION = 16; // 度
export const SUN_DIR = new THREE.Vector3(
  Math.cos(THREE.MathUtils.degToRad(SUN_ELEVATION)),
  Math.sin(THREE.MathUtils.degToRad(SUN_ELEVATION)),
  0
).normalize();
export const PALETTE = {
  sun: 0xfff3df, sunIntensity: 4.0,
  hemiSky: 0xffe3b8, hemiGround: 0x8a6a45, hemiIntensity: 1.1,
  rim: 0xffd9a8, rimIntensity: 0.5
};
// 地平線色：由星球天空色向暖奶油 #ffe7bd 混 72%——天空底部同霧都用佢，遠景融入天空；
// 暖斜陽下地平線係暖色，唔係冷白（第 5 輪新第 1 步；第 6 輪由 55% 推到 72%）
export function planetHorizon(planet) {
  return hex(planet.sky).lerp(new THREE.Color(0xffe7bd), 0.72);
}

const OUTLINE = 0x2a2440;
function outlined(mesh, scale = 1.06) {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide }));
  o.scale.multiplyScalar(scale);
  mesh.add(o);
  return mesh;
}
function box(w, h, d, mat, outlineIt = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true;
  return outlineIt ? outlined(m, 1.05) : m;
}
function ball(r, mat, seg = 14) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat);
  m.castShadow = true;
  return m;
}

function makeSky(top, bottom) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: hex(top).multiplyScalar(0.82) }, // 天頂加深少少，漸變層次出嚟（第 5 輪）
      bottomColor: { value: hex(bottom) },
      sunDir: { value: SUN_DIR },
      sunColor: { value: hex(PALETTE.sun) },
      horizonWarm: { value: hex(0xffe9c4) },
      offset: { value: 60 }
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false
  });
  return new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), mat);
}

// 遠景樹影環：最平嘅深度提示——一圈霧中深色樹影，等地平線唔係一條硬線
// （Forest Stroll 做法：錐體放 62–90 單位外，溶入霧；呢度 66–94，一個 InstancedMesh 一個 draw call）
function makeTreeline() {
  const geo = new THREE.ConeGeometry(1, 1, 6);
  const mat = toon(0x39543f); // 深藍綠，霧會再將佢沖淡
  const count = 64;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let seed = 1234567;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.1;
    const r = 66 + rand() * 28;
    const h = 7 + rand() * 9;
    const w = 2.5 + rand() * 3.5;
    p.set(Math.cos(a) * r, -4 + h / 2 + rand() * 2, Math.sin(a) * r);
    q.setFromAxisAngle(up, rand() * Math.PI);
    s.set(w, h, w);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function makeStars(count = 900) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 320 + Math.random() * 160;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.9);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi) + 40;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
}

// 動漫雲：舊球形雲（幾粒扁白球拼埋＋v23 實色藍碟底）已由新第 3 步換走——
// 大朵積雲喺 js/clouds.js（billboard puffs：canvas 成簇 radial-gradient 雲團貼圖，
// 三色調暖奶油頂／飽和藍綠中／暖淡紫底，Lambert 暖太陽光，慢速漂移＋wrap）。
// 呢度唔留舊 makeClouds，唔好加返。

function decorateIsland(group, planet) {
  // 以星球 id 做種子：同一個星球每次入去佈置一樣，唔再隨機重掟
  let seed = 2166136261;
  for (const ch of planet.id) { seed ^= ch.charCodeAt(0); seed = Math.imul(seed, 16777619); }
  const rand = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
  const rng = (a, b) => a + rand() * (b - a);
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  // 第 3 步：全部大件道具改用 canvas 手繪貼圖（paint.js 生成、按色快取）
  // 島身側面＝垂落草痕、島頂圓盤＝手繪色斑＋花田碎點＋畫入去嘅陰影面＋邊緣 AO
  const grassMat = painted(planet.ground, "groundSide");
  const accentMat = toon(planet.accent);
  const rockMat = painted(0x8a7f95, "rock");
  const rockDark = painted(0x6b5f7a, "rock");
  const wallMats = [painted(0xfff6e8, "wall"), painted(0xffe9f2, "wall"), painted(0xe8f4ff, "wall"), painted(0xfff3d6, "wall")];
  const roofMats = [painted(planet.accent, "roof"), painted(0xef6a7a, "roof"), painted(0x5aa9e6, "roof"), painted(0xf2a65a, "roof")];
  const trunkMat = painted(0x8a5a3b, "trunk");
  const leafMats = [painted(0x3fae5a, "leaf"), painted(0x57c46a, "leaf"), painted(0x2f9e4f, "leaf")];
  const sakuraMat = painted(0xffb7d5, "sakura");
  const sakuraMat2 = painted(0xff9ec7, "sakura");
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a3 });
  const doorMat = toon(0x7a4a2b);
  const crystalMat = toon(planet.accent, { emissive: hex(planet.accent), emissiveIntensity: 0.55 });

  // 新第 2 步：先定屋位（同舊 code 一樣用 rng 順序計，種子不變同星球佈置固定），
  // 再用屋位＋出生點做 flatten pad 建立共用 heightAt，最後起地形網格。
  // 一個高度來源：地形、屋、樹、花、水晶、角色企位全部跟 heightAt。
  const houseSpots = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng(-0.35, 0.35);
    const r = rng(10.5, 15.5);
    houseSpots.push({
      x: Math.cos(a) * r, z: Math.sin(a) * r,
      s: rng(0.85, 1.3), rotY: -a + Math.PI / 2 + rng(-0.3, 0.3)
    });
  }
  // 順序重要：出生點 pad 先、屋 pad 後——重疊區由後者贏，屋地台保證完全平
  // （反過來會令屋邊緣浮起約 0.1；smoke test 捉到）。出生點中心本身唔受屋影響。
  const heightAt = createHeightField(planet, [
    { x: 0, z: 7, r: 4 }, // 出生點地台（公仔 spawn (0,7)）
    ...houseSpots.map(h => ({ x: h.x, z: h.z, r: 3.2 }))
  ]);
  const terrain = buildTerrain(planet, heightAt);
  group.add(terrain.mesh);

  // 浮島本體：草地圓柱側面（頂蓋由地形網格取代——地形最低 0.05，頂蓋唔會穿出嚟）
  // ＋分層岩錐（動漫浮島感）
  const island = new THREE.Mesh(new THREE.CylinderGeometry(26, 23, 3, 48), grassMat);
  island.position.y = -1.5;
  island.receiveShadow = true;
  group.add(island);
  const under1 = new THREE.Mesh(new THREE.ConeGeometry(23, 13, 48, 1, true), rockMat);
  under1.position.y = -9.5; under1.rotation.x = Math.PI;
  group.add(under1);
  const under2 = new THREE.Mesh(new THREE.ConeGeometry(14, 11, 32, 1, true), rockDark);
  under2.position.y = -17; under2.rotation.x = Math.PI;
  group.add(under2);
  const tip = ball(1.6, crystalMat, 10);
  tip.position.y = -23.5;
  group.add(tip);

  const decor = new THREE.Group();
  group.add(decor);

  // 小屋（唔再係方盒塔）：牆身＋三角屋頂＋門＋發光窗＋煙囪
  function house(x, z, s, rotY) {
    const h = new THREE.Group();
    const wall = pick(wallMats), roof = pick(roofMats);
    const body = box(3.2, 2.2, 2.8, wall, true);
    body.position.y = 1.1;
    h.add(body);
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.7, 4), roof);
    roofMesh.position.y = 3.05;
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.castShadow = true;
    h.add(outlined(roofMesh, 1.05));
    const door = box(0.7, 1.2, 0.08, doorMat);
    door.position.set(0, 0.6, 1.44);
    h.add(door);
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), winMat);
      win.position.set(sx * 0.95, 1.35, 1.42);
      h.add(win);
      const winSide = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), winMat);
      winSide.position.set(sx * 1.62, 1.35, 0);
      winSide.rotation.y = sx * Math.PI / 2;
      h.add(winSide);
    }
    const chimney = box(0.45, 1.0, 0.45, rockMat);
    chimney.position.set(0.9, 3.4, -0.5);
    h.add(chimney);
    h.position.set(x, heightAt(x, z), z); // 新第 2 步：屋企喺地台高度（pad 內完全平）
    h.rotation.y = rotY;
    h.scale.setScalar(s);
    decor.add(h);
  }
  for (const hs of houseSpots) house(hs.x, hs.z, hs.s, hs.rotY);

  // 樹：綠樹（多球樹冠）＋櫻花樹（粉紅）＋松樹（錐層）
  function tree(x, z, kindT) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 8), trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    t.add(trunk);
    if (kindT === "pine") {
      for (let j = 0; j < 3; j++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.25 - j * 0.3, 1.3, 10), pick(leafMats));
        c.position.y = 1.7 + j * 0.8;
        c.castShadow = true;
        t.add(c);
      }
    } else {
      const mat = kindT === "sakura" ? (rand() > 0.5 ? sakuraMat : sakuraMat2) : pick(leafMats);
      const blobs = 3 + Math.floor(rand() * 2);
      for (let j = 0; j < blobs; j++) {
        const b = ball(rng(0.75, 1.15), mat, 12);
        b.position.set(rng(-0.55, 0.55), 1.9 + rng(0, 0.7), rng(-0.55, 0.55));
        t.add(b);
      }
    }
    t.position.set(x, heightAt(x, z), z); // 新第 2 步：跟地形，唔浮空唔沉底
    t.scale.setScalar(rng(0.85, 1.35));
    decor.add(t);
  }

  // 花草：細莖＋彩色花頭
  const flowerMats = [toon(0xff6b9d), toon(0xffd166), toon(0xc39bff), toon(0xff8c69), toon(0xffffff)];
  const stemMat = toon(0x3fae5a);
  function flower(x, z) {
    const f = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), stemMat);
    stem.position.y = 0.25;
    f.add(stem);
    const head = ball(0.13, pick(flowerMats), 8);
    head.position.y = 0.55;
    f.add(head);
    f.position.set(x, heightAt(x, z), z); // 新第 2 步：跟地形
    decor.add(f);
  }

  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = rng(4.5, 21.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    // 第 6 輪微調：出生點清樹——舊條件 < 4.5 根本唔會觸發（r 最細都 4.5），
    // 大棵櫻花樹企喺出生點隔離，一入場就遮住大半畫面。改為出生點半徑 7 內唔種樹，
    // 再加開場鏡頭地面位置 (3.6, 6.2) 半徑 5 內唔種樹（main.js 預設鏡頭），
    // 一入場就睇到公仔同島，唔使即刻縮放。種子亂數不變，同星球佈置固定。
    if (Math.hypot(x, z) < 7) continue;
    if (Math.hypot(x - 3.6, z - 6.2) < 5) continue;
    const kindT = rand() < 0.3 ? "sakura" : (rand() < 0.35 ? "pine" : "leaf");
    tree(x, z, kindT);
  }
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = rng(3.5, 22.5);
    flower(Math.cos(a) * r, Math.sin(a) * r);
  }
  // 水晶簇
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const r = rng(6, 21);
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const c = new THREE.Mesh(new THREE.ConeGeometry(rng(0.3, 0.5), rng(1.1, 2.2), 6), crystalMat);
    c.position.set(cx, heightAt(cx, cz) + rng(0.5, 0.9), cz); // 新第 2 步：跟地形
    c.rotation.z = rng(-0.15, 0.15);
    c.castShadow = true;
    decor.add(c);
  }
  return { decor, heightAt };
}

// 建立整個場景世界；回傳 { group, sky, stars, clouds, treeline, decor, horizon, heightAt }
// heightAt 係共用地形高度函數（新第 2 步）：main.js 角色／寵物企位都用佢。
export function buildWorld(planet) {
  const group = new THREE.Group();
  const horizon = planetHorizon(planet);
  const sky = makeSky(planet.sky, "#" + horizon.getHexString());
  const stars = makeStars();
  stars.visible = false; // 第 1 步預設日頭光：星星隱藏（留返將來夜晚模式用）
  const clouds = makeClouds(); // 新第 3 步：大朵積雲（js/clouds.js，billboard puffs）
  const treeline = makeTreeline(); // 第 5 輪新第 1 步：遠景樹影環
  group.add(sky, stars, clouds, treeline);
  const { decor, heightAt } = decorateIsland(group, planet);
  return { group, sky, stars, clouds, treeline, decor, horizon, heightAt };
}

// 換星球時重建地表裝飾（天空／星空／雲朵／樹影環保留，只換顏色主題；
// 地形連 heightAt 一齊重建——唔同星球唔同種子）
export function rebuildIsland(world, planet) {
  if (world.decor) world.decor.parent.remove(world.decor);
  world.group.children
    .filter(c => c !== world.sky && c !== world.stars && c !== world.clouds && c !== world.treeline && c.userData.keep !== true)
    .forEach(c => world.group.remove(c));
  const { decor, heightAt } = decorateIsland(world.group, planet);
  world.decor = decor;
  world.heightAt = heightAt;
  world.horizon = planetHorizon(planet);
  world.sky.material.uniforms.topColor.value = hex(planet.sky).multiplyScalar(0.82);
  world.sky.material.uniforms.bottomColor.value = world.horizon;
  return world.decor;
}
