// js/pet3d.js — 真・動物助手模型（GLB + 內嵌動畫）
// 程式幾何動物做唔到生動可愛，所以有真模型嘅物種優先用 GLB：
//   狐/狼：Fox.glb（Survey 待機四圍望 / Walk 散步 / Run 奔跑）
//     模型 © PixelMannen (CC0)，綁定+動畫 © tomkranis (CC-BY 4.0)，glTF 轉換 © AsoboStudio/scurest (CC-BY 4.0)
//     狼暫時用狐模型改灰藍色頂住，等搵到真狼模型再換（換檔唔使改碼）
// 冇真模型嘅物種回傳 null，main.js 用返 characters3d.js 嘅程式動物做後備。

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODELS = {
  wolf: { url: "./assets/models/fox.glb", height: 1.02, tint: 0x8fa3c4 },
  fox: { url: "./assets/models/fox.glb", height: 0.92, tint: null }
};

export function hasPetModel(species) { return !!MODELS[species]; }

export async function createPetModel(assistant) {
  const spec = MODELS[assistant.species];
  if (!spec) return null;

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(spec.url);
  const model = gltf.scene;

  // 正規化身高 + 貼地（Fox 原模型面向 +Z，已由骨骼世界座標驗證，同主角公仔一致）
  const box = new THREE.Box3().setFromObject(model);
  const h = Math.max(box.max.y - box.min.y, 0.001);
  const s = spec.height / h;
  model.scale.setScalar(s);
  model.position.y = -box.min.y * s;

  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      if (spec.tint && o.material && o.material.color) o.material.color.set(spec.tint);
    }
  });

  const root = new THREE.Group();
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of gltf.animations) actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
  if (!actions.walk) throw new Error("動物模型缺少 walk 動畫");

  let current = null;
  function play(name, fade = 0.22) {
    const a = actions[name];
    if (!a || a === current) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = a;
  }
  play(actions.survey ? "survey" : "walk", 0);

  return {
    object: root,
    // speed01：0 = 企定（Survey 四圍望），~0.5 = 行，1 = 跑
    setLocomotion(speed01) {
      if (speed01 < 0.06) play(actions.survey ? "survey" : "walk");
      else if (speed01 < 0.72) play("walk");
      else play(actions.run ? "run" : "walk");
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
