/* ═══════════════════════════════════════════════════════════
   beyond/solar.js — L1 太阳系层（艺术化 AU：r → 2.2·r^0.75）
   衰老太阳（米粒/黑子/耀斑/CME）· 程序化行星与光环 · 小行星带/
   柯伊伯带 · 彗星 · 黄道光 · 日球层顶 · 地球逃逸轨迹
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { makeSunMap, makeGasMap, makeNoise } from '../fx/models.js';
import { rng } from '../fx/kit.js';
import { auToScene, smoothstep } from './util.js';

/** 太阳位于 -X 方向 1 AU（压缩后 ≈ 2.2 单位）处；地球在原点 */
export const SUN_POS = new THREE.Vector3(-auToScene(1), 0, 0);

const PLANETS = [
  { name: 'MERCURY', rAU: .387, size: 1.1, days: 88, pal: [[168, 158, 148], [120, 112, 106], [190, 182, 172]], seed: 41 },
  { name: 'VENUS', rAU: .723, size: 1.8, days: 225, pal: [[228, 198, 142], [204, 168, 108], [240, 216, 168]], seed: 42 },
  { name: 'EARTH', rAU: 1.0, size: 0, days: 365 },   // 地球本体在 L0 原点，只画轨道标记
  { name: 'MARS', rAU: 1.524, size: 1.3, days: 687, pal: [[190, 106, 66], [150, 78, 50], [214, 140, 100]], seed: 43 },
  { name: 'JUPITER', rAU: 5.203, size: 5.6, days: 4333, gas: true, seed: 44 },
  { name: 'SATURN', rAU: 9.537, size: 4.6, days: 10759, gas: true, ring: true, seed: 45 },
  { name: 'URANUS', rAU: 19.19, size: 2.6, days: 30687, pal: [[158, 208, 218], [128, 184, 198], [186, 226, 232]], seed: 46 },
  { name: 'NEPTUNE', rAU: 30.07, size: 2.5, days: 60190, pal: [[70, 108, 200], [52, 84, 168], [98, 138, 224]], seed: 47 },
  { name: 'PLUTO', rAU: 39.48, size: .8, days: 90560, pal: [[196, 178, 152], [150, 134, 112], [214, 200, 176]], seed: 48 },
  { name: 'ERIS', rAU: 67.8, size: .8, days: 203830, pal: [[206, 202, 198], [168, 162, 158], [224, 220, 216]], seed: 49 },
];

export class L1Solar {
  constructor() {
    this.group = new THREE.Group();
    this.planets = [];
    this.build();
  }

  build() {
    const g = this.group;
    g.position.copy(SUN_POS);

    /* —— 衰老太阳 —— */
    const sunTex = new THREE.CanvasTexture(makeSunMap(512, 256, 3));
    sunTex.colorSpace = THREE.SRGBColorSpace;
    this.sunMat = new THREE.MeshBasicMaterial({ map: sunTex, fog: false });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(9.5, 48, 32), this.sunMat);
    g.add(this.sun);
    // 日冕辉光
    const coronaCanvas = document.createElement('canvas');
    coronaCanvas.width = coronaCanvas.height = 256;
    {
      const c = coronaCanvas.getContext('2d');
      const grad = c.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255,240,210,.9)');
      grad.addColorStop(.3, 'rgba(255,170,70,.4)');
      grad.addColorStop(1, 'rgba(255,120,30,0)');
      c.fillStyle = grad; c.fillRect(0, 0, 256, 256);
    }
    const coronaTex = new THREE.CanvasTexture(coronaCanvas);
    coronaTex.colorSpace = THREE.SRGBColorSpace;
    this.corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coronaTex, color: 0xffb867, transparent: true, depthWrite: false, fog: false,
      blending: THREE.NormalBlending, opacity: .95,
    }));
    this.corona.scale.setScalar(52);
    g.add(this.corona);
    // CME 脉球
    this.cme = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coronaTex, color: 0xf08a3c, transparent: true, depthWrite: false, fog: false,
      blending: THREE.NormalBlending, opacity: 0,
    }));
    this.cme.scale.setScalar(70);
    this.cme.position.set(6, 4, 2);
    g.add(this.cme);

    /* —— 行星 —— */
    for (const p of PLANETS) {
      const orbitR = auToScene(p.rAU);
      // 轨道线
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = i / 128 * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR));
      }
      const orbit = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x4d87a5, transparent: true, opacity: .65, fog: false })
      );
      g.add(orbit);
      if (p.size === 0) { // 地球轨道标记
        const marker = new THREE.Mesh(new THREE.SphereGeometry(.8, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0x7fdcff, fog: false }));
        marker.position.set(auToScene(1), 0, 0);
        g.add(marker);
        this.earthMarker = marker;
        continue;
      }
      // 贴图
      let tex;
      if (p.gas) {
        const pal = p.name === 'JUPITER'
          ? [[214, 186, 152], [168, 128, 92], [226, 204, 172], [142, 100, 72], [200, 168, 134], [232, 214, 188]]
          : [[226, 206, 160], [196, 172, 122], [238, 224, 190], [172, 146, 104], [214, 196, 158]];
        tex = new THREE.CanvasTexture(makeGasMap(512, 256, pal, p.seed, p.name === 'JUPITER'));
      } else {
        const N = makeNoise(p.seed);
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
        const ctx = cv.getContext('2d');
        const img = ctx.createImageData(256, 128), d = img.data;
        for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
          const i = (y * 256 + x) * 4;
          const n = N.fbm(x / 256 * 6, y / 128 * 3, 4);
          const c = n > .55 ? p.pal[2] : n > .4 ? p.pal[0] : p.pal[1];
          d[i] = c[0] * (.8 + n * .4); d[i + 1] = c[1] * (.8 + n * .4); d[i + 2] = c[2] * (.8 + n * .4); d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        tex = new THREE.CanvasTexture(cv);
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.size, 32, 24),
        new THREE.MeshStandardMaterial({ map: tex, roughness: .9 })
      );
      if (p.ring) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(p.size * 1.4, p.size * 2.3, 64),
          new THREE.MeshBasicMaterial({ color: 0xcbb890, side: THREE.DoubleSide, transparent: true, opacity: .55, fog: false })
        );
        ring.rotation.x = Math.PI / 2 - .3;
        mesh.add(ring);
      }
      g.add(mesh);
      this.planets.push({ def: p, mesh, orbitR, angle: rng(p.seed)() * Math.PI * 2 });
    }

    /* —— 小行星带 / 柯伊伯带 —— */
    const mkBelt = (rIn, rOut, count, size, color, thick) => {
      const pos = new Float32Array(count * 3);
      const rr = rng(rIn * 7 | 0);
      for (let i = 0; i < count; i++) {
        const a = rr() * Math.PI * 2;
        const r = auToScene(rIn + rr() * (rOut - rIn));
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = (rr() - .5) * thick;
        pos[i * 3 + 2] = Math.sin(a) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return new THREE.Points(geo, new THREE.PointsMaterial({
        color, size, transparent: true, opacity: .5, depthWrite: false, fog: false,
      }));
    };
    this.asteroidBelt = mkBelt(2.1, 3.3, 1400, 1.2, 0x6f6252, .6);
    this.kuiperBelt = mkBelt(34, 48, 2600, 1.4, 0x5c7c92, 1.6);
    g.add(this.asteroidBelt, this.kuiperBelt);

    /* —— 彗星（离子尾 + 尘埃尾） —— */
    this.comet = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(.7, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xdff4ff, fog: false }));
    this.comet.add(head);
    const tailGeo = new THREE.ConeGeometry(2.2, 26, 10, 1, true);
    tailGeo.translate(0, -13, 0);
    const ionTail = new THREE.Mesh(tailGeo, new THREE.MeshBasicMaterial({
      color: 0x3f9ad4, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false, fog: false,
      blending: THREE.NormalBlending,
    }));
    const dustTail = ionTail.clone();
    dustTail.material = ionTail.material.clone();
    dustTail.material.color.set(0xffd9a0);
    dustTail.scale.set(1.5, .8, 1.5);
    this.comet.add(ionTail, dustTail);
    this._ionTail = ionTail; this._dustTail = dustTail;
    this.cometA = .3;
    g.add(this.comet);

    /* —— 日球层顶 —— */
    const hpGeo = new THREE.SphereGeometry(1, 48, 32);
    this.hpU = { uAmt: { value: 1 }, uColor: { value: new THREE.Color(0x6fa8d8) } };
    const hp = new THREE.Mesh(hpGeo, new THREE.ShaderMaterial({
      uniforms: this.hpU,
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vN; varying vec3 vV;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        precision mediump float;
        #include <logdepthbuf_pars_fragment>
        varying vec3 vN; varying vec3 vV;
        uniform float uAmt; uniform vec3 uColor;
        void main() {
          float rim = pow(1.0 - abs(dot(vN, vV)), 2.4);
          float a = rim * .55 * uAmt;
          gl_FragColor = vec4(uColor * .68, a);
          #include <logdepthbuf_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
    }));
    hp.scale.setScalar(auToScene(120));
    hp.renderOrder = 4;
    this.heliopause = hp;
    g.add(hp);

    /* —— 黄道光（太阳附近薄盘） —— */
    const zGeo = new THREE.RingGeometry(auToScene(.3), auToScene(1.6), 48);
    const zodi = new THREE.Mesh(zGeo, new THREE.MeshBasicMaterial({
      color: 0xd9b47a, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false, fog: false,
      blending: THREE.NormalBlending,
    }));
    zodi.rotation.x = Math.PI / 2;
    g.add(zodi);

    /* —— 地球逃逸轨迹（螺旋外扩，从 1AU 到 130AU） —— */
    const esc = [];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const r = auToScene(1 + t * 129);
      const a = t * Math.PI * 4.6;
      esc.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    this.escapeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(esc),
      new THREE.LineDashedMaterial({ color: 0xffb46a, transparent: true, opacity: .55, dashSize: 3, gapSize: 2, fog: false })
    );
    this.escapeLine.computeLineDistances();
    g.add(this.escapeLine);
  }

  /** @param st { t, year, timeScale(rad/day→rad/s 已折算), speedMode } */
  update(dt, st) {
    // 行星公转：orbSpeed = 基准（365 天行星的 rad/s），短周期行星按比例加速
    for (const p of this.planets) {
      p.angle += dt * st.orbSpeed * (365.25 / p.def.days);
      p.mesh.position.set(Math.cos(p.angle) * p.orbitR, 0, Math.sin(p.angle) * p.orbitR);
      p.mesh.rotation.y += dt * .1;
    }
    this.earthMarker.position.set(auToScene(1), 0, 0);
    // 太阳衰老：year 越大越红越胀（叙事夸张化）
    const age = smoothstep(2078, 2580, st.year);
    const s = 1 + age * .55 + Math.sin(st.t * 1.3) * .012;
    this.sun.scale.setScalar(s);
    this.sunMat.color.setHSL(.09 - age * .05, .35 + age * .5, .78 - age * .16);
    this.corona.scale.setScalar(52 * (1 + age * .8));
    this.corona.material.color.setHSL(.07 - age * .04, .8, .72 - age * .12);
    // CME：随机脉动
    if (!this._cmeT || st.t > this._cmeT) {
      this._cmeT = st.t + 6 + Math.random() * 9;
      this._cmeA = st.t; // 触发时刻
    }
    const cp = clamp((st.t - this._cmeA) / 4.5, 0, 1);
    this.cme.material.opacity = (1 - cp) * .7 * (0.4 + age * .6);
    this.cme.scale.setScalar(40 + cp * 60);
    // 彗星：绕日椭圆 + 尾巴背日
    this.cometA += dt * .05 * st.orbSpeed / 40;
    const ca = this.cometA, cr = auToScene(.6 + (Math.sin(ca) * .5 + .5) * 22);
    this.comet.position.set(Math.cos(ca * 1.7) * cr, Math.sin(ca) * 3, Math.sin(ca * 1.7) * cr);
    const away = this.comet.position.clone().normalize();
    this._ionTail.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), away);
    this._dustTail.quaternion.copy(this._ionTail.quaternion);
    this._dustTail.rotateZ(.3);
  }
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
