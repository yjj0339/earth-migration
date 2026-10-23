/* ═══════════════════════════════════════════════════════════
   fx/smoke.js — 导流槽尾烟与光柱蒸汽粒子
   GPU 驱动循环生命周期：每粒子带 seed，顶点着色器算漂移。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const VERT = /* glsl */`
attribute vec4 aSeed; // x: 相位  y: 速率  z: 尺寸  w: 方向角
uniform float uTime;
uniform float uRise;     // 上升高度
uniform float uSpread;   // 水平扩散
uniform float uSize;
uniform float uPix;
varying float vFade;
varying float vSeed;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  float life = fract(aSeed.x + uTime * aSeed.y);
  vFade = sin(life * 3.14159);
  vSeed = aSeed.x;
  float ang = aSeed.w * 6.2831;
  vec3 p = position;
  float drift = pow(life, 1.6);
  p.y += life * uRise;
  p.x += cos(ang) * drift * uSpread * (0.4 + fract(aSeed.z * 7.7));
  p.z += sin(ang) * drift * uSpread * (0.4 + fract(aSeed.z * 3.3));
  // 湍流摆动
  p.x += sin(uTime * .6 + aSeed.x * 40.0) * drift * uSpread * .3;
  p.z += cos(uTime * .5 + aSeed.x * 31.0) * drift * uSpread * .3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float grow = 1.0 + life * 2.6;
  gl_PointSize = uSize * aSeed.z * grow * uPix / max(-mv.z, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */`
precision mediump float;
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
varying float vSeed;
void main() {
  vec2 uv = gl_PointCoord - .5;
  float r = length(uv);
  if (r > .5) discard;
  float soft = smoothstep(.5, .08, r);
  float a = soft * vFade * uOpacity;
  vec3 c = uColor * (0.75 + 0.25 * fract(vSeed * 13.7));
  gl_FragColor = vec4(c, a);
  #include <logdepthbuf_fragment>
}
`;

/** @param opts { count, color, rise, spread, size, opacity } */
export function createSmoke(opts = {}) {
  const count = opts.count ?? 90;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // 出生盘
    const a = Math.random() * 6.2831;
    const rr = Math.sqrt(Math.random()) * (opts.birth ?? 1);
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = 0;
    pos[i * 3 + 2] = Math.sin(a) * rr;
    seed[i * 4] = Math.random();
    seed[i * 4 + 1] = (opts.rate ?? .05) * (0.6 + Math.random() * .8);
    seed[i * 4 + 2] = 0.4 + Math.random() * 1.2;
    seed[i * 4 + 3] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));

  const uniforms = {
    uTime: { value: 0 },
    uRise: { value: opts.rise ?? 3 },
    uSpread: { value: opts.spread ?? 1.2 },
    uSize: { value: opts.size ?? 60 },
    uPix: { value: window.devicePixelRatio * 400 },
    uColor: { value: new THREE.Color(opts.color ?? 0x7fa3ba) },
    uOpacity: { value: opts.opacity ?? .22 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return {
    points, uniforms,
    tick(t) { uniforms.uTime.value = t; },
    setOpacity(v) { uniforms.uOpacity.value = v; },
  };
}
