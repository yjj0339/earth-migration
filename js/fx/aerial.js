/* ═══════════════════════════════════════════════════════════
   fx/aerial.js — 行星尺度空气透视
   所有受光材质统一的大气雾（FogExp2），近景淡、远景吞没于大气色。
   自发光/加法材质（星空、光柱）应置 material.fog = false。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';

export function createAerial(scene, opts = {}) {
  const fog = new THREE.FogExp2(opts.color ?? 0x0a1e33, opts.density ?? .0009);
  scene.fog = fog;
  return {
    fog,
    setDensity(d) { fog.density = d; },
    setColor(c) { fog.color.set(c); },
    /** 按相机高度动态调密度：贴地浓、轨道上淡 */
    update(camPos, planetCenter, planetR, base = .0016) {
      const h = camPos.distanceTo(planetCenter) - planetR;
      const f = Math.exp(-Math.max(h, 0) / (planetR * .35));
      fog.density = base * f * f;
    },
  };
}
