/* ═══════════════════════════════════════════════════════════
   fx/triplanar.js — 三平面 PBR + 程序化窗口灯光
   无 UV 几何体：按世界法线三平面采样程序化细节；
   emissive 窗户 = 网格哈希亮块，随视距/时间轻微闪烁。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';

export const TRIMAT_VERT = /* glsl */`
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vObjPos;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vObjPos = position;
  vWNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWPos, 1.0);
  #include <logdepthbuf_vertex>
}
`;

export const TRIMAT_FRAG = /* glsl */`
#include <logdepthbuf_pars_fragment>
uniform vec3 uBaseColor;
uniform vec3 uPanelA;
uniform vec3 uPanelB;
uniform vec3 uWindowColor;
uniform float uScale;        // 细节尺度（世界单位/格）
uniform float uWindowScale;  // 窗户格尺度
uniform float uRough;
uniform float uMetal;
uniform float uWindowAmt;    // 窗口强度 0..1
uniform float uTime;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vObjPos;

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec3(1,0,0)), c = hash(i + vec3(0,1,0)), d = hash(i + vec3(1,1,0));
  float e = hash(i + vec3(0,0,1)), g = hash(i + vec3(1,0,1)), h = hash(i + vec3(0,1,1)), k = hash(i + vec3(1,1,1));
  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
}

void main() {
  vec3 n = abs(vWNormal);
  vec3 w = n / (n.x + n.y + n.z + 1e-5);
  // 三平面：面板漆 + 噪声细节
  vec3 sp = vObjPos / uScale;
  float dxy = vnoise(vec3(sp.xy * 3.1, 0.0)), dyz = vnoise(vec3(sp.yz * 3.1, 1.7)), dzx = vnoise(vec3(sp.zx * 3.1, 3.3));
  float det = dxy * w.z + dyz * w.x + dzx * w.y;

  // 分色面板条纹（沿主轴刻线）
  float stripe = step(.5, fract(sp.y * .8 + det * .35 + vnoise(sp * .7) * .3));
  vec3 panel = mix(uPanelA, uPanelB, stripe);
  vec3 col = mix(uBaseColor, panel, .42);
  col *= .82 + det * .36;

  // 窗口灯光：世界格哈希，沿表面切平面取格
  vec3 gp = vObjPos / uWindowScale;
  vec3 cell = floor(gp);
  float lit = 0.0;
  float r1 = hash(cell), r2 = hash(cell + 7.7);
  if (r1 > .62) {
    vec3 f2 = fract(gp);
    float inX = step(.18, f2.x) * step(f2.x, .82);
    float inY = step(.22, f2.y) * step(f2.y, .78);
    float tw = .72 + .28 * sin(uTime * (0.4 + r2) + r1 * 40.0);
    lit = inX * inY * tw * step(r2, .85);
  }
  vec3 emissive = uWindowColor * lit * uWindowAmt * (1.0 - det * .4);

  float rough = clamp(uRough + det * .22, .05, 1.0);
  gl_FragColor = vec4(col, 1.0);

  // 简化光照：主光 + 环境 + 视线菲涅尔缘光（用于无场景灯的合成底座）
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 L = normalize(vec3(.5, .8, .6));
  float ndl = max(dot(vWNormal, L), 0.0);
  float fres = pow(1.0 - max(dot(V, vWNormal), 0.0), 3.0);
  vec3 ambient = mix(vec3(.05,.08,.13), vec3(.10,.14,.20), det);
  vec3 lit3 = col * (ambient + ndl * vec3(1.05, .98, .9) * 1.25) + fres * vec3(.35,.6,.85) * .35;
  lit3 += emissive * 2.4;
  gl_FragColor = vec4(lit3, 1.0);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** 生成一个三平面 PBR 站体材质 */
export function triplanarMaterial(opts = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: TRIMAT_VERT,
    fragmentShader: TRIMAT_FRAG,
    uniforms: {
      uBaseColor: { value: new THREE.Color(opts.base ?? 0x77828f) },
      uPanelA: { value: new THREE.Color(opts.panelA ?? 0x8fa0b4) },
      uPanelB: { value: new THREE.Color(opts.panelB ?? 0x3d4653) },
      uWindowColor: { value: new THREE.Color(opts.window ?? 0xbfe8ff) },
      uScale: { value: opts.scale ?? 2.2 },
      uWindowScale: { value: opts.windowScale ?? 1.5 },
      uRough: { value: opts.rough ?? .55 },
      uMetal: { value: opts.metal ?? .8 },
      uWindowAmt: { value: opts.windowAmt ?? .9 },
      uTime: { value: 0 },
    },
  });
  mat.userData.isTriplanar = true;
  return mat;
}

/** 每帧更新全部三平面材质时间 */
export function tickTriplanar(materials, t) {
  for (const m of materials) if (m.uniforms?.uTime) m.uniforms.uTime.value = t;
}
