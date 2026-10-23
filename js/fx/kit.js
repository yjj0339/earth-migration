/* ═══════════════════════════════════════════════════════════
   fx/kit.js — kitbash 装配工具
   数百个基元按材质分组，mergeGeometries 合并成个位数 draw call。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** 确定性伪随机（mulberry32）——每次构建结果一致 */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kit 收集器：add(材质组, 几何, 变换) → build() 按材质合并 */
export class Kit {
  constructor() { this.groups = new Map(); }

  /** 添加一个基元。geo 为 THREE.BufferGeometry（会被复制变换，原 geo 可复用） */
  add(mat, geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
    const g = geo.clone();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    m.compose(new THREE.Vector3(...pos), q, new THREE.Vector3(...s || [1, 1, 1]));
    g.applyMatrix4(m);
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push(g);
    return this;
  }

  box(mat, w, h, d, pos, rot, scale) {
    return this.add(mat, Kit.G.box, pos, rot, [w, h, d]);
  }
  cyl(mat, rTop, rBot, h, seg, pos, rot, scale) {
    const key = `cyl${rTop}_${rBot}_${seg}`;
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false);
    return this.add(mat, g, pos, rot, scale);
  }
  sphere(mat, r, pos, scale) {
    return this.add(mat, Kit.G.sphere, pos, [0, 0, 0], typeof scale === 'number' ? [r, r, r] : (scale || [r, r, r]));
  }
  torus(mat, r, tube, pos, rot, scale) {
    const g = new THREE.TorusGeometry(r, tube, 8, 32);
    return this.add(mat, g, pos, rot, scale);
  }
  cone(mat, r, h, seg, pos, rot, scale) {
    const g = new THREE.ConeGeometry(r, h, seg);
    return this.add(mat, g, pos, rot, scale);
  }

  /** 合并构建：materials = { 组名: Material }，返回 Group（每个材质一个 Mesh） */
  build(materials) {
    const group = new THREE.Group();
    for (const [name, geos] of this.groups) {
      const mat = materials[name] || materials.default;
      if (!mat) continue;
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = name;
      group.add(mesh);
    }
    return group;
  }
}

/** 共享基元（单位尺寸，add 时用 scale 缩放） */
Kit.G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 20, 14),
};

/** 常用 PBR 材质库（深空金属 + 警示涂装） */
export function stdMaterials() {
  const M = {
    hull: new THREE.MeshStandardMaterial({ color: 0x8a97a8, metalness: .85, roughness: .42 }),
    hullDark: new THREE.MeshStandardMaterial({ color: 0x39424f, metalness: .8, roughness: .55 }),
    hullLight: new THREE.MeshStandardMaterial({ color: 0xc9d4e2, metalness: .7, roughness: .38 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xb06a1e, metalness: .4, roughness: .5, emissive: 0x331b00 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x0d5f7a, metalness: .6, roughness: .35, emissive: 0x0a3346 }),
    engineGlow: new THREE.MeshStandardMaterial({
      color: 0xbfeaff, emissive: 0x9fdcff, emissiveIntensity: 2.6,
      metalness: 0, roughness: .3,
    }),
    hot: new THREE.MeshStandardMaterial({
      color: 0xffdcae, emissive: 0xffb46a, emissiveIntensity: 3.2,
      metalness: 0, roughness: .4,
    }),
    rock: new THREE.MeshStandardMaterial({ color: 0x6b6560, metalness: .05, roughness: .95 }),
    ice: new THREE.MeshStandardMaterial({ color: 0xbfe6f5, metalness: .1, roughness: .25 }),
    default: new THREE.MeshStandardMaterial({ color: 0x777777, metalness: .6, roughness: .5 }),
  };
  return M;
}
