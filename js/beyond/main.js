/* ═════════════════════════════════════════════════════════════════════
   BEYOND THE WANDERING EARTH · beyond/main.js
   渲染底座 · 三层尺度阶梯调度（连续交接）· 影片/自由相机 ·
   目的地飞行 · 时间压缩 · 遥测与事件日志 · 配乐
   ═════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { L0Earth } from './earth.js';
import { L1Solar, SUN_POS } from './solar.js';
import { L2Galaxy } from './galaxy.js';
import { buildPost } from './post.js';
import { BeyondAudio } from './audio.js';
import { Dash, DESTS } from './dash.js';
import { CHAPTERS, FILM_TOTAL, FILM_EVENTS, yearAt, distKmAt, speedAt, bindFollow } from './story.js';
import { makeEarthMaps, makeMoonMap } from '../fx/models.js';
import { tickTriplanar } from '../fx/triplanar.js';
import { KM, EARTH_R, GEO_R, AU_KM, LY_KM, clamp, lerp, smoothstep, fmtDist, fmtLightTime, fmtSpeed } from './util.js';

const $ = (id) => document.getElementById(id);
const isMobile = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
const QUALITY = isMobile ? 'low' : 'high';
const LYU = 26; // 1 ly = 26 单位（与 galaxy.js 一致）

const S = {
  mode: 'explore', year: 2078, t: 0,
  enginePower: 0, iceAmt: 0, speedMode: 1, orbSpeed: 0,
  hudOn: true, soundOn: true, fps: 60,
  distKm: AU_KM, vel: 29.8, focusName: 'EARTH',
  camDist: 500,
};
let renderer, scene, camera, controls, post, clock;
let L0, L1, L2, dash, audio, sunLight;

/* ═══════════ 启动 ═══════════ */
async function boot() {
  const setStep = (p, n) => { $('load-bar').style.width = p + '%'; $('load-pct').textContent = p + '%'; $('load-step').textContent = n; };
  const yf = () => new Promise(r => setTimeout(r, 16));

  setStep(4, '正在启动渲染器'); await yf();
  initRenderer();

  setStep(14, '正在合成行星表面'); await yf();
  const maps = makeEarthMaps(isMobile ? 1024 : 2048, isMobile ? 512 : 1024);
  const moon = makeMoonMap();

  setStep(40, '正在装配太阳系'); await yf();
  L1 = new L1Solar();
  scene.add(L1.group);

  setStep(58, '正在绘制银河星图'); await yf();
  L2 = new L2Galaxy(QUALITY);
  scene.add(L2.group);

  setStep(74, '正在安装巨构'); await yf();
  L0 = new L0Earth({ maps, moonCanvas: moon, quality: QUALITY });
  scene.add(L0.group);

  setStep(88, '正在编译着色器'); await yf();
  renderer.compile(scene, camera);
  renderer.setAnimationLoop(null);
  animate();

  setStep(100, '就绪'); await yf();
  window.__boot.started = true;
  $('loading').style.opacity = '0';
  setTimeout(() => $('loading').remove(), 900);
  $('enter').classList.remove('hidden');
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: $('gl'), antialias: !isMobile, powerPreference: 'high-performance',
    logarithmicDepthBuffer: true,
  });
  applyDRSLevel();
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9f2f8);   // 晨光星图浅底
  camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .1, 3.2e6);
  camera.position.set(-260, 140, 420);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .06;
  controls.minDistance = 8; controls.maxDistance = 2.6e6;
  controls.rotateSpeed = .55;

  sunLight = new THREE.DirectionalLight(0xfff6e8, 2.6);
  sunLight.position.copy(SUN_POS).multiplyScalar(4000); // 太阳方向照明
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xd8ecf8, 0xc8d8e4, 1.1));

  post = buildPost(renderer, scene, camera, QUALITY);
  clock = new THREE.Clock();

  // —— 稳定性：WebGL 上下文丢失/恢复 ——
  const cvs = renderer.domElement;
  cvs.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    toast('图形上下文丢失，正在恢复…');
  });
  cvs.addEventListener('webglcontextrestored', () => {
    renderer.setAnimationLoop(safeAnimate);
    toast('图形已恢复');
  });
}

/* —— 自适应分辨率（DRS）—— */
const DRS_LEVELS = [2, 1.6, 1.3, 1.05];
let drsIdx = Math.min(3, +(localStorage.getItem('emb-drs') || 0)) || 0;
function applyDRSLevel() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, DRS_LEVELS[drsIdx]));
  post && post.composer.setSize(innerWidth, innerHeight);
}
const DRS = { acc: 0, n: 0, cool: 0 };
function drsUpdate(dt) {
  DRS.acc += dt; DRS.n++;
  if (DRS.acc < 1.5) return;
  const fps = DRS.n / DRS.acc;
  DRS.acc = 0; DRS.n = 0;
  if (fps < 42 && drsIdx < 3) {
    drsIdx++; localStorage.setItem('emb-drs', drsIdx); applyDRSLevel();
  } else if (fps > 57 && drsIdx > 0 && DRS.cool <= 0) {
    drsIdx--; localStorage.setItem('emb-drs', drsIdx); applyDRSLevel();
    DRS.cool = 3;
  }
  if (DRS.cool > 0) DRS.cool -= 1.5;
}

/* ═══════════ 目的地解析 ═══════════ */
const lld = (lat, lon) => new THREE.Vector3(
  Math.cos(lat * Math.PI / 180) * Math.cos(lon * Math.PI / 180),
  Math.sin(lat * Math.PI / 180),
  Math.cos(lat * Math.PI / 180) * Math.sin(lon * Math.PI / 180)
);
function planetWorld(name) {
  const p = L1.planets.find(p => p.def.name === name);
  return p ? p.mesh.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
}
const STAR_DESTS = {
  alphacen: new THREE.Vector3(-4.37 * LYU * .92, -4.37 * LYU * .3, 4.37 * LYU * .26),
  gcloud: new THREE.Vector3(2.5 * LYU, -1.2 * LYU, 1.8 * LYU),
  pleiades: new THREE.Vector3(444 * LYU * .9, 444 * LYU * .12, -444 * LYU * .38),
  orion: new THREE.Vector3(1344 * LYU * .86, 1344 * LYU * .1, -1344 * LYU * .5),
  carina: new THREE.Vector3(-8500 * LYU * .82, -8500 * LYU * .18, -8500 * LYU * .5),
};
function destTarget(d) {
  switch (d.tgt) {
    case 'earth': return [new THREE.Vector3(0, 0, 0), d.dist];
    case 'luna': return [L0.moon.getWorldPosition(new THREE.Vector3()), d.dist];
    case 'engine': return [lld(24, 40).multiplyScalar(EARTH_R).applyAxisAngle(new THREE.Vector3(0, 1, 0), L0.spinY()), d.dist];
    case 'steer': return [lld(0, 200).multiplyScalar(EARTH_R).applyAxisAngle(new THREE.Vector3(0, 1, 0), L0.spinY()), d.dist];
    case 'elev': return [lld(0, 22).multiplyScalar(GEO_R * .9), d.dist];
    case 'synch': return [new THREE.Vector3(GEO_R, 0, 0), d.dist];
    case 'nav': return [L0.flagship.getWorldPosition(new THREE.Vector3()), d.dist];
    case 'fleet': return [new THREE.Vector3(0, 0, -60), d.dist];
    case 'obs': return [L0.obs.getWorldPosition(new THREE.Vector3()), d.dist];
    case 'sys': return [new THREE.Vector3(500, 900, 700), d.dist];
    case 'sol': return [SUN_POS.clone(), d.dist];
    default:
      if (STAR_DESTS[d.tgt]) return [STAR_DESTS[d.tgt].clone(), d.dist];
      return [planetWorld(d.tgt.toUpperCase()), d.dist];
  }
}

/* ═══════════ 飞行动画（对数距离插值） ═══════════ */
let flyTween = null;
function flyTo(d, then) {
  const [target, dist] = destTarget(d);
  let dir = target.clone();
  if (dir.lengthSq() < 1) dir.copy(camera.position).normalize();
  else dir.normalize();
  const surfaceOff = target.length() < 1 ? EARTH_R : 0;
  const endPos = target.clone().addScaledVector(dir, dist + surfaceOff).add(new THREE.Vector3(0, dist * .18, 0));
  flyTween = {
    t: 0, dur: clamp(Math.log10(1 + camera.position.distanceTo(endPos)) * .5, 1.6, 4.2),
    p0: camera.position.clone(), p1: endPos,
    l0: controls.target.clone(), l1: target,
    then,
  };
  S.focusName = d.name.split('·')[0].trim();
  dash.setActiveDest(d.id);
  toast(S.focusName);
}

/* ═══════════ 影片播放器 ═══════════ */
const Film = {
  playing: false, t: 0, chIdx: 0, chLocal: 0, scrubbed: false,
  start(i = 0) {
    this.playing = true; this.scrubbed = false;
    this.t = CHAPTERS.slice(0, i).reduce((s, c) => s + c.dur, 0);
    this.chIdx = i; this.chLocal = 0;
    saveCam();
    S.mode = 'film';
    dash.setFilm(true);
    dash.setPlayIcon(true);
    setChapterCard(i, true);
    audio.setChapter(i);
    for (const e of FILM_EVENTS) e._done = e.t <= this.t;
    this._applyChapterState(i);
  },
  exit() {
    this.playing = false;
    S.mode = 'explore';
    dash.setFilm(false);
    setChapterCard(0, false);
    dash.showCountdown(null);
    dash.showScrollHint(false);
    restoreCam();
    audio.setChapter(-1); audio.timeWarp(false);
    S.enginePower = S.year > 2078 ? 1 : 0;
  },
  seek(i) { this.start(((i % CHAPTERS.length) + CHAPTERS.length) % CHAPTERS.length); },
  scrubTo(t) {
    this.t = clamp(t, 0, FILM_TOTAL - .01);
    // 事件标记与时间线对齐（避免前进拖动时旧事件灌入日志）
    for (const e of FILM_EVENTS) e._done = e.t <= this.t;
    let acc = 0, i = 0;
    while (i < CHAPTERS.length - 1 && this.t >= acc + CHAPTERS[i].dur) { acc += CHAPTERS[i].dur; i++; }
    if (i !== this.chIdx) {
      this.chIdx = i;
      setChapterCard(i, true);
      audio.setChapter(i);
      this._applyChapterState(i);
    }
    this.chLocal = this.t - acc;
    curLine = -1;
  },
  _applyChapterState(i) {
    // 章节入场状态
    if (i === 0) { S.enginePower = 0; }
    if (i === 1) { S.enginePower = 1; }
  },
  update(dt) {
    if (!this.playing) return;
    this.t += dt; this.chLocal += dt;
    const ch = CHAPTERS[this.chIdx];
    if (this.chLocal >= ch.dur) {
      setChapterCard(this.chIdx, false);
      this.chIdx++;
      if (this.chIdx >= CHAPTERS.length) { this.exit(); toast('抵达新家园 · 任务完成，自由探索银河'); return; }
      this.chLocal = 0;
      setChapterCard(this.chIdx, true);
      audio.setChapter(this.chIdx);
      this._applyChapterState(this.chIdx);
    }
    // 任务年沿曲线
    S.year = yearAt(this.t);
    // 第一章：点火进度 + 倒计时环
    if (this.chIdx === 0) {
      S.enginePower = smoothstep(12.4, 19, this.t);
      const [c0, c1] = ch.countdown;
      if (this.t >= c0 && this.t < c1) {
        dash.showCountdown(Math.max(1, 11 - Math.ceil((this.t - c0) / (c1 - c0) * 10)));
      } else dash.showCountdown(null);
      if (this.t >= c1 + .1 && !this._boom) { this._boom = true; audio.boom(); }
    } else this._boom = false;
    // 第二章：时间压缩
    if (this.chIdx === 1) {
      const on = this.t > 44;
      audio.timeWarp(on);
      if (on && !this._warped) { this._warped = true; toast('时间压缩启动 · 1 年 ≈ 3 秒'); }
    } else { this._warped = false; audio.timeWarp(false); }
    // 冰封推进
    S.iceAmt = smoothstep(2100, 2600, S.year) * .8 * (1 - smoothstep(4450, 4578, S.year));
    // 事件日志
    for (const e of FILM_EVENTS) {
      if (!e._done && this.t >= e.t) { e._done = true; dash.log(e.y, e.tx); }
    }
    updateFilmCamera();
    updateSubtitles();
  },
};
let camSaved = null;
function saveCam() { camSaved = { p: camera.position.clone(), t: controls.target.clone(), fov: camera.fov }; }
function restoreCam() {
  if (!camSaved) return;
  camera.position.copy(camSaved.p); controls.target.copy(camSaved.t);
  camera.fov = camSaved.fov; camera.updateProjectionMatrix();
}
const easeIO = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const resolve = (v) => (typeof v === 'function' ? v() : new THREE.Vector3(...v));
function updateFilmCamera() {
  const ch = CHAPTERS[Film.chIdx];
  const local = Film.chLocal;
  const shot = ch.shots.find(s => local >= s.t && local < s.t + s.dur) || ch.shots[ch.shots.length - 1];
  const k = easeIO(clamp((local - shot.t) / shot.dur, 0, 1));
  const pos = resolve(shot.from).clone().lerp(resolve(shot.to || shot.from), k);
  const look = shot.lookAt ? resolve(shot.lookAt) : new THREE.Vector3(...(shot.look || [0, 0, 0]));
  if (shot.snap) camera.position.copy(pos);
  else camera.position.lerp(pos, Math.min(1, 12 / 60));
  camera.lookAt(look);
  camera.fov += ((shot.fov || 46) - camera.fov) * .06;
  camera.updateProjectionMatrix();
}
// 跟随镜头：行星实时位置
bindFollow((name, dx, dy, dz, d) => {
  const w = planetWorld(name);
  return new THREE.Vector3(w.x + dx, w.y + dy, w.z + dz);
});

let curLine = -1;
function updateSubtitles() {
  const ch = CHAPTERS[Film.chIdx];
  const local = Film.chLocal;
  const line = ch.lines.findIndex(l => local >= l.t);
  const sub = $('subtitle');
  if (line !== curLine && line >= 0) {
    curLine = line;
    const l = ch.lines[line];
    typeText($('sub-kicker'), l.k);
    typeText($('sub-title'), l.ti, 30);
    typeText($('sub-sub'), l.s, 14);
  }
  if (line < 0) curLine = -1;
}
function typeText(el, text, cps = 22) {
  el.textContent = '';
  let i = 0;
  clearInterval(el._ti);
  el._ti = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(el._ti);
  }, 1000 / cps);
}
function setChapterCard(i, show) {
  const c = $('chapter-card');
  if (!show) { c.classList.remove('show'); return; }
  const ch = CHAPTERS[i];
  $('ch-num').textContent = String(i + 1).padStart(2, '0');
  $('ch-title').textContent = ch.title;
  $('ch-era').textContent = `${ch.era} · ${ch.zh}`;
  c.classList.add('show');
  [...$('ch-segs').children].forEach((el, k) => el.classList.toggle('cur', k === i));
}

/* ═══════════ 探索模式时间推进 ═══════════ */
const SPEEDS = [
  { yr: 1 / (365.25 * 86400), orb: 2 * Math.PI / (365.25 * 86400) },  // REAL TIME
  { yr: 1 / 25, orb: 2 * Math.PI / 25 },                              // 1 年 : 25 秒
  { yr: 1 / 3, orb: 2 * Math.PI / 3 },                                // 1 年 : 3 秒
  { yr: 4, orb: 2 * Math.PI / .4 },                                   // TIME-LAPSE
];

/* ═══════════ 遥测 ═══════════ */
function regionOf() {
  const km = S.distKm;
  if (km < 2e5) return '地球轨道';
  if (km < 1.2 * AU_KM) return '内太阳系';
  if (km < 6 * AU_KM) return '小行星带';
  if (km < 12 * AU_KM) return '木星接近';
  if (km < 16 * AU_KM) return '土星环交叉';
  if (km < 50 * AU_KM) return '外太阳系';
  if (km < 110 * AU_KM) return '柯伊伯带';
  if (km < 125 * AU_KM) return '日球层顶';
  if (km < .5 * LY_KM) return '星际空间';
  if (km < 1600 * LY_KM) return '本地泡';
  return '猎户臂';
}
function updateTele() {
  S.distKm = distKmAt(S.year);
  S.vel = speedAt(S.year);
  const dir = camera.position.clone().normalize();
  const l = ((Math.atan2(dir.z, -dir.x) / Math.PI * 12 + 24) % 24).toFixed(1);
  const b = (Math.asin(clamp(dir.y, -1, 1)) / Math.PI * 12).toFixed(1);
  dash.setTele({
    eng: S.enginePower > .95 ? '全功率燃烧' : S.enginePower > 0 ? `点火 ${(S.enginePower * 100) | 0}%` : '待命',
    vel: fmtSpeed(S.vel),
    dsol: fmtDist(S.distKm),
    ltime: fmtLightTime(S.distKm),
    region: regionOf(),
    gal: `l ${l}h · b ${b}°`,
    year: `Y${String(Math.floor(S.year)).padStart(4, '0')}`,
    fov: `${camera.fov.toFixed(0)}°`,
  });
  dash.setYearSlider(S.year);
  // 宇宙阶梯：视距 km
  const camKm = camera.position.length() / KM;
  dash.ladderMark(Math.max(camKm, 1e5));
  // 探索模式事件日志（按年触发）
  if (S.mode === 'explore') {
    for (const e of FILM_EVENTS) {
      if (!e._done && S.year >= e.y + .001 && S.year - e.y < 60) {
        // 仅当滑杆/时间推进穿过该年时记录（避免开局灌入全部）
        if (S.year - e.y < (S.speedMode >= 2 ? 8 : 3)) { e._done = true; dash.log(e.y, e.tx); }
      }
    }
  }
}

/* ═══════════ toast ═══════════ */
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ═══════════ UI 装配 ═══════════ */
function bindUI() {
  audio = new BeyondAudio();
  dash = new Dash(
    (d) => { if (S.mode === 'film') Film.exit(); flyTo(d); },
    (i) => Film.seek(i),
    (L) => { // 宇宙阶梯：飞到该尺度
      const units = L.km * KM;
      const dir = camera.position.clone().normalize();
      const target = controls.target.clone();
      flyTo({ name: L.name + ' · 尺度', tgt: '_scale', dist: units }, null);
      // _scale 目标 = 沿当前方向拉到该距离（用自定义 tween）
    },
    (i) => { S.speedMode = Math.max(0, i); },
    (m) => {
      if (m === 'film') Film.start(0);
      else if (S.mode === 'film') Film.exit();
    }
  );
  dash.onVoyage = (y) => { S.year = clamp(y, 2078, 4578); };
  dash.onScrub = (t) => Film.scrubTo(t);
  dash.onPlay = () => {
    if (S.mode !== 'film') { Film.start(0); return; }
    Film.playing = !Film.playing;
    if (Film.playing && Film.scrubbed) Film.scrubbed = false;
    dash.setPlayIcon(Film.playing);
    dash.showScrollHint(false);
  };
  dash.onExit = () => { if (S.mode === 'film') Film.exit(); };
  dash.onSound = () => {
    S.soundOn = !S.soundOn;
    audio.masterOn(S.soundOn);
    $('b-sound').textContent = S.soundOn ? '♪ 开' : '♪ 关';
  };
  dash.onHud = () => {
    S.hudOn = !S.hudOn;
    $('app').classList.toggle('nohud', !S.hudOn);
  };
  dash.onFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => { });
  };

  // 影片内滚轮 = 穿越时间
  addEventListener('wheel', (e) => {
    if (S.mode !== 'film') return;
    e.preventDefault();
    Film.playing = false;
    Film.scrubbed = true;
    dash.setPlayIcon(false);
    dash.showScrollHint(true);
    Film.scrubTo(Film.t - Math.sign(e.deltaY) * -2.2);
    clearTimeout(window._shT);
    window._shT = setTimeout(() => dash.showScrollHint(false), 1600);
  }, { passive: false });

  // 键盘
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); dash.onPlay(); }
    else if (e.code === 'Escape' && S.mode === 'film') Film.exit();
    else if (e.code === 'ArrowLeft' && S.mode === 'film') Film.seek(Film.chIdx - 1);
    else if (e.code === 'ArrowRight' && S.mode === 'film') Film.seek(Film.chIdx + 1);
    else if (e.code === 'KeyM') dash.onSound();
    else if (e.code === 'KeyH') dash.onHud();
    else if (e.code === 'KeyJ') { S.mode === 'film' ? Film.exit() : Film.start(0); }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    post.composer.setSize(innerWidth, innerHeight);
  });

  $('btn-enter').addEventListener('click', () => {
    audio.init();
    $('enter').style.opacity = '0';
    $('enter').style.visibility = 'hidden';
    $('app').classList.remove('hidden');
    S.enginePower = 1;
    toast('自由探索 · 右侧选目的地 · 底部 ▶ 播放影片 · 左下拖动时间轴');
  });
}

/* ═══════════ 主循环 ═══════════ */
let teleT = 0, frames = 0, fpsT = 0;
function animate() {
  const dt = Math.min(.05, clock.getDelta());
  S.t = clock.elapsedTime;
  const st = { t: S.t, year: S.year, enginePower: S.enginePower, iceAmt: S.iceAmt, camDist: camera.position.distanceTo(controls.target), orbSpeed: SPEEDS[S.speedMode].orb };

  // 探索模式时间推进
  if (S.mode === 'explore') {
    S.year = clamp(S.year + dt * SPEEDS[S.speedMode].yr, 2078, 4578);
    S.iceAmt = smoothstep(2100, 2600, S.year) * .8 * (1 - smoothstep(4450, 4578, S.year));
  }
  st.orbSpeed = SPEEDS[S.speedMode].orb * (S.mode === 'film' && Film.chIdx < 2 ? .4 : 1);

  // 太阳方向（世界）
  const sunDir = SUN_POS.clone().normalize();
  st.sunDirWorld = sunDir;

  // 三层更新
  L0.update(dt, st);
  L1.update(dt, st);
  const camDist = camera.position.length();
  L2.update(dt, S.t, camDist);

  // 相机
  if (flyTween) {
    flyTween.t += dt;
    const k = easeIO(clamp(flyTween.t / flyTween.dur, 0, 1));
    camera.position.lerpVectors(flyTween.p0, flyTween.p1, k);
    controls.target.lerpVectors(flyTween.l0, flyTween.l1, k);
    if (flyTween.t >= flyTween.dur) { const th = flyTween.then; flyTween = null; th && th(); }
  } else if (S.mode === 'explore') {
    controls.update();
    if (camera.position.length() < EARTH_R + 3) camera.position.setLength(EARTH_R + 3);
  }
  // 影片
  if (S.mode === 'film') Film.update(dt);

  // 音频
  audio.setRumble(S.enginePower * (S.mode === 'film' ? 1 : .5));

  tickTriplanar(L0.triMats, S.t);

  // 遥测 5Hz
  teleT += dt;
  if (teleT > .2) { teleT = 0; updateTele(); }
  if (S.mode === 'film') dash.setTimecode(Film.t);
  else dash.setTimecode(0);

  post.composer.render();

  frames++; fpsT += dt;
  if (fpsT >= 1) { S.fps = frames / fpsT; frames = 0; fpsT = 0; }
  window.__stats = { fps: S.fps, year: S.year };
  drsUpdate(dt);
}

/* 渲染循环防护：单帧异常不炸整个体验，连续 3 次停机降级后重试 */
let errStreak = 0;
function safeAnimate() {
  try { animate(); errStreak = 0; }
  catch (e) {
    console.error('[render]', e);
    if (++errStreak >= 3) {
      renderer.setAnimationLoop(null);
      toast('渲染异常 · 已切换安全模式');
      post.bloom.enabled = false;
      renderer.setAnimationLoop(safeAnimate);
      errStreak = 0;
    }
  }
}

/* 可见性：离开页面静音，回来丢弃积压帧 */
document.addEventListener('visibilitychange', () => {
  if (!clock) return;
  if (document.hidden) { audio.ctx && audio.masterOn(false); }
  else { clock.getDelta(); audio.ctx && audio.masterOn(S.soundOn); }
});

bindUI();
boot().then(() => {
  renderer.setAnimationLoop(safeAnimate);
}).catch(err => {
  const m = document.getElementById('boot-fault-msg');
  document.getElementById('boot-fault').style.display = 'block';
  if (m) m.textContent = 'BOOT FAILED · ' + (err?.message || err);
  console.error(err);
});
