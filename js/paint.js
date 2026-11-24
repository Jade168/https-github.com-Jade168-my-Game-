// js/paint.js — 第 3 步：canvas 手繪／漸變貼圖（報告 §5#3＋§2.1）
// 淨色就係而家個場睇落「普通低模」嘅主因；動漫／吉卜力感嚟自貼圖——
// 哪怕好簡單嘅貼圖都得：垂直漸變＋柔和色斑／筆觸＋畫入貼圖嘅陰影面／AO
// （Genshin 教訓：陰影畫入貼圖，唔係靠即時光照計出嚟）。
// 做法：每種材質一張 CanvasTexture，程式生成、唔使入倉新素材（GitHub Pages
// 繼續零素材檔）；同一顏色＋同一種畫法只生成一次，快取住，換星球重建島嗰陣重用。
// 目標對照：吉卜力式手繪山丘——山坡一撻撻手繪色斑、花田、暖光紅頂小屋。
// 注意：狐狸豁免（Fox.glb 冇 NORMAL，轉 toon 會變黑，第 4 步先試補法線）；
// 程式動物後備／VRM 主角／天空／發光件唔喺呢步範圍。
import * as THREE from "three";
import { TOON_RAMP } from "./toon.js";

const SIZE = 256;
const _cache = new Map(); // key: kind:hex -> MeshToonMaterial（生成一次，重用）

// 由字串種子出 deterministic 亂數：同一個星球／同一隻色每次畫出嚟都一樣
function rngFrom(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const _c = new THREE.Color();
function hexOf(color) { return "#" + _c.set(color).getHexString(); }
// 向白（>0）或向黑（<0）偏移 amt（0–1），回傳 #rrggbb
function shade(color, amt) {
  const c = new THREE.Color(color);
  if (amt >= 0) c.lerp(new THREE.Color(0xffffff), amt);
  else c.lerp(new THREE.Color(0x000000), -amt);
  return "#" + c.getHexString();
}
function mkCanvas() {
  const cv = document.createElement("canvas");
  cv.width = SIZE; cv.height = SIZE;
  return [cv, cv.getContext("2d")];
}
// 柔和色斑：徑向漸變圓，邊緣化開（水彩感）
function blob(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
// 垂直漸變底
function vGrad(ctx, top, mid, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
}

// --- 各種畫法（每種回傳已畫好嘅 canvas）---
// 地面（島頂圓盤用）：底色＋大撻手繪色斑＋花田碎點＋畫入去嘅陰影面＋邊緣 AO
function paintGround(base, rng) {
  const [cv, ctx] = mkCanvas();
  ctx.fillStyle = base; ctx.fillRect(0, 0, SIZE, SIZE);
  // 大撻色斑：鄰近綠色深淺交錯（吉卜力山坡嗰種一撻撻）
  for (let i = 0; i < 16; i++) {
    blob(ctx, rng() * SIZE, rng() * SIZE, 28 + rng() * 62,
      rng() > 0.5 ? shade(base, 0.22 + rng() * 0.12) : shade(base, -(0.14 + rng() * 0.12)),
      0.10 + rng() * 0.08);
  }
  // 暖陽光斑：左上大片柔和暖光
  blob(ctx, SIZE * 0.28, SIZE * 0.22, 110, "#fff3b0", 0.10);
  // 花田碎點：粉／黃／白／紫小花，成簇散佈
  const dots = ["#ff9ec7", "#ffd166", "#ffffff", "#c39bff", "#ff8c69"];
  for (let cl = 0; cl < 7; cl++) {
    const cx = rng() * SIZE, cy = rng() * SIZE;
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.45 + rng() * 0.45;
      ctx.fillStyle = dots[Math.floor(rng() * dots.length)];
      ctx.beginPath();
      ctx.arc(cx + (rng() - 0.5) * 56, cy + (rng() - 0.5) * 56, 1 + rng() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // 畫入去嘅陰影面：右下柔和深色（太陽喺左上，影喺右下），唔靠即時光照
  blob(ctx, SIZE * 0.82, SIZE * 0.85, 130, shade(base, -0.35), 0.12);
  // 邊緣 AO：圓盤邊一圈暗返少少，島面唔會成塊平色
  const rim = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.32, SIZE / 2, SIZE / 2, SIZE * 0.72);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(1, "rgba(20,40,20,0.20)");
  ctx.fillStyle = rim; ctx.fillRect(0, 0, SIZE, SIZE);
  return cv;
}
// 島身側面：垂直漸變＋垂落草痕
function paintGroundSide(base, rng) {
  const [cv, ctx] = mkCanvas();
  vGrad(ctx, shade(base, 0.18), base, shade(base, -0.45));
  for (let i = 0; i < 12; i++) {
    const x = rng() * SIZE;
    ctx.globalAlpha = 0.10 + rng() * 0.10;
    ctx.strokeStyle = shade(base, -(0.2 + rng() * 0.2));
    ctx.lineWidth = 4 + rng() * 8;
    ctx.beginPath(); ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rng() - 0.5) * 24, SIZE * 0.4, x + (rng() - 0.5) * 24, SIZE * 0.7, x, SIZE);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return cv;
}
// 通用：垂直漸變＋柔和色斑（葉／櫻花／牆／石用）
function paintBlotch(base, rng, light = 0.25, dark = -0.18, n = 10) {
  const [cv, ctx] = mkCanvas();
  vGrad(ctx, shade(base, light), base, shade(base, dark));
  for (let i = 0; i < n; i++) {
    blob(ctx, rng() * SIZE, rng() * SIZE, 22 + rng() * 48,
      rng() > 0.5 ? shade(base, light + rng() * 0.15) : shade(base, dark - rng() * 0.12),
      0.10 + rng() * 0.08);
  }
  return cv;
}
// 櫻花：粉漸變＋深粉色斑＋白色花瓣碎點
function paintSakura(base, rng) {
  const cv = paintBlotch(base, rng, 0.22, -0.12, 9);
  const ctx = cv.getContext("2d");
  for (let i = 0; i < 46; i++) {
    ctx.globalAlpha = 0.35 + rng() * 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(rng() * SIZE, rng() * SIZE, 1 + rng() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return cv;
}
// 屋頂：垂直漸變＋橫向瓦片紋（深線＋亮線一對）＋簷底陰影＋頂脊亮邊
function paintRoof(base, rng) {
  const [cv, ctx] = mkCanvas();
  vGrad(ctx, shade(base, 0.22), base, shade(base, -0.32));
  // 頂脊亮邊
  ctx.globalAlpha = 0.25; ctx.fillStyle = shade(base, 0.45);
  ctx.fillRect(0, 0, SIZE, 10); ctx.globalAlpha = 1;
  // 瓦片橫紋：每行深線＋下面一條亮線，營造手繪瓦片感
  for (let y = 30; y < SIZE; y += 30) {
    ctx.globalAlpha = 0.28; ctx.fillStyle = shade(base, -0.4);
    ctx.fillRect(0, y, SIZE, 4);
    ctx.globalAlpha = 0.16; ctx.fillStyle = shade(base, 0.4);
    ctx.fillRect(0, y + 4, SIZE, 3);
    // 每行錯開嘅直向接縫
    ctx.globalAlpha = 0.12; ctx.fillStyle = shade(base, -0.35);
    const off = (y / 30) % 2 ? 16 : 0;
    for (let x = off; x < SIZE; x += 32) ctx.fillRect(x, y, 3, 26);
  }
  ctx.globalAlpha = 1;
  // 簷底陰影
  const g = ctx.createLinearGradient(0, SIZE - 44, 0, SIZE);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = g; ctx.fillRect(0, SIZE - 44, SIZE, 44);
  return cv;
}
// 樹幹：垂直漸變＋深色樹皮直紋＋淺色高光紋
function paintTrunk(base, rng) {
  const [cv, ctx] = mkCanvas();
  vGrad(ctx, shade(base, 0.15), base, shade(base, -0.3));
  for (let i = 0; i < 11; i++) {
    const x = rng() * SIZE;
    ctx.globalAlpha = 0.18 + rng() * 0.12;
    ctx.strokeStyle = shade(base, -(0.25 + rng() * 0.2));
    ctx.lineWidth = 2 + rng() * 4;
    ctx.beginPath(); ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rng() - 0.5) * 14, SIZE * 0.33, x + (rng() - 0.5) * 14, SIZE * 0.66, x + (rng() - 0.5) * 10, SIZE);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const x = rng() * SIZE;
    ctx.globalAlpha = 0.12 + rng() * 0.08;
    ctx.strokeStyle = shade(base, 0.35);
    ctx.lineWidth = 2 + rng() * 3;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (rng() - 0.5) * 12, SIZE); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return cv;
}
// 岩石：垂直漸變＋深色斑＋短裂紋
function paintRock(base, rng) {
  const cv = paintBlotch(base, rng, 0.18, -0.25, 8);
  const ctx = cv.getContext("2d");
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.22 + rng() * 0.1;
    ctx.strokeStyle = shade(base, -0.5);
    ctx.lineWidth = 2 + rng() * 2;
    const x = rng() * SIZE, y = rng() * SIZE;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 60); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return cv;
}
// 雲：白底＋底部藍灰陰影＋柔和灰藍色斑（動漫雲下面係有色嘅，唔係死白）
function paintCloud(rng) {
  const [cv, ctx] = mkCanvas();
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.62, "#f4f8ff"); g.addColorStop(1, "#dbe7f5");
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 6; i++) {
    blob(ctx, rng() * SIZE, SIZE * (0.55 + rng() * 0.4), 26 + rng() * 40, "#b9cde8", 0.14 + rng() * 0.08);
  }
  blob(ctx, SIZE * 0.3, SIZE * 0.2, 90, "#ffffff", 0.5);
  return cv;
}

const PAINTERS = {
  ground: paintGround, groundSide: paintGroundSide, leaf: paintBlotch,
  sakura: paintSakura, wall: paintBlotch, roof: paintRoof,
  trunk: paintTrunk, rock: paintRock, cloud: paintCloud
};

// 主入口：攞一件手繪貼圖材質。color 係底色（貼圖畫滿實色，材質色設白，
// 唔用 color×map 雙重上色）；kind 係畫法；seedKey 令同色同畫法畫出嚟一樣。
// MeshToonMaterial＋TOON_RAMP 不變（第 2 步嘅統一色階繼續生效）。
export function painted(color, kind) {
  const hex = hexOf(color);
  const key = kind + ":" + hex;
  const hit = _cache.get(key);
  if (hit) return hit;
  const painter = PAINTERS[kind] || paintBlotch;
  const rng = rngFrom(key);
  const cv = kind === "cloud" ? painter(rng) : painter(hex, rng);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; // albedo 貼圖：sRGB（main.js renderer 係 SRGB＋ACES）
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, map: tex, gradientMap: TOON_RAMP });
  _cache.set(key, mat);
  return mat;
}
