// js/world3d.js — 3D 世界：漸層天空、星空、動漫風浮空島（toon 上色小屋／櫻花樹／雲朵／花草／水晶）
import * as THREE from "three";
import { TOON_RAMP, toonMaterial as toon } from "./toon.js"; // 第 2 步：全場共用同一條 3 段 ramp

const SKY_VERT = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
varying vec3 vPos;
void main() {
  float h = normalize(vPos + vec3(0.0, offset, 0.0)).y;
  gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), 0.6), 0.0)), 1.0);
}`;

function hex(c) { return new THREE.Color(c); }

// 第 1 步鎖死嘅動漫色板＋燈光系統（報告 §5#1）：暖太陽＋粉藍天光／粉紅地光——陰影帶色，唔用黑灰
export const PALETTE = {
  sun: 0xffdf9e, sunIntensity: 2.0,
  hemiSky: 0xbcd8ff, hemiGround: 0xffd9c8, hemiIntensity: 0.9,
  rim: 0x9fd4ff, rimIntensity: 0.7
};
// 地平線色：由星球天空色向白混 55%——天空底部同霧都用佢，遠景融入天空
export function planetHorizon(planet) {
  return hex(planet.sky).lerp(new THREE.Color(0xffffff), 0.55);
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
      topColor: { value: hex(top) },
      bottomColor: { value: hex(bottom) },
      offset: { value: 60 }
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false
  });
  return new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), mat);
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

// 動漫雲：幾粒扁白球拼埋，浮喺島四周慢慢轉
function makeClouds(accent) {
  const g = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: TOON_RAMP, transparent: true, opacity: 0.92 });
  const tint = new THREE.MeshToonMaterial({ color: hex(accent), gradientMap: TOON_RAMP, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const s = ball(1 + Math.random() * 1.3, j % 3 === 0 ? tint : mat, 12);
      s.position.set(j * 1.5 - n * 0.7, Math.random() * 0.5, Math.random() * 0.8 - 0.4);
      s.scale.y = 0.55;
      s.castShadow = false;
      cloud.add(s);
    }
    const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
    const r = 38 + Math.random() * 26;
    cloud.position.set(Math.cos(a) * r, 13 + Math.random() * 12, Math.sin(a) * r);
    const sc = 1.6 + Math.random() * 1.8;
    cloud.scale.setScalar(sc);
    g.add(cloud);
  }
  return g;
}

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

  const grassMat = toon(planet.ground);
  const grassLight = new THREE.MeshToonMaterial({ color: hex(planet.ground).lerp(new THREE.Color(0xffffff), 0.28), gradientMap: TOON_RAMP });
  const accentMat = toon(planet.accent);
  const rockMat = toon(0x8a7f95);
  const rockDark = toon(0x6b5f7a);
  const wallMats = [toon(0xfff6e8), toon(0xffe9f2), toon(0xe8f4ff), toon(0xfff3d6)];
  const roofMats = [toon(planet.accent), toon(0xef6a7a), toon(0x5aa9e6), toon(0xf2a65a)];
  const trunkMat = toon(0x8a5a3b);
  const leafMats = [toon(0x3fae5a), toon(0x57c46a), toon(0x2f9e4f)];
  const sakuraMat = toon(0xffb7d5);
  const sakuraMat2 = toon(0xff9ec7);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a3 });
  const doorMat = toon(0x7a4a2b);
  const crystalMat = toon(planet.accent, { emissive: hex(planet.accent), emissiveIntensity: 0.55 });

  // 浮島本體：草地圓盤 + 淺色草面 + 分層岩錐（動漫浮島感）
  const island = new THREE.Mesh(new THREE.CylinderGeometry(26, 23, 3, 48), grassMat);
  island.position.y = -1.5;
  island.receiveShadow = true;
  group.add(island);
  const topDisc = new THREE.Mesh(new THREE.CircleGeometry(25.6, 48), grassLight);
  topDisc.rotation.x = -Math.PI / 2;
  topDisc.position.y = 0.02;
  topDisc.receiveShadow = true;
  group.add(topDisc);
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
    h.position.set(x, 0, z);
    h.rotation.y = rotY;
    h.scale.setScalar(s);
    decor.add(h);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng(-0.35, 0.35);
    const r = rng(10.5, 15.5);
    house(Math.cos(a) * r, Math.sin(a) * r, rng(0.85, 1.3), -a + Math.PI / 2 + rng(-0.3, 0.3));
  }

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
    t.position.set(x, 0, z);
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
    f.position.set(x, 0, z);
    decor.add(f);
  }

  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = rng(4.5, 21.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z) < 4.5) continue;
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
    const c = new THREE.Mesh(new THREE.ConeGeometry(rng(0.3, 0.5), rng(1.1, 2.2), 6), crystalMat);
    c.position.set(Math.cos(a) * r, rng(0.5, 0.9), Math.sin(a) * r);
    c.rotation.z = rng(-0.15, 0.15);
    c.castShadow = true;
    decor.add(c);
  }
  return decor;
}

// 建立整個場景世界；回傳 { group, sky, stars, clouds, decor, horizon }
export function buildWorld(planet) {
  const group = new THREE.Group();
  const horizon = planetHorizon(planet);
  const sky = makeSky(planet.sky, "#" + horizon.getHexString());
  const stars = makeStars();
  stars.visible = false; // 第 1 步預設日頭光：星星隱藏（留返將來夜晚模式用）
  const clouds = makeClouds(planet.accent);
  group.add(sky, stars, clouds);
  const decor = decorateIsland(group, planet);
  return { group, sky, stars, clouds, decor, horizon };
}

// 換星球時重建地表裝飾（天空／星空／雲朵保留，只換顏色主題）
export function rebuildIsland(world, planet) {
  if (world.decor) world.decor.parent.remove(world.decor);
  world.group.children
    .filter(c => c !== world.sky && c !== world.stars && c !== world.clouds && c.userData.keep !== true)
    .forEach(c => world.group.remove(c));
  world.decor = decorateIsland(world.group, planet);
  world.horizon = planetHorizon(planet);
  world.sky.material.uniforms.topColor.value = hex(planet.sky);
  world.sky.material.uniforms.bottomColor.value = world.horizon;
  return world.decor;
}
