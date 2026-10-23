/* ═══════════════════════════════════════════════════════════
   beyond/galaxy.js — L2 银河层（太阳在原点 · 猎户臂）
   近景：程序化星点（带视差）+ 银河带天幕；
   远景：与全景对齐的 3D 银河——四旋臂棒旋、尘埃带、HII 区、
   球状星团、麦哲伦云。拉远时星空视差 → 3D 银河连续交接。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { makeStarfield, makeSkyDome } from '../fx/models.js';
import { rng } from '../fx/kit.js';
import { smoothstep } from './util.js';

const LY = 26;              // 1 光年 = 26 场景单位（银河半径 5 万 ly ≈ 1.3e6）

export class L2Galaxy {
  constructor(quality = 'high') {
    this.group = new THREE.Group();
    this.fadeU = { value: 0 };
    this.build(quality);
  }

  build(quality) {
    /* —— 近景星空（浅色星图风，带视差）+ 银河带天幕 —— */
    this.stars = makeStarfield(quality === 'high' ? 7000 : 3500, 2.6e4, 11, true);
    this.group.add(this.stars);
    this.sky = makeSkyDome(21, true);
    this.group.add(this.sky);

    /* —— 3D 银河（远离后浮现） —— */
    const gal = new THREE.Group();
    this.galaxy = gal;
    this.group.add(gal);
    const rand = rng(20778);

    // 银河坐标系：银心在 -X 方向 26,700 ly（太阳在猎户臂，银心与人马臂之间）
    const GC = new THREE.Vector3(-26700 * LY, -60, 0);
    gal.position.copy(GC);

    // 盘星：对数螺旋 4 臂 + 棒
    const N_DISK = quality === 'high' ? 46000 : 20000;
    const pos = new Float32Array(N_DISK * 3);
    const col = new Float32Array(N_DISK * 3);
    const size = new Float32Array(N_DISK);
    const c = new THREE.Color();
    const ARMS = 4;
    for (let i = 0; i < N_DISK; i++) {
      const inBar = i < N_DISK * .14;
      let r, armA;
      if (inBar) {
        r = Math.pow(rand(), 1.6) * 7000;
        armA = (rand() - .5) * .8;
      } else {
        r = 6500 + Math.pow(rand(), .62) * 44500;
        const arm = Math.floor(rand() * ARMS);
        armA = arm / ARMS * Math.PI * 2 + Math.log(r / 6500) * 2.9 + (rand() - .5) * .55;
      }
      const thick = Math.exp(-r / 26000) * 900 + 130;
      const x = Math.cos(armA) * r + (rand() - .5) * 600;
      const z = Math.sin(armA) * r + (rand() - .5) * 600;
      pos[i * 3] = x;
      pos[i * 3 + 1] = (rand() - .5) * thick + (r > 30000 ? (rand() - .5) * 900 : 0);
      pos[i * 3 + 2] = z;
      // 恒星配色（星图风：深青墨为主，臂缘年轻蓝、内圈暖橙）
      const t = rand();
      if (t > .8) c.setHSL(.58, .5, .30);
      else if (t > .55) c.setHSL(.09, .5, .34);
      else c.setHSL(.56, .26, .16 + rand() * .18);
      if (r < 9000) c.lerp(new THREE.Color(.72, .42, .18), .4);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = .5 + Math.pow(rand(), 4) * 3.4;
    }
    this._addPoints(gal, pos, col, size, N_DISK, 1, 'disk');

    // 尘埃带（沿臂内缘的暗红棕薄点）
    const N_DUST = quality === 'high' ? 7000 : 3000;
    const dpos = new Float32Array(N_DUST * 3), dcol = new Float32Array(N_DUST * 3), dsize = new Float32Array(N_DUST);
    for (let i = 0; i < N_DUST; i++) {
      const r = 7500 + Math.pow(rand(), .6) * 42000;
      const arm = Math.floor(rand() * ARMS);
      const armA = arm / ARMS * Math.PI * 2 + Math.log(r / 6500) * 2.9 - .18 + (rand() - .5) * .3;
      dpos[i * 3] = Math.cos(armA) * r;
      dpos[i * 3 + 1] = (rand() - .5) * 300;
      dpos[i * 3 + 2] = Math.sin(armA) * r;
      dcol[i * 3] = .30; dcol[i * 3 + 1] = .17; dcol[i * 3 + 2] = .10;
      dsize[i] = 3 + rand() * 5;
    }
    this._addPoints(gal, dpos, dcol, dsize, N_DUST, .8, 'dust');

    // HII 区（恒星形成区的粉色/青色亮斑）
    const N_HII = 320;
    const hpos = new Float32Array(N_HII * 3), hcol = new Float32Array(N_HII * 3), hsize = new Float32Array(N_HII);
    for (let i = 0; i < N_HII; i++) {
      const r = 8000 + rand() * 40000;
      const arm = Math.floor(rand() * ARMS);
      const armA = arm / ARMS * Math.PI * 2 + Math.log(r / 6500) * 2.9 + .12 + (rand() - .5) * .2;
      hpos[i * 3] = Math.cos(armA) * r;
      hpos[i * 3 + 1] = (rand() - .5) * 500;
      hpos[i * 3 + 2] = Math.sin(armA) * r;
      const pink = rand() > .5;
      hcol[i * 3] = pink ? .86 : .24; hcol[i * 3 + 1] = pink ? .32 : .48; hcol[i * 3 + 2] = pink ? .46 : .82;
      hsize[i] = 6 + rand() * 12;
    }
    this._addPoints(gal, hpos, hcol, hsize, N_HII, .55, 'hii');

    // 球状星团（银心晕内 24 团）
    const N_GC = 24, per = 160;
    const gpos = new Float32Array(N_GC * per * 3), gcol = new Float32Array(N_GC * per * 3), gsize = new Float32Array(N_GC * per);
    let gi = 0;
    for (let k = 0; k < N_GC; k++) {
      const gr = 9000 + rand() * 42000;
      const ga = rand() * Math.PI * 2, ge = (rand() - .5) * Math.PI;
      const cx = Math.cos(ga) * Math.cos(ge) * gr, cy = Math.sin(ge) * gr * .8, cz = Math.sin(ga) * Math.cos(ge) * gr;
      for (let j = 0; j < per; j++) {
        const rr = Math.pow(rand(), 2.2) * 480;
        const a1 = rand() * Math.PI * 2, a2 = Math.acos(rand() * 2 - 1);
        gpos[gi * 3] = cx + Math.sin(a2) * Math.cos(a1) * rr;
        gpos[gi * 3 + 1] = cy + Math.cos(a2) * rr;
        gpos[gi * 3 + 2] = cz + Math.sin(a2) * Math.sin(a1) * rr;
        gcol[gi * 3] = .62; gcol[gi * 3 + 1] = .42; gcol[gi * 3 + 2] = .2;
        gsize[gi] = .6 + Math.pow(rand(), 3) * 2;
        gi++;
      }
    }
    this._addPoints(gal, gpos, gcol, gsize, gi, .9, 'gc');

    // 麦哲伦云（两个不规则伴星系）
    for (const [name, off, sz] of [['LMC', new THREE.Vector3(7000, -14000, 38000), 6000], ['SMC', new THREE.Vector3(12000, -17000, 46000), 3800]]) {
      const n = quality === 'high' ? 3600 : 1500;
      const mpos = new Float32Array(n * 3), mcol = new Float32Array(n * 3), msize = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const rr = Math.pow(rand(), 1.7) * sz;
        const a1 = rand() * Math.PI * 2, a2 = Math.acos(rand() * 2 - 1);
        mpos[i * 3] = off.x + Math.sin(a2) * Math.cos(a1) * rr;
        mpos[i * 3 + 1] = off.y + Math.cos(a2) * rr * .7;
        mpos[i * 3 + 2] = off.z + Math.sin(a2) * Math.sin(a1) * rr;
        const t = rand();
        if (t > .85) { mcol[i * 3] = .82; mcol[i * 3 + 1] = .34; mcol[i * 3 + 2] = .42; }
        else { mcol[i * 3] = .32; mcol[i * 3 + 1] = .42; mcol[i * 3 + 2] = .58; }
        msize[i] = .6 + Math.pow(rand(), 3) * 2.6;
      }
      this._addPoints(gal, mpos, mcol, msize, n, .75, name);
    }

    // 银心辉光（浅底上的暖橙柔斑）
    const bulge = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xf2b06a, transparent: true, opacity: .0, depthWrite: false, fog: false,
      blending: THREE.NormalBlending,
    }));
    bulge.position.set(0, 0, 0);
    bulge.scale.set(5200, 3600, 1);
    bulge.material.opacity = .5;
    bulge.userData.galFade = true;
    gal.add(bulge);

    // 太阳位置标记（猎户臂小分支上的脉冲点）
    const sunMk = new THREE.Mesh(
      new THREE.SphereGeometry(60, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, fog: false })
    );
    sunMk.position.copy(GC.clone().negate()); // 太阳相对银心 = -GC
    this.sunMark = sunMk;
    gal.add(sunMk);
    const ringMk = new THREE.Mesh(
      new THREE.RingGeometry(130, 160, 40),
      new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: .8, side: THREE.DoubleSide, fog: false })
    );
    ringMk.rotation.x = Math.PI / 2;
    sunMk.add(ringMk);
    this.sunRing = ringMk;
  }

  _addPoints(parent, pos, col, size, count, opacity, name) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPix: { value: 1 }, uFade: { value: 1 } },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec3 aCol; attribute float aSize;
        varying vec3 vCol; varying float vFade;
        uniform float uPix; uniform float uFade;
        void main() {
          vCol = aCol; vFade = uFade;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPix;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        precision mediump float;
        #include <logdepthbuf_pars_fragment>
        varying vec3 vCol; varying float vFade;
        void main() {
          vec2 uv = gl_PointCoord - .5;
          float r = length(uv);
          if (r > .5) discard;
          float a = smoothstep(.5, .05, r) * vFade;
          gl_FragColor = vec4(vCol, a);
          #include <logdepthbuf_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    mat.fog = false;
    const pts = new THREE.Points(geo, mat);
    pts.name = name;
    pts.frustumCulled = false;
    pts.renderOrder = -8;
    pts.userData.uFade = mat.uniforms.uFade;
    parent.add(pts);
    return pts;
  }

  /** camDist：相机到原点（太阳/地球）距离（场景单位） */
  update(dt, t, camDist) {
    // 3D 银河淡入（>0.8 光年视距后渐显）
    const fade = smoothstep(0.45 * 2.6e4, 1.4 * 2.6e4, camDist);
    this.galaxy.traverse(o => {
      if (o.userData.uFade) o.userData.uFade.value = fade;
      if (o.userData.galFade) o.material.opacity = fade * .5;
    });
    this.galaxy.visible = fade > .01;
    this.sunMark.visible = fade > .5;
    this.sunRing.scale.setScalar(1 + Math.sin(t * 2) * .18);
    // 近景星空始终在（拉远时相对变小形成视差交接）
    this.stars.visible = camDist < 4.5e5;
    this.sky.visible = camDist < 8e4;
  }
}
