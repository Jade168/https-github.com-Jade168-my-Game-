// js/pet3d.js — 真・動物助手模型（GLB + 內嵌動畫）
// 程式幾何動物做唔到生動可愛，所以有真模型嘅物種優先用 GLB：
//   狐/狼：Fox.glb（Survey 待機四圍望 / Walk 散步 / Run 奔跑）
//     模型 © PixelMannen (CC0)，綁定+動畫 © tomkranis (CC-BY 4.0)，glTF 轉換 © AsoboStudio/scurest (CC-BY 4.0)
//     狼暫時用狐模型改灰藍色頂住，等搵到真狼模型再換（換檔唔使改碼）
// 冇真模型嘅物種回傳 null，main.js 用返 characters3d.js 嘅程式動物做後備。

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
// 註：狐狸唔用 toon.js（第 3 輪修復）——第 2 步（v21）曾將 Fox GLB 轉做 MeshToonMaterial，
// 結果成隻變全黑剪影。破案：Fox.glb 嘅 primitive 根本冇 NORMAL 屬性
// （得 JOINTS_0／POSITION／TEXCOORD_0／WEIGHTS_0），MeshStandardMaterial 容忍到
// （半球光照住橙毛貼圖），MeshToonMaterial 嘅 ramp 查表就塌咗變黑。
// 所以狐狸暫時豁免統一 ramp，用返 v20 親眼驗過嘅 MeshStandardMaterial 亮橙樣；
// 第 4 步換寵物模型嗰陣再試安全做法（例如先 computeVertexNormals 補法線再轉 toon）。

// 同一模型只下載＋解析一次（每次換星球/重入都會再叫 placePet，舊版每次重新 fetch，
// 令程式動物頂住嘅時間拉長，間中睇落似「真模型時得時唔得」）；
// 之後每次用 SkeletonUtils 複製（骨骼綁定正確），材質每隻實例 clone 一份，
// 免得狼嘅灰藍色 tint 經共享材質漏去狐狸嗰邊。載入失敗會清快取，下次再試。
const _gltfCache = new Map();
function loadPetGltf(url) {
  let p = _gltfCache.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url).catch(e => { _gltfCache.delete(url); throw e; });
    _gltfCache.set(url, p);
  }
  return p;
}

const MODELS = {
  // 狼暫用狐模型頂住（tint 已取消：Fox 得一個材質＋橙色貼圖，material.color 係乘上去，
  // 灰藍 tint 會將橙毛壓成暗啡、白色嘴／尾尖變灰藍，睇落似爛程式後備——v13 診斷證實；
  // 用返狐狸原色先靚，等搵到真狼 GLB 再換）
  wolf: { url: "./assets/models/fox.glb", height: 1.02, tint: null },
  fox: { url: "./assets/models/fox.glb", height: 0.92, tint: null }
};

export function hasPetModel(species) { return !!MODELS[species]; }

export async function createPetModel(assistant) {
  const spec = MODELS[assistant.species];
  if (!spec) return null;

  const gltf = await loadPetGltf(spec.url);
  const model = cloneSkinned(gltf.scene);
  // 每隻實例用自己嘅材質（clone 預設共享材質，狼 tint 會漏去狐狸），
  // 材質保持原裝 MeshStandardMaterial（見檔頭註：Fox 無 NORMAL，轉 toon 會全黑）。
  // 載入失敗就根本唔行呢度，程式動物後備不變。
  model.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
    }
  });

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
