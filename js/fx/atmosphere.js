/* ═══════════════════════════════════════════════════════════
   fx/atmosphere.js — Rayleigh + Mie 散射大气壳
   弧光（limb glow）、晨昏线过渡、大气厚度随视角变化。
   近似单次散射：视线切向光学深度 × 太阳侧向散射。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */`
precision highp float;
#include <logdepthbuf_pars_fragment>
varying vec3 vN;
varying vec3 vW;
uniform vec3 uSunDir;      // 世界空间太阳方向（指向太阳）
uniform vec3 uRayleigh;    // 散射色（青）
uniform vec3 uMie;         // 晨昏暖色
uniform float uStrength;
uniform float uIceAmt;     // 冰封程度 → 大气变薄变青白

void main() {
  vec3 N = normalize(vN);                     // 壳法线（朝外）
  vec3 V = normalize(cameraPosition - vW);    // 视线（指向相机）
  float ndv = dot(N, V);

  // 边缘增厚：掠射角光学深度更大（BackSide 壳：ndv < 0 在正面）
  float rim = pow(clamp(1.0 + ndv, 0.0, 1.0), 3.2);
  float body = clamp(-ndv, 0.0, 1.0);         // 正对行星的部分（薄大气）

  float sun = dot(N, uSunDir);
  float day = smoothstep(-0.12, 0.28, sun);
  // 晨昏带：|sun| 小的区域受前进散射（Mie）染色
  float twilight = exp(-abs(sun) * 5.5);

  // 浅色星图风：大气 = 昼侧白柔光 + 边缘深青细描边（制图感）+ 晨昏暖染
  vec3 glowCol = mix(uRayleigh, vec3(.92, .96, .99), .62);         // 白柔光为主
  vec3 inkCol = mix(uRayleigh, vec3(.05, .27, .40), .58);          // 深青描边
  vec3 col = glowCol * (rim * .55 + body * .16) * day;
  col = mix(col, inkCol, rim * rim * .85);                          // 最边缘压成深青线
  col += uMie * twilight * (rim * 1.1) * .5;
  col += uRayleigh * twilight * rim * .25;                          // 晨昏弧染

  // 冰封时大气稀薄、偏青白
  col = mix(col, vec3(.72, .84, .93), uIceAmt * .4);

  float alpha = clamp((rim * .9 + body * .14) * max(day, .1) + twilight * rim * .4, 0.0, 1.0);
  alpha *= uStrength;
  gl_FragColor = vec4(col, alpha);
  #include <logdepthbuf_fragment>
}
`;

/** @param opts { radius, sunDir, strength, rayleigh, mie } */
export function createAtmosphere(opts = {}) {
  const uniforms = {
    uSunDir: { value: (opts.sunDir ?? new THREE.Vector3(1, .2, .4)).clone().normalize() },
    uRayleigh: { value: new THREE.Color(opts.rayleigh ?? 0x4a9fd8) },
    uMie: { value: new THREE.Color(opts.mie ?? 0xff9a4a) },
    uStrength: { value: opts.strength ?? 1.15 },
    uIceAmt: { value: 0 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(opts.radius ?? 1.04, 64, 48),
    new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms,
      transparent: true, depthWrite: false, side: THREE.BackSide,
      blending: THREE.NormalBlending,
    })
  );
  mesh.renderOrder = 4;
  return {
    mesh, uniforms,
    setSun(dir) { uniforms.uSunDir.value.copy(dir).normalize(); },
    setIce(v) { uniforms.uIceAmt.value = v; },
    setStrength(v) { uniforms.uStrength.value = v; },
  };
}
