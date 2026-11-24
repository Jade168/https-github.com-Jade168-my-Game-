// js/characters3d.js — 卡通渲染（toon）3D 動物助手
// 用 5 種身體藍圖（quadruped / biped / bird / aquatic / reptile / dragon）
// 加黑色描邊 + 大眼 + 腮紅，做出動漫風立體角色。

import * as THREE from "three";
import { toonMaterial as toon } from "./toon.js"; // 第 2 步：同世界共用同一條 3 段 ramp（之前動物用自己一條 [70,150,235]）

const OUTLINE_COLOR = 0x1b2130;

function outline(mesh, scale = 1.09) {
  const o = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide })
  );
  o.scale.multiplyScalar(scale);
  mesh.add(o);
  return mesh;
}

function ball(r, mat, seg = 20) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat);
  m.castShadow = true;
  return outline(m);
}

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
  m.castShadow = true;
  return outline(m, 1.14);
}

function cone(r, h, mat, seg = 12) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
  m.castShadow = true;
  return outline(m);
}

// 動漫大眼：深色眼球 + 白色高光
function makeEyes(spread, y, z, s) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 16), new THREE.MeshBasicMaterial({ color: 0x1b2130 }));
    eye.position.set(sx * spread, 0, 0);
    eye.scale.z = 0.7;
    const hi = new THREE.Mesh(new THREE.SphereGeometry(s * 0.34, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hi.position.set(sx * spread + s * 0.3, s * 0.3, s * 0.55);
    g.add(eye, hi);
  }
  g.position.set(0, y, z);
  return g;
}

function blush(spread, y, z, s, color = "#ff9ec4") {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.5 });
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 10), mat);
    b.position.set(sx * spread, 0, 0);
    b.scale.z = 0.35;
    g.add(b);
  }
  g.position.set(0, y, z);
  return g;
}

function ears(type, mat, mat2) {
  const g = new THREE.Group();
  if (type === "none") return g;
  if (type === "long") {
    for (const sx of [-1, 1]) {
      const e = capsule(0.075, 0.4, mat);
      e.position.set(sx * 0.16, 0.34, -0.02);
      e.rotation.z = sx * 0.16;
      g.add(e);
    }
  } else if (type === "round") {
    for (const sx of [-1, 1]) {
      const e = ball(0.15, mat, 14);
      e.position.set(sx * 0.3, 0.3, 0);
      g.add(e);
    }
  } else if (type === "small") {
    for (const sx of [-1, 1]) {
      const e = ball(0.1, mat, 12);
      e.position.set(sx * 0.33, 0.22, 0);
      g.add(e);
    }
  } else if (type === "horn") {
    for (const sx of [-1, 1]) {
      const e = cone(0.09, 0.34, mat2);
      e.position.set(sx * 0.2, 0.36, 0);
      e.rotation.z = sx * -0.24;
      g.add(e);
    }
  } else if (type === "tufted") {
    for (const sx of [-1, 1]) {
      const e = cone(0.13, 0.26, mat);
      e.position.set(sx * 0.26, 0.32, 0);
      const tip = cone(0.04, 0.12, mat2, 8);
      tip.position.set(sx * 0.26, 0.5, 0);
      g.add(e, tip);
    }
  } else {
    for (const sx of [-1, 1]) {
      const e = cone(0.15, 0.3, mat);
      e.position.set(sx * 0.24, 0.32, 0);
      e.rotation.z = sx * 0.2;
      g.add(e);
    }
  }
  return g;
}

function tail(type, mat, mat2) {
  const g = new THREE.Group();
  if (type === "none") return g;
  if (type === "bushy") {
    const t = ball(0.2, mat2, 14);
    t.scale.set(1.2, 1, 1);
    t.position.set(0, 0.12, 0);
    g.add(t);
  } else if (type === "thin") {
    const t = capsule(0.06, 0.5, mat);
    t.rotation.x = Math.PI / 2;
    t.position.set(0, 0.16, 0);
    g.add(t);
    const tip = ball(0.07, mat2, 10);
    tip.position.set(0, 0.16, 0.32);
    g.add(tip);
  } else if (type === "puff") {
    const t = ball(0.16, mat2, 14);
    t.position.set(0, 0.14, 0);
    g.add(t);
  } else if (type === "tiny") {
    const t = ball(0.08, mat2, 10);
    t.position.set(0, 0.12, 0);
    g.add(t);
  } else if (type === "spiky") {
    for (let i = 0; i < 4; i++) {
      const s = cone(0.09, 0.22, mat2, 6);
      s.position.set(0, 0.1, i * 0.16);
      s.rotation.x = Math.PI / 2.4;
      g.add(s);
    }
  } else if (type === "fin") {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.34, 3), mat2);
    f.rotation.z = Math.PI / 2;
    f.scale.set(1, 1, 0.35);
    f.castShadow = true;
    g.add(outline(f));
  } else if (type === "fan") {
    for (let i = -1; i <= 1; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.44, 4), i === 0 ? mat2 : mat);
      f.rotation.x = Math.PI / 2;
      f.rotation.z = i * 0.4;
      f.scale.z = 0.35;
      f.castShadow = true;
      g.add(outline(f));
    }
  }
  return g;
}

function legs(count, spread, mat, y, len = 0.4) {
  const g = new THREE.Group();
  const zs = count === 4 ? [spread, -spread] : [0];
  for (const z of zs) {
    for (const sx of [-1, 1]) {
      const l = capsule(0.11, len, mat);
      l.position.set(sx * spread * 0.85, y, z);
      g.add(l);
    }
  }
  return g;
}

// 主入口：依助手設定建立卡通動物
export function createCharacter(assistant) {
  const root = new THREE.Group();
  const body = new THREE.Group();   // 動畫用內層，root 留俾世界定位
  root.add(body);

  const mat = toon(assistant.color);
  const mat2 = toon(assistant.color2);
  const parts = {};
  const kind = assistant.kind;

  if (kind === "bird") {
    const torso = ball(0.42, mat, 22);
    torso.scale.set(1, 1.2, 1);
    torso.position.y = 0.95;
    body.add(torso);

    const head = ball(0.32, mat, 20);
    head.position.set(0, 1.62, 0.04);
    body.add(head);
    parts.head = head;

    const beak = cone(0.12, 0.26, mat2, 10);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 1.6, 0.34);
    body.add(beak);

    for (const sx of [-1, 1]) {
      const wing = ball(0.22, mat2, 14);
      wing.scale.set(0.4, 1, 1.3);
      wing.position.set(sx * 0.44, 1.0, 0);
      wing.rotation.z = sx * 0.3;
      body.add(wing);
      parts[sx < 0 ? "wingL" : "wingR"] = wing;
    }
    const t = tail(assistant.tail, mat, mat2);
    t.position.set(0, 0.95, -0.42);
    t.rotation.x = -0.4;
    body.add(t);
    parts.tail = t;

    for (const sx of [-1, 1]) {
      const leg = capsule(0.05, 0.28, mat2);
      leg.position.set(sx * 0.14, 0.3, 0);
      body.add(leg);
    }
    head.add(makeEyes(0.13, 0.06, 0.29, 0.075));
    parts.eyes = head.children[head.children.length - 1];
    head.add(blush(0.2, -0.06, 0.24, 0.05));

  } else if (kind === "aquatic") {
    const torso = capsule(0.4, 0.9, mat);
    torso.rotation.z = Math.PI / 2;
    torso.position.y = 0.9;
    body.add(torso);
    parts.torso = torso;

    const head = ball(0.36, mat, 20);
    head.position.set(0.72, 0.98, 0);
    body.add(head);
    parts.head = head;

    const snout = capsule(0.11, 0.3, mat2);
    snout.rotation.z = Math.PI / 2;
    snout.position.set(1.06, 0.9, 0);
    body.add(snout);

    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.4, 3), mat2);
    dorsal.scale.set(1, 1, 0.4);
    dorsal.position.set(-0.05, 1.36, 0);
    dorsal.castShadow = true;
    body.add(outline(dorsal));

    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 3), mat);
      fin.rotation.z = Math.PI / 2;
      fin.rotation.y = sx * 0.5;
      fin.scale.set(1, 1, 0.4);
      fin.position.set(0.1, 0.72, sx * 0.34);
      fin.castShadow = true;
      body.add(outline(fin));
    }
    const t = tail("fin", mat, mat2);
    t.position.set(-0.86, 0.9, 0);
    t.rotation.y = Math.PI / 2;
    body.add(t);
    parts.tail = t;

    head.add(makeEyes(0.16, 0.08, 0.31, 0.08));
    parts.eyes = head.children[head.children.length - 1];
    head.add(blush(0.24, -0.08, 0.24, 0.05));

  } else if (kind === "reptile") {
    const torso = capsule(0.32, 1.0, mat);
    torso.rotation.z = Math.PI / 2;
    torso.position.y = 0.55;
    body.add(torso);

    const head = ball(0.3, mat, 18);
    head.scale.set(1.3, 0.85, 1);
    head.position.set(0.78, 0.62, 0);
    body.add(head);
    parts.head = head;

    const snout = capsule(0.12, 0.34, mat);
    snout.rotation.z = Math.PI / 2;
    snout.position.set(1.16, 0.56, 0);
    body.add(snout);

    const t = tail(assistant.tail, mat, mat2);
    t.position.set(-0.72, 0.55, 0);
    t.rotation.y = Math.PI / 2;
    body.add(t);
    parts.tail = t;

    for (const sx of [-1, 1]) {
      for (const z of [0.24, -0.24]) {
        const l = capsule(0.09, 0.2, mat2);
        l.position.set(sx * 0.5, 0.24, z);
        body.add(l);
      }
    }
    head.add(makeEyes(0.14, 0.12, 0.26, 0.07));
    parts.eyes = head.children[head.children.length - 1];

  } else if (kind === "biped") {
    const torso = capsule(0.36, 0.5, mat);
    torso.position.y = 0.98;
    body.add(torso);
    parts.torso = torso;

    const head = ball(0.42, mat, 22);
    head.position.y = 1.66;
    body.add(head);
    parts.head = head;

    const muzzle = ball(0.2, mat2, 14);
    muzzle.position.set(0, 1.56, 0.34);
    body.add(muzzle);

    const ear = ears(assistant.ears, mat, mat2);
    ear.position.copy(head.position);
    body.add(ear);
    parts.earL = ear.children[0];

    for (const sx of [-1, 1]) {
      const arm = capsule(0.1, 0.5, mat);
      arm.position.set(sx * 0.44, 1.0, 0);
      arm.rotation.z = sx * 0.35;
      body.add(arm);
      parts[sx < 0 ? "armL" : "armR"] = arm;
    }
    for (const sx of [-1, 1]) {
      const leg = capsule(0.12, 0.36, mat2);
      leg.position.set(sx * 0.18, 0.36, 0);
      body.add(leg);
    }
    const t = tail(assistant.tail, mat, mat2);
    t.position.set(0, 0.86, -0.36);
    t.rotation.x = -0.9;
    body.add(t);
    parts.tail = t;

    head.add(makeEyes(0.16, 0.02, 0.38, 0.09));
    parts.eyes = head.children[head.children.length - 1];
    head.add(blush(0.26, -0.12, 0.3, 0.06));

  } else {
    // quadruped / dragon 共用四足藍圖
    const torso = capsule(0.42, 0.62, mat);
    torso.rotation.z = Math.PI / 2;
    torso.position.y = 0.82;
    body.add(torso);
    parts.torso = torso;

    const head = ball(0.4, mat, 22);
    head.position.set(0.68, 1.06, 0);
    body.add(head);
    parts.head = head;

    const snout = ball(0.2, mat2, 14);
    snout.scale.set(1.25, 0.85, 0.9);
    snout.position.set(1.0, 0.94, 0);
    body.add(snout);

    const nose = ball(0.07, mat, 10);
    nose.position.set(1.2, 0.98, 0);
    body.add(nose);

    const ear = ears(assistant.ears, mat, mat2);
    ear.position.copy(head.position);
    body.add(ear);
    parts.earL = ear.children[0];

    for (const z of [0.24, -0.24]) {
      for (const sx of [-1, 1]) {
        const leg = capsule(0.13, 0.34, mat);
        leg.position.set(sx * 0.34, 0.4, z);
        body.add(leg);
        parts[sx < 0 ? (z > 0 ? "legFL" : "legBL") : (z > 0 ? "legFR" : "legBR")] = leg;
      }
    }
    const t = tail(assistant.tail, mat, mat2);
    t.position.set(-0.62, 0.94, 0);
    t.rotation.x = -0.5;
    body.add(t);
    parts.tail = t;

    head.add(makeEyes(0.17, 0.12, 0.34, 0.085));
    parts.eyes = head.children[head.children.length - 1];
    head.add(blush(0.24, -0.1, 0.3, 0.055));

    if (kind === "dragon") {
      for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.72, 3), mat2);
        wing.rotation.z = Math.PI / 2;
        wing.rotation.x = sx * 0.5;
        wing.scale.set(1, 1, 0.18);
        wing.position.set(-0.1, 1.35, sx * 0.3);
        wing.castShadow = true;
        body.add(outline(wing));
        parts[sx < 0 ? "wingL" : "wingR"] = wing;
      }
    }
  }

  root.userData.parts = parts;
  root.userData.phase = Math.random() * Math.PI * 2;
  root.userData.baseY = 0;
  root.userData.character = assistant;
  return root;
}

// 每幀動畫：呼吸浮動 + 頭擺 + 尾巴搖 + 耳朵抖 + 定時眨眼
export function updateCharacter(root, t, dt) {
  const p = root.userData.parts;
  const ph = root.userData.phase;
  const body = root.children[0];

  body.position.y = root.userData.baseY + Math.sin(t * 2 + ph) * 0.055;

  if (p.head) {
    p.head.rotation.z = Math.sin(t * 1.4 + ph) * 0.055;
    p.head.rotation.y = Math.sin(t * 0.8 + ph) * 0.14;
  }
  if (p.tail) p.tail.rotation.y = Math.sin(t * 3.2 + ph) * 0.5;
  if (p.earL) p.earL.rotation.z = Math.sin(t * 4.1 + ph) * 0.12;
  if (p.wingL) { p.wingL.rotation.x = Math.sin(t * 2.6 + ph) * 0.3; p.wingR.rotation.x = -Math.sin(t * 2.6 + ph) * 0.3; }
  if (p.armL) { p.armL.rotation.x = Math.sin(t * 1.8 + ph) * 0.28; p.armR.rotation.x = -Math.sin(t * 1.8 + ph) * 0.28; }

  if (p.eyes) {
    const cycle = (t + ph) % 4.2;
    p.eyes.scale.y = cycle > 4.05 ? 0.12 : 1;
  }
}
