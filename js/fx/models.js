/* ═══════════════════════════════════════════════════════════
   fx/models.js — 资产工厂
   · 程序化行星贴图（地球昼夜/云、月面、气巨、恒星）——canvas 生成，
     离线可用，零外链；亦是 GLB/外链贴图加载失败时的兜底路径。
   · 星空 / 银河带天幕。
   · GLB 加载封装（仓库未随附模型时自动走程序化）。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { rng } from './kit.js';

/* ---------- 确定性 2D 值噪声 ---------- */
export function makeNoise(seed = 7) {
  const rand = rng(seed);
  const p = new Uint8Array(256).map((_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rand();
  const fade = (t) => t * t * (3 - 2 * t);
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const h = (a, b) => vals[perm[(perm[(a & 255)] + (b & 255)) & 511] & 255];
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  function fbm(x, y, oct = 5, lac = 2.03, gain = .5) {
    let s = 0, amp = .5, tot = 0, fx = x, fy = y;
    for (let i = 0; i < oct; i++) { s += vnoise(fx, fy) * amp; tot += amp; amp *= gain; fx *= lac; fy *= lac; }
    return s / tot;
  }
  return { vnoise, fbm, rand };
}

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}
/** 横向无缝：末端 12% 与首端交叉淡化 */
function seamless(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const fw = (w * .12) | 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < fw; x++) {
      const t = x / fw;
      const a = (y * w + x) * 4, b = (y * w + (w - fw + x)) * 4;
      for (let k = 0; k < 3; k++) {
        const va = d[a + k], vb = d[b + k];
        d[a + k] = va * t + vb * (1 - t);
        d[b + k] = vb * t + va * (1 - t);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
function toTexture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer?.capabilities?.maxTextureSize ? 8 : 4);
  return t;
}

/* ---------- 地球贴图组 ---------- */
export function makeEarthMaps(w = 1024, h = 512, seed = 42) {
  const N = makeNoise(seed);
  const [dayC, day] = canvas2d(w, h);
  const [nightC, night] = canvas2d(w, h);
  const [cloudC, cloud] = canvas2d(w, h);
  const dImg = day.createImageData(w, h), nImg = night.createImageData(w, h), cImg = cloud.createImageData(w, h);
  const dd = dImg.data, nd = nImg.data, cd = cImg.data;
  const lights = makeNoise(seed + 9);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    const lat = (0.5 - v) * Math.PI;         // +北
    const polar = Math.abs(lat) / (Math.PI / 2); // 0 赤道 → 1 极
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const i = (y * w + x) * 4;
      // 大陆形状：fbm 域扭曲
      const wx = N.fbm(u * 6, v * 3, 4) * 1.7;
      const wy = N.fbm(u * 6 + 5.2, v * 3 + 1.3, 4) * 1.7;
      const c01 = N.fbm(u * 5 + wx, v * 2.5 + wy, 6);
      const land = c01 > .523;
      const coast = Math.abs(c01 - .523) < .02;

      let r, g, b;
      if (land) {
        const elev = (c01 - .523) / .477;
        const veg = N.fbm(u * 11 + 3, v * 7 + 8, 5);
        // 苔原 → 植被 → 荒漠 → 山地
        if (veg > .62) { r = 168 + veg * 40; g = 140 + veg * 50; b = 96 + veg * 30; }
        else if (veg > .45) { r = 52 + elev * 30; g = 92 + elev * 40; b = 48; }
        else { r = 88 + veg * 60; g = 96 + veg * 40; b = 70; }
        // 高海拔雪
        if (elev > .55) { const s = (elev - .55) / .45; r += (225 - r) * s; g += (230 - g) * s; b += (238 - b) * s; }
      } else {
        const dep = Math.min(1, (.523 - c01) / .3);
        r = 14 + (1 - dep) * 26; g = 40 + (1 - dep) * 40; b = 78 + (1 - dep) * 55;
        if (coast) { r += 26; g += 30; b += 22; }
      }
      // 极冠（海陆均冰封）
      const iceEdge = .78 + N.vnoise(u * 9, v * 6) * .14;
      if (polar > iceEdge) {
        const s = Math.min(1, (polar - iceEdge) / .08);
        r += (232 - r) * s; g += (242 - g) * s; b += (250 - b) * s;
      }
      dd[i] = r; dd[i + 1] = g; dd[i + 2] = b; dd[i + 3] = 255;

      // 夜灯：陆地 × 集群噪声 × 中低纬
      const cluster = lights.fbm(u * 13, v * 7, 4);
      let L = 0;
      if (land && polar < iceEdge - .04 && polar < .72) {
        if (cluster > .585) {
          const dot = lights.vnoise(u * 90, v * 46);
          L = Math.max(0, (dot - .3)) * (cluster - .585) * 6;
        }
      }
      nd[i] = Math.min(255, L * 255); nd[i + 1] = Math.min(255, L * 205); nd[i + 2] = Math.min(255, L * 130); nd[i + 3] = 255;

      // 云：拉伸 fbm 条带
      const cl = N.fbm(u * 7 + N.fbm(u * 3, v * 6, 3) * 2.2, v * 9, 5);
      const cv = Math.max(0, (cl - .5)) * 2.2;
      cd[i] = cd[i + 1] = cd[i + 2] = 255;
      cd[i + 3] = Math.min(255, cv * 255 * .85);
    }
  }
  day.putImageData(dImg, 0, 0); night.putImageData(nImg, 0, 0); cloud.putImageData(cImg, 0, 0);
  seamless(day, w, h); seamless(night, w, h); seamless(cloud, w, h);
  return { dayC, nightC, cloudC };
}

/* ---------- 月面 ---------- */
export function makeMoonMap(w = 512, h = 256, seed = 77) {
  const N = makeNoise(seed);
  const [c, ctx] = canvas2d(w, h);
  const img = ctx.createImageData(w, h), d = img.data;
  const craters = [];
  for (let i = 0; i < 60; i++) craters.push({ x: N.rand() * w, y: N.rand() * h, r: 3 + N.rand() * N.rand() * 26 });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const base = N.fbm(x / w * 8, y / h * 4, 5);
    let v = 96 + base * 78;
    for (const cr of craters) {
      const dx = Math.min(Math.abs(x - cr.x), w - Math.abs(x - cr.x));
      const dy = y - cr.y;
      const dd2 = Math.sqrt(dx * dx + dy * dy);
      if (dd2 < cr.r) {
        const f = dd2 / cr.r;
        v += (f > .8 ? 30 : -22) * (1 - f); // 环缘亮、内部暗
      }
    }
    v = Math.max(30, Math.min(220, v));
    d[i] = v; d[i + 1] = v * .98; d[i + 2] = v * .94; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); seamless(ctx, w, h);
  return c;
}

/* ---------- 气态行星（条带+风暴） ---------- */
export function makeGasMap(w = 512, h = 256, palette, seed = 5, storm = true) {
  const N = makeNoise(seed);
  const P = palette.map(([r, g, b]) => [r, g, b]);
  const [c, ctx] = canvas2d(w, h);
  const img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const warp = N.fbm(x / w * 4, y / h * 3, 4) * .5;
    const band = (y / h + warp * .16) * P.length * 2.6;
    const bi = Math.max(0, Math.min(P.length - 1, Math.floor(band)));
    const bf = band - Math.floor(bi);
    const sm = bf * .5 * (1 - .5) * 4; // smoothstep(0.5)
    const a = P[bi], b2 = P[Math.min(P.length - 1, bi + 1)];
    const t = Math.min(1, Math.max(0, sm));
    let r = a[0] + (b2[0] - a[0]) * t, g = a[1] + (b2[1] - a[1]) * t, b = a[2] + (b2[2] - a[2]) * t;
    const turb = N.fbm(x / w * 9, y / h * 14, 4);
    const shade = .82 + turb * .36;
    r *= shade; g *= shade; b *= shade;
    if (storm) {
      const sx = .68, sy = .62, dx = (x / w - sx) * 2.1, dy = (y / h - sy);
      const e = dx * dx + dy * dy * 5.5;
      if (e < .05) {
        const f = 1 - e / .05;
        r += (210 - r) * f * .8; g += (140 - g) * f * .8; b += (90 - b) * f * .8;
      }
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); seamless(ctx, w, h);
  return c;
}

/* ---------- 恒星（米粒组织） ---------- */
export function makeSunMap(w = 512, h = 256, seed = 3) {
  const N = makeNoise(seed);
  const [c, ctx] = canvas2d(w, h);
  const img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const gran = N.fbm(x / w * 16, y / h * 8, 5);
    const spots = N.fbm(x / w * 3 + 9, y / h * 1.5 + 4, 4);
    let r = 255, g = 172 + gran * 60, b = 66 + gran * 70;
    if (spots > .62) { const s = (spots - .62) / .38; r -= s * 150; g -= s * 150; b -= s * 110; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); seamless(ctx, w, h);
  return c;
}

/* ---------- 星空 ---------- */
export function makeStarfield(count = 6000, radius = 3e4, seed = 11) {
  const rand = rng(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // 均匀球面
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(th) * s * radius;
    pos[i * 3 + 1] = u * radius;
    pos[i * 3 + 2] = Math.sin(th) * s * radius;
    const mag = Math.pow(rand(), 3.2);
    size[i] = .5 + mag * 2.6;
    const temp = rand();
    if (temp > .85) c.setHSL(.58, .5, .8);
    else if (temp > .7) c.setHSL(.08, .6, .75);
    else c.setHSL(.6, .08, .7 + mag * .3);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPix: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec3 aCol; attribute float aSize;
      varying vec3 vCol;
      uniform float uPix;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vCol = aCol;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPix;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      #include <logdepthbuf_pars_fragment>
      void main() {
        vec2 uv = gl_PointCoord - .5;
        float r = length(uv);
        if (r > .5) discard;
        float a = smoothstep(.5, .05, r);
        gl_FragColor = vec4(vCol, a);
        #include <logdepthbuf_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  mat.fog = false;
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -10;
  return pts;
}

/* ---------- 银河带天幕（近黑球幕 + 淡银河带） ---------- */
export function makeSkyDome(seed = 21) {
  const N = makeNoise(seed);
  const [c, ctx] = canvas2d(1024, 512);
  ctx.fillStyle = '#010208'; ctx.fillRect(0, 0, 1024, 512);
  const img = ctx.getImageData(0, 0, 1024, 512), d = img.data;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) {
    const i = (y * 1024 + x) * 4;
    const band = Math.exp(-Math.pow((y / 512 - .46), 2) * 26);
    const n = N.fbm(x / 1024 * 7, y / 512 * 5, 5);
    const glow = Math.max(0, band * (n - .42)) * 1.5;
    d[i] = Math.min(255, 6 + glow * 120);
    d[i + 1] = Math.min(255, 8 + glow * 96);
    d[i + 2] = Math.min(255, 16 + glow * 70);
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  seamless(ctx, 1024, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4.4e4, 48, 32),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  dome.renderOrder = -20;
  return dome;
}

/* ---------- GLB 加载（含程序化兜底） ---------- */
let gltfLoader = null;
export function getGLTFLoader(renderer) {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    try {
      const draco = new DRACOLoader();
      draco.setDecoderPath('./vendor/draco/');
      gltfLoader.setDRACOLoader(draco);
    } catch (e) { /* 无解码器时普通 GLB 仍可加载 */ }
  }
  return gltfLoader;
}
/** 尝试加载 GLB；任何失败走 fallback() 程序化构建 */
export async function loadGLBOr(url, fallback) {
  try {
    const gltf = await new Promise((res, rej) => {
      getGLTFLoader().load(url, res, undefined, rej);
    });
    return gltf.scene;
  } catch (e) {
    console.warn('[models] GLB fallback for', url, e?.message || e);
    return fallback();
  }
}

export { toTexture };
