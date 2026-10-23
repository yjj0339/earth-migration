/* ═══════════════════════════════════════════════════════════
   beyond/audio.js — 生成式配乐（纯 Web Audio，无音频文件）
   次低音持续音 + 逐章和弦垫（Dm → Fmaj7 → Am → Eb利底亚 → D大调）
   + 引擎隆隆 + 深空 shimmer + 时间压缩低通扫频。
   ═══════════════════════════════════════════════════════════ */
export class BeyondAudio {
  constructor() { this.ctx = null; }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = .8;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);

    // 次低音
    const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = 36.7;
    this.subG = c.createGain(); this.subG.gain.value = .15;
    sub.connect(this.subG).connect(this.master); sub.start();

    // 引擎噪声
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const noise = c.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110;
    this.rumbleG = c.createGain(); this.rumbleG.gain.value = 0;
    noise.connect(lp).connect(this.rumbleG).connect(this.master); noise.start();

    // 和弦垫（含 pad 总低通，可被“时间压缩”扫频）
    this.padLP = c.createBiquadFilter(); this.padLP.type = 'lowpass'; this.padLP.frequency.value = 1100;
    this.padG = c.createGain(); this.padG.gain.value = .12;
    this.padG.connect(this.padLP).connect(this.master);
    this.chords = [
      [73.42, 146.83, 220.0, 293.66, 349.23],   // Dm
      [87.31, 174.61, 261.63, 329.63, 440.0],   // Fmaj7
      [110.0, 220.0, 261.63, 329.63, 440.0],    // Am
      [77.78, 155.56, 233.08, 293.66, 349.23],  // Eb lydian
      [73.42, 146.83, 220.0, 293.66, 369.99],   // D
    ];
    this.oscs = [];
    for (let i = 0; i < 5; i++) {
      const o = c.createOscillator();
      o.type = i < 2 ? 'triangle' : 'sine';
      const g = c.createGain(); g.gain.value = .05 / (i * .5 + 1);
      o.connect(g).connect(this.padG); o.start();
      this.oscs.push(o);
    }
    // shimmer
    for (const f of [1568, 2093, 3136]) {
      const o = c.createOscillator(); o.frequency.value = f;
      const g = c.createGain(); g.gain.value = .0035;
      const lfo = c.createOscillator(); lfo.frequency.value = .05 + Math.random() * .12;
      const lg = c.createGain(); lg.gain.value = .0028;
      lfo.connect(lg).connect(g.gain); lfo.start();
      o.connect(g).connect(this.master); o.start();
    }
    this.setChapter(0);
  }
  setChapter(i) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const chord = this.chords[Math.max(0, Math.min(i, this.chords.length - 1))];
    this.oscs.forEach((o, k) => o.frequency.setTargetAtTime(chord[Math.min(k, 4)], t, 1.6));
    this.padG.gain.setTargetAtTime(i >= 0 ? .3 : .12, t, 2.2);
  }
  setRumble(v) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rumbleG.gain.setTargetAtTime(v * .45, t, .9);
    this.subG.gain.setTargetAtTime(.1 + v * .13, t, .9);
  }
  /** 时间压缩：低通扫频 + 短促滴答 */
  timeWarp(on) {
    if (!this.ctx) return;
    this.padLP.frequency.setTargetAtTime(on ? 380 : 1100, this.ctx.currentTime, .5);
  }
  boom() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(84, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 3);
    const g = c.createGain();
    g.gain.setValueAtTime(.85, t);
    g.gain.exponentialRampToValueAtTime(.001, t + 3.4);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 3.5);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = .6;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(50, t + 2.8);
    const ng = c.createGain(); ng.gain.value = .5;
    src.connect(lp).connect(ng).connect(this.master); src.start(t); src.stop(t + 3);
  }
  masterOn(on) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(on ? .8 : 0, this.ctx.currentTime, .3);
  }
}
