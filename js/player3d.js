// js/player3d.js — 主角公仔
// 首選：VRM 動漫公仔（assets/models/player.vrm，有面孔/頭髮/衣服/骨骼）
//   VRM 檔冇內嵌動畫，行走/跑/眨眼/表情全部由程式驅動骨骼（J_Bip 人形骨架）
// 後備：GLB 骨骼模型（assets/models/player.glb，內嵌 idle/walk/run 動畫）
// 兩者都載入失敗會 throw，main.js 自動退回舊程式角色，唔會整爛遊戲。
// 換公仔：用任何 VRM 1.0 人形檔改名 player.vrm 覆蓋即可（骨骼行走自動適用）；
//         或用內嵌 idle/walk/run 動畫嘅 GLB 改名 player.glb。

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const VRM_URL = "./assets/models/player.vrm";
const GLB_URL = "./assets/models/player.glb";
const TARGET_HEIGHT = 1.68;

// ---------- 通用 ----------
function normalizeHeight(model, target) {
  const box = new THREE.Box3().setFromObject(model);
  const h = Math.max(box.max.y - box.min.y, 0.001);
  const s = target / h;
  model.scale.setScalar(s);
  model.position.y = -box.min.y * s;
  return s;
}

// ---------- VRM 動漫公仔 ----------
async function createVrmPlayer() {
  // 先攞原始 bytes：要嚟 parse VRMC_vrm 擴展（人形骨骼對照 + 表情 morph 對照）
  const buf = await (await fetch(VRM_URL)).arrayBuffer();
  const dv = new DataView(buf);
  const jsonLen = dv.getUint32(12, true);
  const vrmJson = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const vrmExt = vrmJson.extensions && vrmJson.extensions.VRMC_vrm;
  if (!vrmExt) throw new Error("player.vrm 唔係 VRM 1.0 檔案");

  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(buf, "");
  const model = gltf.scene;

  model.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
  });
  normalizeHeight(model, TARGET_HEIGHT);

  const root = new THREE.Group();
  root.add(model);

  // 人形骨骼（用節點名搵 three 物件）
  const hb = vrmExt.humanoid.humanBones;
  const bone = key => {
    const spec = hb[key];
    if (!spec) return null;
    const name = vrmJson.nodes[spec.node] && vrmJson.nodes[spec.node].name;
    return name ? model.getObjectByName(name) : null;
  };
  const B = {
    hips: bone("hips"), spine: bone("spine"), chest: bone("chest"),
    neck: bone("neck"), head: bone("head"),
    armLU: bone("leftUpperArm"), armLL: bone("leftLowerArm"),
    armRU: bone("rightUpperArm"), armRL: bone("rightLowerArm"),
    legLU: bone("leftUpperLeg"), legLL: bone("leftLowerLeg"), footL: bone("leftFoot"),
    legRU: bone("rightUpperLeg"), legRL: bone("rightLowerLeg"), footR: bone("rightFoot")
  };
  if (!B.hips || !B.head || !B.legLU || !B.legRU || !B.armLU || !B.armRU) {
    throw new Error("player.vrm 人形骨骼唔完整");
  }
  for (const k in B) if (B[k]) B[k].userData.rest = B[k].quaternion.clone();
  const hipsRestY = B.hips.position.y;

  // 表情 morph（blink / happy）：用 VRM 規格嘅 morphTargetBinds 對照
  const exprBinds = name => {
    const e = vrmExt.expressions && vrmExt.expressions.preset && vrmExt.expressions.preset[name];
    if (!e || !e.morphTargetBinds) return [];
    return e.morphTargetBinds.map(b => {
      const nodeName = vrmJson.nodes[b.node] && vrmJson.nodes[b.node].name;
      const mesh = nodeName ? model.getObjectByName(nodeName) : null;
      return mesh && mesh.morphTargetInfluences ? { mesh, index: b.index, weight: b.weight ?? 1 } : null;
    }).filter(Boolean);
  };
  const blinkBinds = exprBinds("blink");
  const happyBinds = exprBinds("happy");
  const setExpr = (binds, w) => { for (const b of binds) b.mesh.morphTargetInfluences[b.index] = w * b.weight; };

  // 骨骼姿勢：喺骨骼本地空間施加旋轉 delta（q = rest * delta）
  // J_Bip 骨骼本地軸 ≈ 世界軸（rest 旋轉接近 identity），本地空間先至令手臂正確垂低；
  // 父空間 delta 會畀肩膀骨嘅朝向扭曲旋轉軸（實測手臂垂唔低，保持 T-pose）
  const _e = new THREE.Euler(), _q = new THREE.Quaternion();
  function pose(b, rx = 0, ry = 0, rz = 0) {
    if (!b) return;
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    b.quaternion.copy(b.userData.rest).multiply(_q);
  }

  let phase = 0;          // 行走相位
  let blend = 0;          // 0=企定 1=全速移動（平滑過渡）
  let blendTarget = 0;
  let speedNow = 0;       // setLocomotion 傳入嘅速度 0..1
  let clock = 0;
  let emoteUntil = -1, emoteStart = 0;
  let nextBlink = 1.6, blinkT = -1;

  return {
    object: root,
    setLocomotion(speed01) {
      speedNow = speed01;
      blendTarget = speed01 < 0.05 ? 0 : 1;
    },
    playEmote(name = "agree", ms = 1300) {
      emoteStart = clock;
      emoteUntil = clock + ms / 1000;
    },
    update(dt) {
      clock += dt;
      blend += (blendTarget - blend) * Math.min(1, dt * 7);
      const runFactor = speedNow > 0.72 ? 1.35 : 1;      // 跑：步頻同擺幅都大啲
      phase += dt * (7.2 * runFactor) * blend;
      const amp = (0.52 + 0.18 * (runFactor - 1)) * blend;
      const s = Math.sin(phase), c = Math.cos(phase);

      // 腿：前後擺（向前 = -X）；膝：屈曲為 +X；腳掌補償保持貼地感
      pose(B.legLU, -s * amp, 0, 0);
      pose(B.legRU, s * amp, 0, 0);
      pose(B.legLL, Math.max(0, Math.sin(phase + 0.75)) * 0.85 * blend + 0.03, 0, 0);
      pose(B.legRL, Math.max(0, Math.sin(phase + Math.PI + 0.75)) * 0.85 * blend + 0.03, 0, 0);
      pose(B.footL, (s * amp) * 0.55 - 0.05, 0, 0);
      pose(B.footR, (-s * amp) * 0.55 - 0.05, 0, 0);
      // 手臂：常態垂低（左 -Z / 右 +Z 約 66°），行走時同對側腿反相擺；手肘微屈
      pose(B.armLU, s * amp * 0.62, 0, -1.15 + s * 0.03);
      pose(B.armRU, -s * amp * 0.62, 0, 1.15 - s * 0.03);
      pose(B.armLL, -0.28 - Math.max(0, s) * 0.18 * blend, 0, -0.06);
      pose(B.armRL, -0.28 - Math.max(0, -s) * 0.18 * blend, 0, 0.06);
      // 身體：移動時輕微前傾 + 左右搖；企定時呼吸
      const breathe = Math.sin(clock * 1.7) * 0.018 * (1 - blend);
      pose(B.chest, breathe - blend * 0.06, s * 0.045 * blend, s * 0.02 * blend);
      pose(B.spine, breathe * 0.5 - blend * 0.03, 0, 0);
      // 頭：企定輕微左右望，移動望前方；打招呼時點頭（emote 段覆寫）
      pose(B.head, 0, Math.sin(clock * 0.43) * 0.07 * (1 - blend), Math.sin(clock * 0.31) * 0.02);
      // 臀部上下浮動（行走節奏）
      B.hips.position.y = hipsRestY - Math.abs(c) * 0.045 * blend;

      // 眨眼：每 1.8–4.2 秒一次，0.13 秒開合
      if (blinkT < 0 && clock >= nextBlink) blinkT = 0;
      if (blinkT >= 0) {
        blinkT += dt;
        const p = blinkT / 0.13;
        if (p >= 1) { setExpr(blinkBinds, 0); blinkT = -1; nextBlink = clock + 1.8 + Math.random() * 2.4; }
        else setExpr(blinkBinds, Math.sin(p * Math.PI));
      }
      // 表情動作（打招呼）：開心表情 + 點頭兩下
      if (emoteUntil > 0) {
        if (clock <= emoteUntil) {
          const t = (clock - emoteStart) / (emoteUntil - emoteStart);
          const w = Math.sin(Math.min(1, t) * Math.PI);
          setExpr(happyBinds, w);
          pose(B.head, Math.abs(Math.sin(t * Math.PI * 2)) * 0.22 * w + 0.05, 0, 0);
        } else { setExpr(happyBinds, 0); emoteUntil = -1; }
      }
    },
    dispose() {
      model.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
    }
  };
}

// ---------- GLB 後備公仔（原有實作） ----------
async function createGlbPlayer() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(GLB_URL);

  const model = gltf.scene;
  normalizeHeight(model, 1.75);
  const steps = new Uint8Array([90, 170, 245]);
  const grad = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  grad.minFilter = THREE.NearestFilter;
  grad.magFilter = THREE.NearestFilter;
  grad.generateMipmaps = false;
  grad.needsUpdate = true;
  const toonFor = name => new THREE.MeshToonMaterial({
    color: new THREE.Color(/joint/i.test(name || "") ? 0x51486e : 0xe9e4f8),
    gradientMap: grad
  });
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      o.material = Array.isArray(o.material) ? o.material.map(m => toonFor(m.name)) : toonFor(o.material.name);
    }
  });

  const root = new THREE.Group();
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of gltf.animations) {
    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
  }
  if (!actions.idle || !actions.walk) throw new Error("player.glb 缺少 idle/walk 動畫");

  let current = null;
  function play(name, fade = 0.25) {
    const a = actions[name];
    if (!a || a === current) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = a;
  }
  play("idle", 0);

  let emoteUntil = 0;

  return {
    object: root,
    setLocomotion(speed01) {
      if (performance.now() < emoteUntil) return;
      if (speed01 < 0.05) play("idle");
      else if (speed01 < 0.72) play("walk");
      else play(actions.run ? "run" : "walk");
    },
    playEmote(name = "agree", ms = 1200) {
      const a = actions[name];
      if (!a) return;
      emoteUntil = performance.now() + ms;
      a.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.15).play();
      if (current && current !== a) current.fadeOut(0.15);
      current = a;
      setTimeout(() => { current = null; play("idle", 0.2); }, ms);
    },
    update(dt) { mixer.update(dt); },
    dispose() {
      mixer.stopAllAction();
      model.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
    }
  };
}

// ---------- 入口：VRM 優先，GLB 後備 ----------
export async function createPlayer() {
  try {
    return await createVrmPlayer();
  } catch (e) {
    console.warn("VRM 公仔載入失敗，改用 GLB 後備：", e);
    return await createGlbPlayer();
  }
}
