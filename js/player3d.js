// js/player3d.js — 真・3D 公仔玩家：GLB 骨骼模型 + AnimationMixer 動畫狀態機
// 模型：assets/models/player.glb（骨骼綁定人形，內嵌 idle / walk / run / agree 等動畫）
// 日後換公仔：將新嘅 GLB（內嵌 idle/walk/run 動畫）改名 player.glb 覆蓋即可，唔使改碼。
// 載入失敗會 throw，main.js 會自動退回舊程式角色，唔會整爛遊戲。

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = "./assets/models/player.glb";
const TARGET_HEIGHT = 1.75; // 場景單位，同舊角色差唔多高

export async function createPlayer() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(MODEL_URL);

  const model = gltf.scene;
  // 正規化身高 + 貼地
  const box = new THREE.Box3().setFromObject(model);
  const h = Math.max(box.max.y - box.min.y, 0.001);
  const s = TARGET_HEIGHT / h;
  model.scale.setScalar(s);
  model.position.y = -box.min.y * s;
  // 動漫化上色：將示範模型嘅寫實材質換成卡通漸層材質＋動漫配色（同成個世界統一風格）
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
  // 必要動畫檢查：冇 idle/walk 就當唔合格
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
    // speed01: 0 = 企定，~0.5 = 行，1 = 跑
    setLocomotion(speed01) {
      if (performance.now() < emoteUntil) return;
      if (speed01 < 0.05) play("idle");
      else if (speed01 < 0.72) play("walk");
      else play(actions.run ? "run" : "walk");
    },
    // 一次性表情動作（例如點頭 agree），播完自動返去 locomotion
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
