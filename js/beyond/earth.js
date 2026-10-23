/* ═══════════════════════════════════════════════════════════
   beyond/earth.js — L0 地球层（1u = 63.7km）
   缓慢自转并逐渐冰封的地球 · 尾随半球发动机 · 同步环与电梯 ·
   舰队与观测站 · 弓形激波 · 尘埃流 · 月球
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { Kit, stdMaterials, rng } from '../fx/kit.js';
import { triplanarMaterial } from '../fx/triplanar.js';
import { createAtmosphere } from '../fx/atmosphere.js';
import { makeEarthMaps, makeMoonMap } from '../fx/models.js';
import { KM, EARTH_R, GEO_R, clamp, smoothstep } from './util.js';
import { buildFlagship, buildClimber, buildMidway, buildObservatory } from './craft.js';

const DEG = Math.PI / 180;
const latLonDir = (lat, lon) => new THREE.Vector3(
  Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG)
);

export class L0Earth {
  constructor(opts = {}) {
    this.group = new THREE.Group();
    this.triMats = [];
    this.plumes = opts.plumes || [];
    this.quality = opts.quality || 'high';
    this._spin = 0;
    this.build(opts);
  }

  build({ maps, moonCanvas }) {
    const g = this.group;
    const M = stdMaterials();

    /* —— 地球 —— */
    const dayTex = new THREE.CanvasTexture(maps.dayC); dayTex.colorSpace = THREE.SRGBColorSpace;
    const nightTex = new THREE.CanvasTexture(maps.nightC); nightTex.colorSpace = THREE.SRGBColorSpace;
    const cloudTex = new THREE.CanvasTexture(maps.cloudC); cloudTex.colorSpace = THREE.SRGBColorSpace;
    for (const t of [dayTex, nightTex, cloudTex]) t.wrapS = THREE.RepeatWrapping;
    this.earthMat = new THREE.ShaderMaterial({
      uniforms: {
        uDay: { value: dayTex }, uNight: { value: nightTex }, uCloud: { value: cloudTex },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 },
        uIce: { value: 0 }, uCity: { value: 1 },
      },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; varying vec3 vN;
        void main() {
          vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        #include <logdepthbuf_pars_fragment>
        varying vec2 vUv; varying vec3 vN;
        uniform sampler2D uDay, uNight, uCloud;
        uniform vec3 uSunDir; uniform float uTime, uIce, uCity;
        void main() {
          vec2 uv = vec2(fract(vUv.x + uTime * .0012), vUv.y);
          vec3 day = texture2D(uDay, uv).rgb;
          vec3 nightL = texture2D(uNight, uv).rgb;
          float cloud = texture2D(uCloud, vec2(fract(vUv.x + uTime * .0035), vUv.y)).a;
          float polar = abs(vUv.y - .5) * 2.0;
          float snowLine = smoothstep(.14 + uIce * .78, .30 + uIce * .78, polar);
          day = mix(day, vec3(.87, .92, .97), snowLine * min(uIce * 1.35, 1.0));
          vec3 N = normalize(vN);
          float ndl = dot(N, normalize(uSunDir));
          float dayAmt = smoothstep(-.09, .18, ndl);
          float dusk = exp(-abs(ndl) * 9.0);
          vec3 col = day * (dayAmt * 1.24 + .012);
          col += day * dusk * vec3(1.0, .45, .18) * .5;
          vec3 cloudCol = mix(vec3(.04,.055,.085), vec3(1.0), dayAmt);
          col = mix(col, cloudCol, cloud * .78 * (dayAmt * .85 + .15));
          float nightAmt = 1.0 - dayAmt;
          // 夜灯随冰封衰减（地下城）
          col += nightL * nightAmt * uCity * (1.0 - uIce * .7) * vec3(1.0, .82, .5) * 1.6;
          col += nightAmt * snowLine * vec3(.10,.16,.24) * uIce * .6;
          gl_FragColor = vec4(col, 1.0);
          #include <logdepthbuf_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 64), this.earthMat);
    g.add(this.earth);

    this.atmos = createAtmosphere({ radius: EARTH_R * 1.035, strength: 1.15 });
    g.add(this.atmos.mesh);

    /* —— 发动机（尾随半球，随点火进度点亮） —— */
    const probe = (() => {
      const ctx = maps.dayC.getContext('2d');
      const d = ctx.getImageData(0, 0, maps.dayC.width, maps.dayC.height).data;
      const w = maps.dayC.width, h = maps.dayC.height;
      return (lon01, lat01) => {
        const i = ((Math.min(h - 1, lat01 * h | 0)) * w + Math.min(w - 1, lon01 * w | 0)) * 4;
        return d[i + 2] <= d[i] + 12;
      };
    })();
    const rand = rng(2077);
    const sites = [];
    for (let i = 0; i < 2200 && sites.length < 300; i++) {
      const lat = 8 + rand() * 58, lon = rand() * 360;
      if (probe(lon / 360, (90 - lat) / 180)) sites.push([lat, lon]);
    }
    const kit = new Kit();
    for (const [la, lo] of sites) {
      const dir = latLonDir(la, lo);
      const pos = dir.clone().multiplyScalar(EARTH_R - .5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const e = new THREE.Euler().setFromQuaternion(q);
      const s = .8 + rng(la * 7 + lo)() * .7;
      kit.box('hullDark', s * 3, s * .7, s * 3, [pos.x, pos.y, pos.z], [e.x, e.y, e.z]);
      kit.cyl('hull', s * .45, s, s * 6.5, 6, [pos.x, pos.y, pos.z], [e.x, e.y, e.z]);
      kit.cyl('hot', s * .4, s * .6, s * .9, 6, [
        pos.x + dir.x * s * 7.3, pos.y + dir.y * s * 7.3, pos.z + dir.z * s * 7.3,
      ], [e.x, e.y, e.z]);
    }
    this.towers = kit.build(M);
    g.add(this.towers);

    // 光束实例
    const beamGeo = new THREE.CylinderGeometry(.22, 1, 1, 10, 1, true);
    beamGeo.translate(0, .5, 0);
    this.beamUniforms = {
      uTime: { value: 0 }, uPower: { value: 0 },
      uCore: { value: new THREE.Color(0xe8f8ff) }, uEdge: { value: new THREE.Color(0x2e9fd8) },
    };
    const beamMat = new THREE.ShaderMaterial({
      uniforms: this.beamUniforms,
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          vH = uv.y;
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        precision mediump float;
        #include <logdepthbuf_pars_fragment>
        varying float vH; varying vec3 vN; varying vec3 vV;
        uniform float uTime, uPower; uniform vec3 uCore, uEdge;
        void main() {
          float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
          float flick = .82 + .18 * sin(uTime * 7.0 + vH * 14.0);
          float a = (1.0 - vH) * edge * uPower * flick;
          gl_FragColor = vec4(mix(uCore, uEdge, vH) * a * 1.6, a);
          #include <logdepthbuf_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const beams = new THREE.InstancedMesh(beamGeo, beamMat, sites.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    sites.forEach(([la, lo], i) => {
      const dir = latLonDir(la, lo);
      q.setFromUnitVectors(up, dir);
      m4.compose(dir.clone().multiplyScalar(EARTH_R - 1), q, new THREE.Vector3(1, 30 + rng(la * 3 + lo * 11)() * 40, 1));
      beams.setMatrixAt(i, m4);
    });
    beams.frustumCulled = false; beams.renderOrder = 5;
    this.beams = beams;
    g.add(beams);

    /* —— 同步环 + 三座电梯 —— */
    const ringMat = triplanarMaterial({ base: 0x8b98ab, panelA: 0xb4c6d8, panelB: 0x3c4756, windowAmt: .9, windowScale: 2.2 });
    this.triMats.push(ringMat);
    const synch = new THREE.Mesh(new THREE.TorusGeometry(GEO_R, 1.1, 8, 128), ringMat);
    synch.rotation.x = Math.PI / 2;
    g.add(synch);
    this.synchRing = synch;

    this.climbers = [];
    for (const lon of [22, 118, 247]) {
      const dir = latLonDir(0, lon);
      const eg = new THREE.Group();
      eg.quaternion.setFromUnitVectors(up, dir);
      g.add(eg);
      const cableMat = new THREE.MeshStandardMaterial({ color: 0x5a6678, metalness: .9, roughness: .35 });
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, GEO_R - EARTH_R, 6, 1, true), cableMat);
      cable.position.y = EARTH_R + (GEO_R - EARTH_R) / 2;
      eg.add(cable);
      const apex = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), M.hullLight);
      apex.position.y = GEO_R;
      eg.add(apex);
      const mid = buildMidway();
      mid.position.y = EARTH_R + (GEO_R - EARTH_R) * .33;
      eg.add(mid);
      for (let i = 0; i < 2; i++) {
        const cl = buildClimber();
        cl.userData = { phase: i * .5 + lon * .01, up: i % 2 === 0 };
        eg.add(cl);
        this.climbers.push(cl);
      }
    }

    /* —— 舰队：领航者旗舰 + 护航 —— */
    this.flagship = buildFlagship(this.triMats);
    this.flagship.position.set(150, 60, -110);
    this.flagship.scale.setScalar(1.6);
    g.add(this.flagship);
    const fleet = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const fk = new Kit();
      fk.box('hullLight', 2.6, .7, .9);
      fk.cyl('hull', .3, .5, 1.8, 6, [1.3, 0, 0], [0, 0, Math.PI / 2]);
      fk.box('engineGlow', .45, .45, .45, [-1.5, 0, 0]);
      const s = fk.build(stdMaterials());
      const a = i / 5 * Math.PI * 2;
      s.position.set(Math.cos(a) * 90, Math.sin(i * 2.1) * 30, Math.sin(a) * 90 - 60);
      fleet.add(s);
    }
    this.fleet = fleet;
    g.add(fleet);

    /* —— 深空观测站 —— */
    this.obs = buildObservatory();
    this.obs.position.set(-260, 140, 320);
    g.add(this.obs);

    /* —— 弓形激波（星际段） —— */
    const shockGeo = new THREE.SphereGeometry(1, 40, 26);
    this.bowU = { uAmt: { value: 0 } };
    const bow = new THREE.Mesh(shockGeo, new THREE.ShaderMaterial({
      uniforms: this.bowU,
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
        uniform float uAmt;
        void main() {
          float rim = pow(1.0 - abs(dot(vN, vV)), 3.0);
          // 只保留朝 +X（航向）的弓形
          float facing = smoothstep(-.2, .9, vN.x);
          vec3 col = mix(vec3(.35,.75,1.0), vec3(1.0,.72,.4), pow(1.0 - vN.x, 2.0));
          float a = rim * facing * uAmt * .8;
          gl_FragColor = vec4(col * a * 1.6, a);
          #include <logdepthbuf_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    bow.scale.setScalar(EARTH_R * 2.3);
    bow.position.x = EARTH_R * .5;
    bow.renderOrder = 6;
    this.bow = bow;
    g.add(bow);

    /* —— 尘埃流（星际介质掠过） —— */
    const dustN = 400;
    const dp = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) {
      dp[i * 3] = (Math.random() - .5) * 900;
      dp[i * 3 + 1] = (Math.random() - .5) * 400;
      dp[i * 3 + 2] = (Math.random() - .5) * 900;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0x9fb8cc, size: 2.2, transparent: true, opacity: 0, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending,
    }));
    g.add(this.dust);

    /* —— 月球 —— */
    const mtex = new THREE.CanvasTexture(moonCanvas); mtex.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(27.3, 40, 28),
      new THREE.MeshStandardMaterial({ map: mtex, roughness: .96 }));
    this.moonAngle = .8;
    g.add(this.moon);
  }

  /** 当前发动机网络自转角（供地标目标换算） */
  spinY() { return this._spin; }

  /** @param st { t, year, enginePower, sunDir(局部), camDist, interstellar } */
  update(dt, st) {
    const g = this.group;
    // 自转：第 0 年刹停后基本不转
    this._spin += dt * .0035 * clamp((2081 - st.year) / 3, 0, 1);
    this.earth.rotation.y = this._spin;
    this.towers.rotation.y = this._spin;
    this.beams.rotation.y = this._spin;

    const ice = st.iceAmt;
    this.earthMat.uniforms.uIce.value = ice;
    this.earthMat.uniforms.uTime.value = st.t;
    this.atmos.setIce(ice);
    this.atmos.setSun(st.sunDirWorld || new THREE.Vector3(1, 0, 0));
    this.beamUniforms.uTime.value = st.t;
    this.beamUniforms.uPower.value = st.enginePower;

    // 攀爬器
    for (const c of this.climbers) {
      const u = c.userData;
      u.phase = (u.phase + dt / 70) % 1;
      c.position.y = EARTH_R + 6 + (GEO_R - EARTH_R - 14) * (u.up ? u.phase : 1 - u.phase);
      c.visible = Math.min(u.phase, 1 - u.phase) > .04;
    }
    // 舰队缓漂
    this.fleet.rotation.y += dt * .012;
    this.flagship.rotation.z = Math.sin(st.t * .1) * .04;
    // 月球
    this.moonAngle += dt * .004;
    this.moon.position.set(Math.cos(this.moonAngle) * 1500, 90, Math.sin(this.moonAngle) * 1500);
    // 弓形激波与尘埃（星际段强度）
    const bowAmt = smoothstep(2200, 2600, st.year) * (1 - smoothstep(4400, 4560, st.year));
    this.bowU.uAmt.value = bowAmt;
    this.dust.material.opacity = bowAmt * .5;
    if (bowAmt > 0) this.dust.rotation.y += dt * .05;
    // 远景时隐藏细小组件
    const far = st.camDist > 2400;
    this.fleet.visible = this.obs.visible = !far;
    this.synchRing.visible = st.camDist < 6200;
    this.climbers.forEach(c => c.visible = c.visible && st.camDist < 1200);
  }
}
