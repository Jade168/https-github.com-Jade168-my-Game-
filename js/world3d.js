// js/world3d.js — 3D 世界：漸層天空、星空、浮空島、星球主題地表與裝飾
import * as THREE from "three";

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

function decorateIsland(group, planet) {
  const groundMat = new THREE.MeshStandardMaterial({ color: hex(planet.ground), roughness: 0.85, metalness: 0.05 });
  const accentMat = new THREE.MeshStandardMaterial({ color: hex(planet.accent), roughness: 0.5, metalness: 0.25 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 });

  const island = new THREE.Mesh(new THREE.CylinderGeometry(26, 22, 3, 48), groundMat);
  island.position.y = -1.5;
  island.receiveShadow = true;
  group.add(island);

  // 島底錐體，做出浮空島感
  const under = new THREE.Mesh(new THREE.ConeGeometry(22, 20, 48, 1, true), rockMat);
  under.position.y = -13;
  under.rotation.x = Math.PI;
  group.add(under);

  const decor = new THREE.Group();
  group.add(decor);

  // 以星球 id 做種子：同一個星球每次入去佈置一樣，唔再隨機重掟
  let seed = 2166136261;
  for (const ch of planet.id) { seed ^= ch.charCodeAt(0); seed = Math.imul(seed, 16777619); }
  const rand = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
  const rng = (a, b) => a + rand() * (b - a);

  // 建築：主塔 + 小屋
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng(-0.3, 0.3);
    const r = rng(9, 16);
    const h = rng(3, 8);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(rng(2, 3.4), h, rng(2, 3.4)), i % 2 ? accentMat : groundMat);
    tower.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    tower.castShadow = true;
    tower.receiveShadow = true;
    decor.add(tower);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(rng(1.6, 2.6), rng(1.6, 2.6), 4), accentMat);
    roof.position.set(tower.position.x, h + 1, tower.position.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    decor.add(roof);
  }

  // 樹 / 晶體
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x2f8a45, roughness: 0.8 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
  const crystalMat = new THREE.MeshStandardMaterial({ color: hex(planet.accent), roughness: 0.15, metalness: 0.5, emissive: hex(planet.accent), emissiveIntensity: 0.35 });
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = rng(4, 21);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z) < 4) continue;
    if (i % 3 === 0) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 8), trunkMat);
      trunk.position.set(x, 0.7, z);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(rng(0.7, 1.1), 12, 12), treeMat);
      leaf.position.set(x, 1.7, z);
      leaf.castShadow = true;
      decor.add(trunk, leaf);
    } else {
      const c = new THREE.Mesh(new THREE.ConeGeometry(rng(0.3, 0.5), rng(1, 2), 6), crystalMat);
      c.position.set(x, rng(0.5, 1), z);
      c.castShadow = true;
      decor.add(c);
    }
  }
  return decor;
}

// 建立整個場景世界；回傳 { group, sky, stars, decor, update }
export function buildWorld(planet) {
  const group = new THREE.Group();
  const sky = makeSky(planet.sky, "#0a0f22");
  const stars = makeStars();
  group.add(sky, stars);
  const decor = decorateIsland(group, planet);
  return { group, sky, stars, decor };
}

// 換星球時重建地表裝飾
export function rebuildIsland(world, planet) {
  if (world.decor) world.decor.parent.remove(world.decor);
  world.group.children
    .filter(c => c !== world.sky && c !== world.stars && c.userData.keep !== true)
    .forEach(c => world.group.remove(c));
  world.decor = decorateIsland(world.group, planet);
  world.sky.material.uniforms.topColor.value = hex(planet.sky);
  return world.decor;
}
