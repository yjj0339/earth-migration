/* ═══════════════════════════════════════════════════════════
   beyond/story.js — 第二部六幕影片脚本（约 2:54 · 174s）
   章节镜头可给静态数组或函数(st)→Vector3（跟随运动天体）。
   missionYear 沿锚点曲线推进（时间压缩的叙事化）。
   ═══════════════════════════════════════════════════════════ */

/** (影片时刻 s → 任务年) 分段线性锚点 */
const YEAR_ANCHORS = [
  [0, 2078], [12, 2078], [30, 2079], [50, 2088], [65, 2093],
  [80, 2124], [95, 2156], [110, 2200], [130, 2580],
  [140, 2820], [155, 3010], [165, 4400], [174, 4578],
];
export function yearAt(t) {
  if (t <= 0) return 2078;
  for (let i = 1; i < YEAR_ANCHORS.length; i++) {
    if (t <= YEAR_ANCHORS[i][0]) {
      const [t0, y0] = YEAR_ANCHORS[i - 1], [t1, y1] = YEAR_ANCHORS[i];
      return y0 + (y1 - y0) * (t - t0) / (t1 - t0);
    }
  }
  return 4578;
}
/** 任务年 → 距太阳 km（叙事曲线） */
const DIST_ANCHORS = [
  [2078, 1.496e8], [2088, 7.5e8], [2093, 1.5e9], [2101, 4.5e9], [2156, 1.8e10],
  [2200, 2.2e11], [2300, 3.4e12], [2580, 1.51e13], [3010, 2.9e13], [4400, 4.02e13], [4578, 4.13e13],
];
export function distKmAt(year) {
  if (year <= 2078) return DIST_ANCHORS[0][1];
  for (let i = 1; i < DIST_ANCHORS.length; i++) {
    if (year <= DIST_ANCHORS[i][0]) {
      const [y0, d0] = DIST_ANCHORS[i - 1], [y1, d1] = DIST_ANCHORS[i];
      const k = (year - y0) / (y1 - y0);
      return d0 * Math.pow(d1 / d0, k); // 对数插值
    }
  }
  return DIST_ANCHORS[DIST_ANCHORS.length - 1][1];
}
/** 任务年 → 速度 km/s */
export function speedAt(year) {
  const p = Math.max(0, (year - 2078) / 2500);
  return 30 + Math.pow(p, 1.35) * 3400;
}

export const CHAPTERS = [
  {
    title: 'The Wandering Earth', zh: '流浪地球', era: '2078 · 1 AU', dur: 30,
    lines: [
      { t: .6, k: '第一章 · 2078', ti: '全球点火倒计时', s: '全球点火序列 · 10,000 台重聚变发动机' },
      { t: 12.5, k: 'IGNITION', ti: '点火', s: '尾随半球逐台点亮 · 150 亿吨推力' },
      { t: 22, k: 'ESCAPE BURN', ti: '地球启程', s: '第一次变轨机动 · 离开原轨道' },
    ],
    shots: [
      { t: 0, dur: 9, from: [220, 130, 430], to: [170, 95, 330], look: [0, 0, 0], fov: 50 },
      { t: 9, dur: 9, from: [150, 80, 300], to: [90, 42, 170], look: [30, 30, 40], fov: 58 },
      { t: 18, dur: 7, from: [70, 36, 140], to: [420, 200, 520], look: [0, 0, 0], fov: 46 },
      { t: 25, dur: 5, from: [420, 200, 520], to: [700, 320, 800], look: [0, 0, 0], fov: 44 },
    ],
    countdown: [3, 12],
    on: { boom: 12.5 },
  },
  {
    title: 'The Solar System', zh: '太阳系', era: '2079–2093 · 1→10 AU', dur: 35,
    lines: [
      { t: .6, k: '第二章 · 2079', ti: '穿越太阳系', s: '木星与土星之间 · 时间压缩启动' },
      { t: 14, k: 'JUPITER FLYBY', ti: '木星借力', s: 'GRAVITY ASSIST · 第二次加速窗口' },
      { t: 26, k: 'SATURN', ti: '土星环面交叉', s: 'RING PLANE CROSSING · 冰晶环带' },
    ],
    shots: [
      { t: 0, dur: 12, from: [90, 260, 420], to: [60, 180, 300], look: [-30, 0, 0], fov: 50 },
      { t: 12, dur: 12, from: () => $JUP(+14, +6, +14, 26), to: () => $JUP(+8, +3, +9, 18), lookAt: () => $JUP(0, 0, 0, 0), fov: 44 },
      { t: 24, dur: 11, from: () => $SAT(+16, +2.5, +10, 20), to: () => $SAT(+10, -1.2, +6, 13), lookAt: () => $SAT(0, 0, 0, 0), fov: 46 },
    ],
    on: { timeWarp: 4, event: 'warpOn' },
  },
  {
    title: 'Beyond the Outer Planets', zh: '超越外行星', era: '2101–2156 · 30→120 AU', dur: 30,
    lines: [
      { t: .6, k: '第三章 · 2101', ti: '柯伊伯带', s: '冥王星与阋神星之间 · 太阳已成一颗亮星' },
      { t: 15, k: 'HELIOPAUSE', ti: '日球层顶', s: '离开太阳的势力范围 · 太阳风在此终结' },
    ],
    shots: [
      { t: 0, dur: 13, from: [1400, 620, 900], to: [1100, 480, 760], look: [-140, 0, -60], fov: 46 },
      { t: 13, dur: 9, from: [1100, 480, 760], to: [1900, 760, 1200], look: [-260, 0, -100], fov: 44 },
      { t: 22, dur: 8, from: [1900, 760, 1200], to: [3400, 1200, 2100], look: [-400, 0, -140], fov: 42 },
    ],
  },
  {
    title: 'Interstellar Voyage', zh: '星际航行', era: '2160–2580 · 0.002→1.6 LY', dur: 35,
    lines: [
      { t: .6, k: '第四章 · 2160', ti: '星际介质', s: '弓形激波稳定 · 地球成为一颗暗星' },
      { t: 16, k: 'DEEP FIELD', ti: '深空航行', s: '极光在冰封的夜空起舞 · 地下城灯火如星' },
    ],
    shots: [
      { t: 0, dur: 14, from: [320, 90, 380], to: [200, 60, 250], look: [0, 0, 0], fov: 44 },
      { t: 14, dur: 12, from: [170, 40, 220], to: [90, 22, 120], look: [0, 0, 0], fov: 48 },
      { t: 26, dur: 9, from: [90, 22, 120], to: [1500, 500, 1200], look: [0, 0, 0], fov: 46 },
    ],
  },
  {
    title: 'The Milky Way', zh: '银河系', era: '猎户臂 · 距银心 26,700 LY', dur: 25,
    lines: [
      { t: .6, k: '第五章', ti: '银河', s: '太阳位于人马臂与英仙臂之间的猎户臂' },
      { t: 13, k: 'GALACTIC VIEW', ti: '四条旋臂', s: '尘埃带 · 恒星形成区 · 球状星团 · 麦哲伦云' },
    ],
    shots: [
      { t: 0, dur: 10, from: [2.2e4, 8e3, 2.4e4], to: [8e4, 3e4, 9e4], look: [-2e4, 0, 0], fov: 46 },
      { t: 10, dur: 9, from: [8e4, 3e4, 9e4], to: [3.6e5, 1.6e5, 4e5], look: [-4e4, 0, 0], fov: 44 },
      { t: 19, dur: 6, from: [3.6e5, 1.6e5, 4e5], to: [1.1e6, 4.6e5, 1.2e6], look: [-6e4, 0, 0], fov: 42 },
    ],
  },
  {
    title: 'A New Sun', zh: '新的太阳', era: '4578 · 比邻星 4.37 LY', dur: 19,
    lines: [
      { t: .6, k: '第六章 · 4578', ti: '减速点火', s: '减速点火 · 发动机调转朝向新家园' },
      { t: 10, k: 'PROXIMA CENTAURI', ti: '抵达比邻星', s: '2,500 年 · 一百代人的旅程 · 新的太阳升起' },
    ],
    shots: [
      { t: 0, dur: 8, from: [1.1e6, 4.6e5, 1.2e6], to: [-2600, 900, 2600], look: [0, 0, 0], fov: 48 },
      { t: 8, dur: 11, from: [-2600, 900, 2600], to: [-200, 80, 260], look: [0, 0, 0], fov: 46 },
    ],
  },
];
export const FILM_TOTAL = CHAPTERS.reduce((s, c) => s + c.dur, 0);

/* 天体跟随镜头辅助（由 main 注入实时位置） */
let $planetPos = (name, dx, dy, dz, dist) => ({ x: dx, y: dy, z: dz });
export function bindFollow(fn) { $planetPos = fn; }
const $JUP = (dx, dy, dz, d) => $planetPos('JUPITER', dx, dy, dz, d);
const $SAT = (dx, dy, dz, d) => $planetPos('SATURN', dx, dy, dz, d);

export const FILM_EVENTS = [
  { t: 0.5, y: 2078, tx: 'UEG 理事会批准《地球迁移计划》最终案' },
  { t: 3.0, y: 2078, tx: '全球点火序列装订 · MOSS 上线自检' },
  { t: 9.0, y: 2078, tx: '尾随半球供电网格并入主网' },
  { t: 12.6, y: 2078, tx: '🔥 GLOBAL IGNITION · 10,000 台发动机同时点火' },
  { t: 16, y: 2079, tx: '第一次变轨机动完成 · ΔV 42 m/s' },
  { t: 22, y: 2079, tx: '地球离开原轨道 · ESCAPE BURN 开始' },
  { t: 33, y: 2081, tx: '木星观测窗口开启 · 引力弹弓参数装订' },
  { t: 44, y: 2088, tx: '⏩ 时间压缩启动 · 1 年 ≈ 3 秒' },
  { t: 50, y: 2090, tx: '木星借力完成 · 速度提升至 47 KM/S' },
  { t: 60, y: 2092, tx: '土星环面交叉 · 冰晶监测峰值' },
  { t: 68, y: 2101, tx: '进入柯伊伯带 · 重元素采集平台展开' },
  { t: 78, y: 2124, tx: '冥王星掠航 · 全轨道测绘完成' },
  { t: 88, y: 2146, tx: '日球层顶穿越 · 太阳风粒子计数归零' },
  { t: 95, y: 2156, tx: '离开太阳势力范围 · 进入星际介质' },
  { t: 103, y: 2171, tx: '弓形激波形态稳定 · ISM 密度 0.1 atoms/cm³' },
  { t: 112, y: 2214, tx: '地下城极光观测 · 冰盖厚度 1.4 KM' },
  { t: 122, y: 2437, tx: '第 12 代领航员轮换 · 航程 0.8 LY' },
  { t: 131, y: 2580, tx: '🌌 银河系全景测绘 · 猎户臂星图装订' },
  { t: 140, y: 2820, tx: '穿越本星际云边缘 · G Cloud' },
  { t: 150, y: 2966, tx: '南门二双星目视可见 · 亮度 -0.27 等' },
  { t: 158, y: 4401, tx: '减速点火序列启动 · 发动机调转' },
  { t: 166, y: 4522, tx: '泊入比邻星椭圆轨道 · 距离 0.0485 AU' },
  { t: 170, y: 4561, tx: '冰盖开始消融 · 地表温度 -31°C 回升' },
  { t: 173, y: 4578, tx: '🌅 抵达新家园 · 2,500 年旅程的终点' },
  { t: 174, y: 4578, tx: '第一批地表考察队出发 · 新纪元元年' },
  { t: 174.5, y: 4578, tx: '任务移交民用政府 · THE WANDERING ERA ENDS' },
];
