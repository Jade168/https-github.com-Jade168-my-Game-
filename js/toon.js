// js/toon.js — 全場共用嘅一條 3 段 toon ramp（第 2 步，報告 §5#2）
// 之前世界／程式動物／GLB 後備公仔各用自己一條 ramp（[90,170,245]／[70,150,235]），
// 光暗反應唔一致；Fox GLB 更加用 MeshStandardMaterial，成個場光感唔統一。
// 而家全部用呢一個 DataTexture 實例：3 段 [0.62, 0.85, 1.0]，NearestFilter——
// 最暗一段都留 62% 光，陰影帶色唔會死黑（配合第 1 步嘅暖太陽＋有色陰影）。
// VRM 主角繼續用 MToon（角色專用 shader，唔喺呢條 ramp 之內）；
// 天空（ShaderMaterial）、窗光／眼球／描邊（MeshBasicMaterial）係發光／無光照，唔用 ramp。
import * as THREE from "three";

const STEPS = new Uint8Array([158, 217, 255]); // 0.62 / 0.85 / 1.0
export const TOON_RAMP = new THREE.DataTexture(STEPS, STEPS.length, 1, THREE.RedFormat);
TOON_RAMP.minFilter = THREE.NearestFilter; // 必須 Nearest，Linear 會將分段磨滑晒
TOON_RAMP.magFilter = THREE.NearestFilter;
TOON_RAMP.generateMipmaps = false;
TOON_RAMP.colorSpace = THREE.NoColorSpace;
TOON_RAMP.needsUpdate = true;

// 程式幾何用：new MeshToonMaterial({ color, gradientMap: TOON_RAMP, ...opts })
export function toonMaterial(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: TOON_RAMP, ...opts });
}

// GLB 載入模型用：將 MeshStandardMaterial 等轉做 MeshToonMaterial，
// 貼圖／顏色／透明度保留（Fox 橙毛貼圖唔會唔見），只係光暗反應改用同一條 ramp。
// 骨骼動畫唔受影響（MeshToonMaterial 同樣支援 skinning）。
export function toonFromStandard(mat) {
  if (!mat) return mat;
  if (mat.isMeshToonMaterial) return mat;
  return new THREE.MeshToonMaterial({
    color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
    map: mat.map || null,
    normalMap: mat.normalMap || null,
    emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
    emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1,
    transparent: !!mat.transparent,
    opacity: mat.opacity !== undefined ? mat.opacity : 1,
    alphaTest: mat.alphaTest || 0,
    side: mat.side !== undefined ? mat.side : THREE.FrontSide,
    gradientMap: TOON_RAMP
  });
}
