/* ═══════════════════════════════════════════════════════════
   beyond/util.js — 尺度换算与数学工具
   L0 行星层 1u=63.7km · L1 太阳系层 艺术化AU · L2 银河层 光年
   ═══════════════════════════════════════════════════════════ */
export const KM = 1 / 63.7;                 // L0: km → unit（地球半径 100u）
export const EARTH_R = 100;
export const GEO_R = 562;                   // 35,786 km 同步轨道
export const AU_KM = 1.496e8;
export const LY_KM = 9.461e12;

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const easeIO = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** L1 艺术化轨道半径：r_AU → 场景单位（压缩 2.2·r^0.75，太阳系整体可同屏） */
export const auToScene = (rAU) => 2.2 * Math.pow(rAU, .75);

/** 视距（场景单位）→ 尺度标签层级 */
export const LAYER = { PLANET: 0, ORBIT: 1, SOLAR: 2, INTERSTELLAR: 3, GALAXY: 4 };
export const SCALE_RANGE = [300, 3e3, 3e4, 6e4]; // 层边界（场景单位）

/** 格式化：大数距离（km→AU→LY 自适应） */
export function fmtDist(km) {
  if (km < 1e6) return `${(km).toLocaleString('en-US', { maximumFractionDigits: 0 })} KM`;
  if (km < 0.05 * LY_KM) return `${(km / AU_KM).toFixed(2)} AU`;
  return `${(km / LY_KM).toFixed(2)} LY`;
}
/** 光行时 */
export function fmtLightTime(km) {
  const s = km / 299792.458;
  if (s < 90) return `${s.toFixed(0)} S`;
  if (s < 5400) return `${(s / 60).toFixed(1)} MIN`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} H`;
  return `${(s / 86400).toFixed(1)} D`;
}
export function fmtSpeed(kms) {
  if (kms < 1000) return `${kms.toFixed(1)} KM/S`;
  return `${(kms / 299792.458 * 100).toFixed(3)}% C`;
}
/** 任务年 → 显示（2078-4578） */
export const yearStr = (y) => `Y${String(Math.floor(y)).padStart(4, '0')}`;
