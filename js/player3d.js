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

// ---------- VRM 動漫公仔（three-vrm 官方載入器） ----------
// 用 pixiv three-vrm 載入：先啟用到真・動漫渲染 MToon（平面色階/描邊）、
// 頭髮與衫擺嘅 SpringBone 物理、標準化人形骨骼（normalized bones，跨模型一致）、
// 表情管理器（blink/happy）。three-vrm 用動態 import 載入，CDN 出事會自動退 GLB 後備。
async function createVrmPlayer() {
  const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");

  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(VRM_URL);
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error("player.vrm 解析唔到 VRM 資料");
  if (vrm.meta && vrm.meta.metaVersion === "0") VRMUtils.rotateVRM0(vrm); // 0.x 模型面向修正

  const model = vrm.scene;
  model.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
  });

  // 頭髮/衫擺物理放軟：pixiv 樣本預設 stiffness 偏硬，行走時頭髮幾乎唔郁。
  // 降 stiffness 令髮尾滯後擺動更明顯、降 dragForce 減少阻尼；改唔到就靜默沿用預設。
  try {
    const mgr = vrm.springBoneManager;
    if (mgr && mgr.joints) mgr.joints.forEach(j => {
      if (!j.settings) return;
      j.settings.stiffness *= 0.5;
      j.settings.dragForce *= 0.6;
    });
  } catch (e) { console.warn("SpringBone 放軟失敗，沿用預設：", e); }
  normalizeHeight(model, TARGET_HEIGHT);

  const root = new THREE.Group();
  root.add(model);

  // 標準化骨骼（normalized）：軸向跨模型一致，唔使再估每隻公仔嘅骨架方向
  const nb = name => vrm.humanoid.getNormalizedBoneNode(name);
  const B = {
    hips: nb("hips"), spine: nb("spine"), chest: nb("chest"),
    neck: nb("neck"), head: nb("head"),
    armLU: nb("leftUpperArm"), armLL: nb("leftLowerArm"),
    armRU: nb("rightUpperArm"), armRL: nb("rightLowerArm"),
    legLU: nb("leftUpperLeg"), legLL: nb("leftLowerLeg"), footL: nb("leftFoot"),
    legRU: nb("rightUpperLeg"), legRL: nb("rightLowerLeg"), footR: nb("rightFoot")
  };
  if (!B.hips || !B.head || !B.legLU || !B.legRU || !B.armLU || !B.armRU) {
    throw new Error("player.vrm 人形骨骼唔完整");
  }
  for (const k in B) if (B[k]) B[k].userData.rest = B[k].quaternion.clone();
  const hipsRestY = B.hips.position.y;

  // 表情：用 three-vrm 表情管理器（1.0 用 happy，0.x 用 joy/fun，存在先 set）
  const em = vrm.expressionManager;
  const setExpr = (names, w) => {
    if (!em) return;
    for (const n of names) if (em.getExpression(n)) em.setValue(n, w);
  };

  // 骨骼姿勢：骨骼本地空間 delta（q = rest * delta），標準化骨骼軸向已統一
  const _e = new THREE.Euler(), _q = new THREE.Quaternion();
  function pose(b, rx = 0, ry = 0, rz = 0) {
    if (!b) return;
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    b.quaternion.copy(b.userData.rest).multiply(_q);
  }

  let phase = 0;
  let blend = 0;
  let blendTarget = 0;
  let speedNow = 0;
  let clock = 0;
  let emoteUntil = -1, emoteStart = 0;
  let nextBlink = 1.6, blinkT = -1;
  // 驗收鉤子 ?blinktest=1：眨眼放慢到 1.2 秒、每 2 秒一次，畀靜態截圖捉到閉眼一刻
  // （正常眨眼得 0.13 秒，截圖捉唔到唔等於失效；正常遊玩唔帶參數就唔受影響）
  const BLINK_TEST = new URLSearchParams(location.search).has("blinktest");
  const BLINK_DUR = BLINK_TEST ? 1.2 : 0.13;

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
      // 步頻對齊實際移動速度，唔再「平移滑行」：
      // 舊版 phase 固定 7.2 rad/s，但行走 3.4 m/s 下每步要行 1.48 m，
      // 遠超腿擺 0.52 rad 帶出嘅約 0.8 m 步幅，腳掌相對地面向後滑。
      // 而家步幅 = 2 × 腿長（約 0.78 m）× sin（擺幅），步頻 = π × 速度 / 步幅；
      // 跑步有空中騰空期，步頻封頂 15.5 rad/s。
      const RUN_SPEED_MS = 6.8; // 與 main.js RUN_SPEED 對齊
      const ampBase = speedNow > 0.72 ? 0.72 : 0.55;
      const amp = ampBase * blend;
      const strideLen = Math.max(0.3, 2 * 0.78 * Math.sin(ampBase));
      const phaseRate = Math.min(15.5, Math.PI * (speedNow * RUN_SPEED_MS) / strideLen);
      phase += dt * phaseRate * blend;
      const s = Math.sin(phase), c = Math.cos(phase);

      // 腿：前後擺（向前 = -X）；膝：屈曲為 +X；腳掌補償
      pose(B.legLU, -s * amp, 0, 0);
      pose(B.legRU, s * amp, 0, 0);
      pose(B.legLL, Math.max(0, Math.sin(phase + 0.75)) * 0.85 * blend + 0.03, 0, 0);
      pose(B.legRL, Math.max(0, Math.sin(phase + Math.PI + 0.75)) * 0.85 * blend + 0.03, 0, 0);
      pose(B.footL, (s * amp) * 0.55 - 0.05, 0, 0);
      pose(B.footR, (-s * amp) * 0.55 - 0.05, 0, 0);
      // 手臂：常態垂低（左 -Z / 右 +Z），行走反相擺；手肘微屈
      pose(B.armLU, s * amp * 0.62, 0, -1.15 + s * 0.03);
      pose(B.armRU, -s * amp * 0.62, 0, 1.15 - s * 0.03);
      pose(B.armLL, -0.28 - Math.max(0, s) * 0.18 * blend, 0, -0.06);
      pose(B.armRL, -0.28 - Math.max(0, -s) * 0.18 * blend, 0, 0.06);
      // 身體：呼吸 / 前傾 / 搖擺
      const breathe = Math.sin(clock * 1.7) * 0.018 * (1 - blend);
      pose(B.chest, breathe - blend * 0.06, s * 0.045 * blend, s * 0.02 * blend);
      pose(B.spine, breathe * 0.5 - blend * 0.03, 0, 0);
      pose(B.head, 0, Math.sin(clock * 0.43) * 0.07 * (1 - blend), Math.sin(clock * 0.31) * 0.02);
      B.hips.position.y = hipsRestY - Math.abs(c) * 0.05 * blend;

      // 眨眼
      if (blinkT < 0 && clock >= nextBlink) blinkT = 0;
      if (blinkT >= 0) {
        blinkT += dt;
        const p = blinkT / BLINK_DUR;
        if (p >= 1) { setExpr(["blink"], 0); blinkT = -1; nextBlink = clock + (BLINK_TEST ? 2.0 : 1.8 + Math.random() * 2.4); }
        else setExpr(["blink"], Math.sin(p * Math.PI));
      }
      // 打招呼：開心表情 + 點頭
      if (emoteUntil > 0) {
        if (clock <= emoteUntil) {
          const t = (clock - emoteStart) / (emoteUntil - emoteStart);
          const w = Math.sin(Math.min(1, t) * Math.PI);
          setExpr(["happy", "joy", "fun"], w);
          pose(B.head, Math.abs(Math.sin(t * Math.PI * 2)) * 0.22 * w + 0.05, 0, 0);
        } else { setExpr(["happy", "joy", "fun"], 0); emoteUntil = -1; }
      }

      vrm.update(dt); // SpringBone（頭髮/衫擺物理）+ 表情 + 朝向，一次過更新
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
