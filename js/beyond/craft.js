/* ═══════════════════════════════════════════════════════════
   beyond/craft.js — 英雄资产：攀爬器、桁架、枢纽站、领航者旗舰
   数百基元 kitbash → 按材质合并，个位数 draw call。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { Kit, stdMaterials } from '../fx/kit.js';
import { triplanarMaterial } from '../fx/triplanar.js';

/** 攀爬器（太空电梯用） */
export function buildClimber() {
  const M = stdMaterials();
  const k = new Kit();
  k.box('hullLight', 1.5, 2.4, 1.1);
  k.box('hullDark', 1.7, .5, 1.3, [0, 1.45, 0]);
  k.cyl('cyan', .18, .18, 2.2, 6, [.9, 0, 0], [0, 0, Math.PI / 2]);
  k.box('engineGlow', 1.2, .3, .9, [0, -1.3, 0]);
  return k.build(M);
}

/** 领航者级旗舰（国际空间站式桁架 + 模块串 + 引擎舱 + 天线阵） */
export function buildFlagship(triMats) {
  const M = stdMaterials();
  const k = new Kit();
  // 主桁架
  for (let i = 0; i < 11; i++) {
    k.box('hull', .3, .3, 1.2, [0, 0, -6 + i * 1.2]);
    if (i < 10) {
      k.box('hullDark', .14, 1.4, .14, [0, -.6, -5.4 + i * 1.2], [.8, 0, 0]);
      k.box('hullDark', .14, 1.4, .14, [0, .6, -5.4 + i * 1.2], [-.8, 0, 0]);
    }
  }
  // 模块串（居住/指挥/货舱）
  const mods = new Kit();
  const names = ['hullLight', 'hullLight', 'cyan', 'hullDark', 'hullLight', 'cyan'];
  names.forEach((m, i) => mods.cyl(m, .9, .9, 2.6, 10, [0, (i % 2 ? 1 : -1) * 1.55, -3.4 + i * 1.5], [Math.PI / 2, 0, 0]));
  // 太阳能板阵
  const panels = new Kit();
  for (let i = 0; i < 4; i++) {
    const z = -4.5 + i * 3;
    panels.box('cyan', 7.5, .06, 2.2, [4.6, .3, z]);
    panels.box('cyan', 7.5, .06, 2.2, [-4.6, .3, z]);
    panels.box('hullDark', 3.2, .2, .2, [4.6, .3, z]);
    panels.box('hullDark', 3.2, .2, .2, [-4.6, .3, z]);
  }
  // 引擎舱
  const eng = new Kit();
  for (let i = 0; i < 3; i++) {
    eng.cyl('hullDark', .55, .75, 2.4, 8, [(i - 1) * 1.35, 0, 7.2], [Math.PI / 2, 0, 0]);
    eng.cyl('engineGlow', .3, .3, .5, 8, [(i - 1) * 1.35, 0, 8.5], [Math.PI / 2, 0, 0]);
  }
  // 碟形天线
  const ant = new Kit();
  ant.cyl('hullLight', 1.5, .3, .9, 12, [0, 2.6, 1.5], [Math.PI / 2.4, 0, .3]);
  ant.cyl('hullDark', .08, .08, 1.8, 6, [0, 2.2, 1.2]);

  const grp = new THREE.Group();
  grp.add(k.build(M), mods.build(M), panels.build(M), eng.build(M), ant.build(M));
  // 桥楼窗灯
  const bridgeMat = triplanarMaterial({ base: 0x93a2b6, panelA: 0xbccce0, panelB: 0x39424f, windowAmt: 1.2, windowScale: .8 });
  triMats.push(bridgeMat);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.2, 2.8), bridgeMat);
  bridge.position.set(0, .9, -1.6);
  grp.add(bridge);
  return grp;
}

/** 中间站（电梯 1/3 高度） */
export function buildMidway() {
  const M = stdMaterials();
  const k = new Kit();
  k.cyl('hullLight', 1.4, 1.4, .7, 8, [0, 0, 0]);
  k.box('hullDark', 4.4, 1.5, 2.2, [0, 0, 0]);
  k.cyl('cyan', .5, .5, 2.4, 6, [2.6, 0, 0], [0, 0, Math.PI / 2]);
  return k.build(M);
}

/** 深空观测站 */
export function buildObservatory() {
  const M = stdMaterials();
  const k = new Kit();
  k.box('hull', 20, 1.2, 1.2, [0, 0, 0]);
  k.box('hull', 1.2, 1.2, 20, [0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    k.cyl('hullLight', 3.4, 3.8, 1, 12, [Math.cos(a) * 7, 1.8, Math.sin(a) * 7], [Math.PI / 2.7, 0, i]);
  }
  k.cyl('hullDark', .22, .3, 10, 6, [0, 5, 0]);
  k.sphere('hot', .7, [0, 10.4, 0]);
  return k.build(M);
}
