/* ═══════════════════════════════════════════════════════════
   fx/volplume.js — 体积等离子光柱（ray-marching）
   行星发动机 11,000 km 蓝色光柱：核心亮白 → 青蓝边缘，
   噪声扰动 + 高度衰减，在地球曲面上保持体积感。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec3 vObj;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vObj = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */`
precision highp float;
#include <logdepthbuf_pars_fragment>
varying vec3 vObj;
uniform vec3 uCamObj;      // 相机在柱体本地空间的位置
uniform float uTime;
uniform float uHeight;     // 柱高（本地单位）
uniform float uRadius;     // 基部半径
uniform float uIntensity;
uniform float uFlare;      // 底部喷口扩张
uniform vec3 uCore;        // 核心色
uniform vec3 uEdge;        // 边缘色
uniform float uSteps;

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  return noise(p) * .55 + noise(p * 2.3) * .28 + noise(p * 5.1) * .17;
}

/** 光线 x 无限圆柱（轴 = Y）相交 → [t0, t1]，未命中返回 false */
bool cylHit(vec3 ro, vec3 rd, float rad, out float t0, out float t1) {
  float a = rd.x * rd.x + rd.z * rd.z;
  if (a < 1e-7) { t0 = 0.0; t1 = 0.0; return false; }
  float b = ro.x * rd.x + ro.z * rd.z;
  float c = ro.x * ro.x + ro.z * ro.z - rad * rad;
  float h = b * b - a * c;
  if (h < 0.0) return false;
  h = sqrt(h);
  t0 = (-b - h) / a; t1 = (-b + h) / a;
  return true;
}

void main() {
  // 本地空间视线
  vec3 ro = uCamObj;
  vec3 rd = normalize(vObj - uCamObj);

  float margin = uRadius * 1.55 + uFlare * uRadius * 2.4;
  float t0, t1;
  if (!cylHit(ro, rd, margin, t0, t1)) discard;
  t0 = max(t0, 0.0);
  // 高度裁剪：射线与 y=0 / y=uHeight 平面的交点压缩步进区间
  float ty0 = 1e9, ty1 = 1e9;
  if (abs(rd.y) > 1e-6) {
    float ta = (0.0 - ro.y) / rd.y;
    float tb = (uHeight - ro.y) / rd.y;
    ty0 = min(ta, tb); ty1 = max(ta, tb);
    t0 = max(t0, ty0); t1 = min(t1, ty1);
  }
  if (t1 <= t0) discard;

  int STEPS = int(uSteps);
  float dt = (t1 - t0) / float(STEPS);
  vec3 acc = vec3(0.0);
  float trans = 1.0;

  for (int i = 0; i < 64; i++) {
    if (i >= STEPS || trans < .015) break;
    float t = t0 + dt * (float(i) + .5);
    vec3 p = ro + rd * t;
    float hFrac = clamp(p.y / uHeight, 0.0, 1.0);

    // 柱体随高度扩张（喷流锥）+ 底部强烈喷口
    float rad = uRadius * (1.0 + hFrac * 1.3 + (1.0 - hFrac) * (1.0 - hFrac) * uFlare * 3.0);
    float r = length(p.xz);
    if (r > rad) continue;

    // 径向密度：核心致密，边缘湍流
    float rn = r / max(rad, 1e-4);
    float core = exp(-rn * rn * 3.2);
    float turb = fbm(vec3(p.x * 3.0, p.y * .42 - uTime * 2.6, p.z * 3.0));
    float density = core * (0.42 + turb * .75);
    // 高度衰减：底部最亮，往上渐稀但顶端保持可见束
    density *= mix(1.0, .30, pow(hFrac, .8));
    density *= 1.0 - smoothstep(.86, 1.0, hFrac) * .55;

    // 颜色：核心白热 → 青蓝
    vec3 c = mix(uCore, uEdge, clamp(rn * 1.35, 0.0, 1.0));
    c *= (1.0 + turb * .5);

    float a = 1.0 - exp(-density * dt * 2.3);
    acc += c * a * trans * uIntensity;
    trans *= (1.0 - a);
  }

  if (max(acc.r, max(acc.g, acc.b)) < .004) discard;
  // 浅色场景：普通混合，亮度即透明度（白底上呈现深青光束）
  float a = clamp(max(acc.r, max(acc.g, acc.b)) * 1.15, 0.0, .92);
  gl_FragColor = vec4(acc, a);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * 创建体积光柱。
 * @param opts { radius, height, intensity, flare, core, edge, steps }
 * @returns { mesh, uniforms, tick(camera, t) }
 */
export function createPlume(opts = {}) {
  const radius = opts.radius ?? 1;
  const height = opts.height ?? 8;
  const uniforms = {
    uCamObj: { value: new THREE.Vector3(0, 999, 0) },
    uTime: { value: 0 },
    uHeight: { value: height },
    uRadius: { value: radius },
    uIntensity: { value: opts.intensity ?? 1 },
    uFlare: { value: opts.flare ?? .22 },
    uCore: { value: new THREE.Color(opts.core ?? 0xeaf6ff) },
    uEdge: { value: new THREE.Color(opts.edge ?? 0x1470a8) },
    uSteps: { value: opts.steps ?? 26 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.CylinderGeometry(radius * 2.7, radius * 2.7, height, 24, 1, true);
  geo.translate(0, height / 2, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  // 复用向量：热路径零分配
  const camWorld = new THREE.Vector3();
  return {
    mesh, uniforms,
    setIntensity(v) { uniforms.uIntensity.value = v; },
    setSteps(v) { uniforms.uSteps.value = v; },
    tick(camera, t) {
      uniforms.uTime.value = t;
      camera.getWorldPosition(camWorld);
      uniforms.uCamObj.value.copy(mesh.worldToLocal(camWorld));
    },
  };
}
