/* ═══════════════════════════════════════════════════════════
   beyond/dash.js — 仪表盘
   顶部遥测玻璃条 · 左侧宇宙阶梯 · 右侧 25 目的地 · 底部药丸 dock ·
   VOYAGE 时间轴 + 公转四档 · 事件日志 · 影片 UI（黑边/章节卡/字幕/
   倒计时环/滚轮提示）
   ═══════════════════════════════════════════════════════════ */
import { FILM_TOTAL, CHAPTERS } from './story.js';

const $ = (id) => document.getElementById(id);

export const DESTS = [
  { grp: '地球与舰队', items: [
    { id: 'earth', name: 'EARTH · 地球', tgt: 'earth', dist: 420 },
    { id: 'luna', name: 'LUNA · 月球', tgt: 'luna', dist: 90 },
    { id: 'engine', name: 'HEAVY ENGINE ARRAY · 重型发动机', tgt: 'engine', dist: 60 },
    { id: 'steer', name: 'EQUATORIAL STEERING · 赤道转向', tgt: 'steer', dist: 70 },
    { id: 'elev', name: 'SPACE ELEVATOR · 太空电梯', tgt: 'elev', dist: 50 },
    { id: 'synch', name: 'GEOSYNC RING · 同步轨道环', tgt: 'synch', dist: 620 },
    { id: 'nav', name: 'NAVIGATOR · 领航者旗舰', tgt: 'nav', dist: 40 },
    { id: 'fleet', name: 'ESCORT FLEET · 护航舰队', tgt: 'fleet', dist: 90 },
    { id: 'obs', name: 'DEEP SPACE OBS · 深空观测站', tgt: 'obs', dist: 80 },
  ]},
  { grp: '太阳系', items: [
    { id: 'sys', name: 'SOLAR SYSTEM · 全景', tgt: 'sys', dist: 2600 },
    { id: 'sol', name: 'SOL · 太阳', tgt: 'sol', dist: 60 },
    { id: 'mercury', name: 'MERCURY · 水星', tgt: 'mercury', dist: 14 },
    { id: 'venus', name: 'VENUS · 金星', tgt: 'venus', dist: 20 },
    { id: 'mars', name: 'MARS · 火星', tgt: 'mars', dist: 16 },
    { id: 'jupiter', name: 'JUPITER · 木星', tgt: 'jupiter', dist: 46 },
    { id: 'saturn', name: 'SATURN · 土星', tgt: 'saturn', dist: 40 },
    { id: 'uranus', name: 'URANUS · 天王星', tgt: 'uranus', dist: 22 },
    { id: 'neptune', name: 'NEPTUNE · 海王星', tgt: 'neptune', dist: 22 },
    { id: 'pluto', name: 'PLUTO · 冥王星', tgt: 'pluto', dist: 14 },
    { id: 'eris', name: 'ERIS · 阋神星', tgt: 'eris', dist: 14 },
  ]},
  { grp: '星际', items: [
    { id: 'alphacen', name: 'ALPHA CEN A·B · 南门二', tgt: 'alphacen', dist: 400 },
    { id: 'gcloud', name: 'G CLOUD · 本星际云', tgt: 'gcloud', dist: 200 },
    { id: 'pleiades', name: 'PLEIADES · 昴星团', tgt: 'pleiades', dist: 2600 },
    { id: 'orion', name: 'ORION NEBULA · 猎户座大星云', tgt: 'orion', dist: 5200 },
    { id: 'carina', name: 'CARINA · 船底座', tgt: 'carina', dist: 2.4e4 },
  ]},
];

export const LADDER = [
  { name: '行星', km: 1e5 },
  { name: '轨道空间', km: 4e4 * 63.7 },
  { name: '1 AU', km: 1.496e8 },
  { name: '日球层顶', km: 1.8e10 },
  { name: '1 光年', km: 9.461e12 },
  { name: '本地臂', km: 1e17 },
  { name: '银河系', km: 9.461e20 },
];

export class Dash {
  constructor(onFly, onSeek, onLadder, onSpeed, onMode) {
    this.onFly = onFly; this.logCount = 0;
    this.buildLists();
    this.buildLadder(onLadder);
    this.buildSpeed(onSpeed);
    this.buildChapters(onSeek);
    this.bind(onMode);
  }

  buildLists() {
    const box = $('dest-list');
    for (const g of DESTS) {
      const h = document.createElement('div');
      h.className = 'dest-head';
      h.textContent = g.grp + ` · ${g.items.length}`;
      box.appendChild(h);
      for (const d of g.items) {
        const el = document.createElement('button');
        el.className = 'dest-item';
        el.innerHTML = `<span>${d.name}</span><i>→</i>`;
        el.addEventListener('click', () => this.onFly(d));
        box.appendChild(el);
        d.el = el;
      }
    }
  }

  buildLadder(onLadder) {
    const box = $('ladder-ticks');
    this.ladderEls = [];
    LADDER.forEach((L, i) => {
      const el = document.createElement('button');
      el.style.top = (i / (LADDER.length - 1) * 100) + '%';
      el.innerHTML = `<i></i><span>${L.name}</span>`;
      el.addEventListener('click', () => onLadder(L));
      $('ladder').appendChild(el);
      this.ladderEls.push(el);
    });
  }

  buildSpeed(onSpeed) {
    const modes = ['实时', '1 年 : 25 秒', '1 年 : 3 秒', '延时'];
    this.speedBtns = [];
    modes.forEach((m, i) => {
      const b = document.createElement('button');
      b.textContent = m;
      if (i === 1) b.classList.add('on');
      b.addEventListener('click', () => {
        this.speedBtns.forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        onSpeed(i);
      });
      $('speed-modes').appendChild(b);
      this.speedBtns.push(b);
    });
    // VOYAGE 年代滑杆
    $('voyage-slider').addEventListener('input', (e) => {
      onSpeed(-2); // 切 REAL
      this.speedBtns.forEach((x, k) => x.classList.toggle('on', k === 0));
      this.onVoyage && this.onVoyage(+e.target.value);
    });
  }

  buildChapters(onSeek) {
    const box = $('ch-segs');
    let acc = 0;
    CHAPTERS.forEach((c, i) => {
      const seg = document.createElement('button');
      seg.style.flexGrow = c.dur;
      seg.title = `${String(i + 1).padStart(2, '0')} ${c.title}`;
      seg.addEventListener('click', () => onSeek(i));
      box.appendChild(seg);
      const tick = document.createElement('i');
      tick.style.left = (acc / FILM_TOTAL * 100) + '%';
      tick.dataset.name = seg.title;
      $('f-ticks').appendChild(tick);
      acc += c.dur;
    });
    $('f-track').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const t = (e.clientX - r.left) / r.width * FILM_TOTAL;
      this.onScrub && this.onScrub(t);
    });
  }

  bind(onMode) {
    $('b-film').addEventListener('click', () => onMode('film'));
    $('b-explore').addEventListener('click', () => onMode('explore'));
    $('b-sound').addEventListener('click', () => this.onSound && this.onSound());
    $('b-hud').addEventListener('click', () => this.onHud && this.onHud());
    $('b-full').addEventListener('click', () => this.onFull && this.onFull());
    $('b-play').addEventListener('click', () => this.onPlay && this.onPlay());
    $('b-exit').addEventListener('click', () => this.onExit && this.onExit());
  }

  /** 遥测 8 项 + 任务年 */
  setTele(o) {
    for (const k in o) {
      const el = $('t-' + k);
      if (el && el.textContent !== o[k]) el.textContent = o[k];
    }
  }

  log(year, tx) {
    const box = $('log-list');
    const el = document.createElement('div');
    el.className = 'log-item';
    el.innerHTML = `<span class="ly">Y${year}</span><span>${tx}</span>`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    this.logCount++;
    $('log-count').textContent = String(this.logCount).padStart(2, '0') + ' / 26';
  }

  /** 宇宙阶梯高亮（km 视距） */
  ladderMark(km) {
    let near = 0;
    LADDER.forEach((L, i) => { if (km >= L.km) near = i; });
    this.ladderEls.forEach((el, i) => el.classList.toggle('on', i === near));
    const p = Math.min(1, Math.max(0, (Math.log10(km) - 5) / (21 - 5)));
    $('ladder-cursor').style.top = (p * 100) + '%';
  }

  setActiveDest(id) {
    document.querySelectorAll('.dest-item').forEach(el => el.classList.remove('on'));
    DESTS.forEach(g => g.items.forEach(d => { if (d.id === id) d.el.classList.add('on'); }));
  }

  setFilm(on) {
    $('film').classList.toggle('hidden', !on);
    $('app').classList.toggle('film-on', on);
    $('b-film').classList.toggle('on', on);
    $('b-explore').classList.toggle('on', !on);
  }
  setPlayIcon(playing) {
    $('b-play').textContent = playing ? '❚❚' : '▶';
  }
  setTimecode(s) {
    const tot = FILM_TOTAL;
    $('b-time').textContent = `${String((s / 60) | 0).padStart(2, '0')}:${String((s | 0) % 60).padStart(2, '0')} / ${String((tot / 60) | 0).padStart(2, '0')}:${String(tot % 60 | 0).padStart(2, '0')}`;
    $('f-prog').style.width = (s / tot * 100) + '%';
  }
  setYearSlider(y) {
    const sl = $('voyage-slider');
    if (document.activeElement !== sl) sl.value = y;
    $('voyage-year').textContent = `Y${String(Math.floor(y)).padStart(4, '0')}`;
  }
  showScrollHint(on) {
    $('scroll-hint').classList.toggle('show', on);
  }
  showCountdown(n) {
    const el = $('count-ring');
    if (n === null) { el.classList.remove('show'); return; }
    el.classList.add('show');
    el.querySelector('.cr-num').textContent = String(n).padStart(2, '0');
    el.querySelector('.cr-ring').style.setProperty('--p', (n / 10 * 360) + 'deg');
  }
}
