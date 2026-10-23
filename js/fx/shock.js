/* ═══════════════════════════════════════════════════════════
   fx/shock.js — 点火冲击波
   威尔逊凝聚云穹（半球膨胀 fresnel 壳）+ 地面尘埃环扩散。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const DOME_FRAG = /* glsl */`
precision mediump float;
#include <logdepthbuf_pars_fragment>
varying vec3 vN;
varying vec3 vW;
uniform float uProg;   // 0→1
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float rim = pow(1.0 - abs(dot(V, normalize(vN))), 2.6);
  float a = rim * uOpacity * (1.0 - uProg);
  a *= smoothstep(0.0, .12, uProg);            // 起始瞬间最亮后衰减
  a *= 1.0 - smoothstep(.55, 1.0, uProg) * .9; // 末期消散
  gl_FragColor = vec4(uColor * (1.4 + uProg), a);
  #include <logdepthbuf_fragment>
}
`;
const BASIC_VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;
const RING_FRAG = /* glsl */`
precision mediump float;
#include <logdepthbuf_pars_fragment>
varying vec2 vUv;
uniform float uProg;
uniform float uOpacity;
uniform vec3 uColor;
void main() {
  // ring uv.y: 内0 外1 → 环带随进度外扩、变淡
  float band = smoothstep(0.0, .25, vUv.y) * (1.0 - smoothstep(.55, 1.0, vUv.y));
  float head = 1.0 - smoothstep(.0, .35, abs(vUv.y - .78)); // 尘埃锋面
  float a = (band * .45 + head * .8) * uOpacity * (1.0 - uProg);
  a *= smoothstep(0.0, .07, uProg);
  gl_FragColor = vec4(uColor * (1.2 + head), a);
  #include <logdepthbuf_fragment>
}
`;
const RING_VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

/** 一次可复用的冲击波（trigger 重触发） */
export class Shockwave {
  constructor(opts = {}) {
    this.duration = opts.duration ?? 6;
    this.group = new THREE.Group();
    this.prog = 2; // >1 = idle

    this.domeMax = opts.domeRadius ?? 10;
    this.ringMax = opts.ringRadius ?? this.domeMax * 1.7;

    this.domeUniforms = {
      uProg: { value: 0 },
      uOpacity: { value: opts.opacity ?? .9 },
      uColor: { value: new THREE.Color(opts.color ?? 0xcfe8ff) },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.ShaderMaterial({
        vertexShader: BASIC_VERT, fragmentShader: DOME_FRAG,
        uniforms: this.domeUniforms,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    dome.renderOrder = 7;
    this.dome = dome;
    this.group.add(dome);

    this.ringUniforms = {
      uProg: { value: 0 },
      uOpacity: { value: (opts.opacity ?? .9) * .8 },
      uColor: { value: new THREE.Color(opts.dustColor ?? 0xd8c9a8) },
    };
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.4, 1, 64, 1),
      new THREE.ShaderMaterial({
        vertexShader: RING_VERT, fragmentShader: RING_FRAG,
        uniforms: this.ringUniforms,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 7;
    this.ring = ring;
    this.group.add(ring);
    this.group.visible = false;
  }

  trigger() { this.prog = 0; this.group.visible = true; }

  update(dt) {
    if (this.prog > 1) { this.group.visible = false; return; }
    this.prog += dt / this.duration;
    const p = Math.min(this.prog, 1);
    const ease = 1 - Math.pow(1 - p, 2.2); // 先快后慢
    this.dome.scale.setScalar(Math.max(.01, this.domeMax * ease));
    this.domeUniforms.uProg.value = p;
    const rr = Math.max(.01, this.ringMax * ease);
    this.ring.scale.setScalar(rr);
    this.ringUniforms.uProg.value = p;
  }
}
