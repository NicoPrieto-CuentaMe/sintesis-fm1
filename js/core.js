/* Síntesis con tu FM-1 · núcleo: audio, visualización, teclado, navegación */
(function () {
'use strict';
const W = window;

/* ---------------------------------------------------------------- utilidades */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const pc = m => ((m % 12) + 12) % 12;
const nameEn = m => NEN[pc(m)] + (Math.floor(m / 12) - 1);
const nameEs = m => NES[pc(m)] + (Math.floor(m / 12) - 1);
const dec = (x, d = 1) => x.toFixed(d).replace('.', ',');
const fHz = f => f >= 1000 ? dec(f / 1000, f >= 10000 ? 1 : 2) + ' kHz' : (f >= 100 ? String(Math.round(f)) : dec(f, 1)) + ' Hz';
const fS = s => s >= 1 ? dec(s, 2) + ' s' : Math.round(s * 1000) + ' ms';
const fPct = x => Math.round(x * 100) + ' %';
const RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
const store = {
  get(k, d) { try { const v = localStorage.getItem('fm1c:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fm1c:' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento: no pasa nada */ } }
};
function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function merge(a, b) {
  for (const k in b) {
    const v = b[k];
    if (v && typeof v === 'object' && v.constructor === Object) {
      if (!a[k] || typeof a[k] !== 'object') a[k] = {};
      merge(a[k], v);
    } else a[k] = v;
  }
  return a;
}

/* paleta térmica de JIANT: frío = poco, caliente = mucho */
const HEATS = ['#22d3ee', '#3b82f6', '#8b5cf6', '#d946ef', '#ef4444', '#ff7a00', '#facc15', '#f4f1ea'];
const HEAT = HEATS.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
function heat(t, a = 1) {
  t = clamp(t, 0, 1) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(t)), f = t - i, c = HEAT[i], d = HEAT[i + 1];
  return 'rgba(' + Math.round(lerp(c[0], d[0], f)) + ',' + Math.round(lerp(c[1], d[1], f)) + ',' + Math.round(lerp(c[2], d[2], f)) + ',' + a + ')';
}

/* ---------------------------------------------------------------- audio */
const A = {
  ctx: null, bus: null, an: null, out: null, noise: null, td: null, fd: null,
  vol: store.get('vol', 0.7),
  ensure() {
    if (!this.ctx) {
      const C = W.AudioContext || W.webkitAudioContext;
      if (!C) { soundUI('nope'); return null; }
      const ctx = this.ctx = new C({ latencyHint: 'interactive' });
      this.bus = ctx.createGain();
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -9; lim.knee.value = 3; lim.ratio.value = 18; lim.attack.value = 0.002; lim.release.value = 0.15;
      this.an = ctx.createAnalyser(); this.an.fftSize = 4096; this.an.smoothingTimeConstant = 0.5;
      this.out = ctx.createGain(); this.out.gain.value = this.vol * this.vol;
      this.bus.connect(lim); lim.connect(this.an); lim.connect(this.out); this.out.connect(ctx.destination);
      const sr = ctx.sampleRate, nb = ctx.createBuffer(1, sr * 2, sr), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = nb;
      this.td = new Float32Array(this.an.fftSize);
      this.fd = new Float32Array(this.an.frequencyBinCount);
      if (ctx.addEventListener) ctx.addEventListener('statechange', () => soundUI());
    }
    if (this.ctx.state !== 'running') {
      const pr = this.ctx.resume();
      if (pr && pr.then) pr.then(() => soundUI(), () => {});
    }
    soundUI();
    return this.ctx;
  },
  get on() { return !!this.ctx && this.ctx.state === 'running'; },
  get t() { return this.ctx ? this.ctx.currentTime : 0; },
  setVol(v) { this.vol = v; store.set('vol', v); if (this.out) this.out.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.03); }
};
function soundUI(state) {
  const b = $('#snd'); if (!b) return;
  const on = A.on;
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  const s = b.querySelector('span');
  if (s) s.textContent = state === 'nope' ? 'Sin audio' : on ? 'Sonido activo' : 'Activar sonido';
  document.documentElement.classList.toggle('snd-on', on);
}

/* envolvente con valor calculable en cualquier instante (para soltar sin clics) */
class Env {
  constructor(param, base = 0) { this.P = param; this.base = base; this.s = null; }
  val(t) {
    const s = this.s; if (!s) return 0;
    if (s.rt != null && t >= s.rt) return s.rv * Math.exp(-(t - s.rt) / s.rtau);
    const dt = t - s.t0;
    if (dt <= 0) return s.v0;
    if (dt < s.a) return s.v0 + (s.pk - s.v0) * dt / s.a;
    return s.pk * s.su + (s.pk - s.pk * s.su) * Math.exp(-(dt - s.a) / s.dtau);
  }
  _hold(t, v) {
    const P = this.P;
    if (P.cancelAndHoldAtTime) P.cancelAndHoldAtTime(t); else P.cancelScheduledValues(t);
    P.setValueAtTime(this.base + v, t);
  }
  on(t, a, d, su, pk) {
    const v0 = this.val(t);
    a = Math.max(0.002, a);
    this.s = { t0: t, v0, a, pk, su, dtau: Math.max(0.001, d / 4), rt: null };
    this._hold(t, v0);
    this.P.linearRampToValueAtTime(this.base + pk, t + a);
    this.P.setTargetAtTime(this.base + pk * su, t + a, this.s.dtau);
  }
  off(t, r) {
    if (!this.s) return;
    const v = this.val(t);
    this.s.rt = t; this.s.rv = v; this.s.rtau = Math.max(0.002, r / 5);
    this._hold(t, v);
    this.P.setTargetAtTime(this.base, t, this.s.rtau);
  }
  stage(t) {
    const s = this.s; if (!s) return null;
    if (s.rt != null && t >= s.rt) return { st: 'R', x: t - s.rt };
    const dt = t - s.t0;
    return dt < s.a ? { st: 'A', x: dt } : { st: 'DS', x: dt - s.a };
  }
}

/* ondas a medida */
function pwHarm(amps, phases) {
  const ctx = A.ctx, N = amps.length + 1, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    const a = amps[n - 1] || 0, ph = phases ? (phases[n - 1] || 0) : 0;
    im[n] = a * Math.cos(ph); re[n] = a * Math.sin(ph);
  }
  return ctx.createPeriodicWave(re, im);
}
function pwCycle(cyc, H = 128) {
  const ctx = A.ctx, N = cyc.length, re = new Float32Array(H + 1), im = new Float32Array(H + 1);
  for (let h = 1; h <= H; h++) {
    const w = 2 * Math.PI * h / N, cw = Math.cos(w), sw = Math.sin(w);
    let c = 1, s = 0, sc = 0, ss = 0;
    for (let i = 0; i < N; i++) {
      sc += cyc[i] * c; ss += cyc[i] * s;
      const c2 = c * cw - s * sw; s = s * cw + c * sw; c = c2;
    }
    re[h] = 2 * sc / N; im[h] = 2 * ss / N;
  }
  return ctx.createPeriodicWave(re, im);
}
/* un ciclo de las formas clásicas, para dibujar o construir ondas */
function cycle(kind, N = 512, duty = 0.5) {
  const c = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i / N;
    c[i] = kind === 'sine' ? Math.sin(2 * Math.PI * x)
      : kind === 'triangle' ? (x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4)
      : kind === 'square' ? (x < 0.5 ? 1 : -1)
      : kind === 'pulse' ? (x < duty ? 1 : -1)
      : kind === 'sawtooth' ? (x < 0.5 ? 2 * x : 2 * x - 2) : 0;
  }
  return c;
}

/* ---------------------------------------------------------------- instrumentos */
class Inst {
  constructor(gain) { this.vs = new Set(); this.dest = null; this.ok = false; this.gain = gain == null ? 0.3 : gain; }
  _b() {
    if (this.ok) return true;
    const ctx = A.ensure(); if (!ctx) return false;
    this.out = ctx.createGain(); this.out.gain.value = this.gain;
    this.out.connect(this.dest || A.bus);
    this.ok = true;
    if (this._init) this._init(ctx);
    return true;
  }
  route(n) { this.dest = n; if (this.ok) { this.out.disconnect(); this.out.connect(n || A.bus); } }
  setGain(g) { this.gain = g; if (this.ok) this.out.gain.setTargetAtTime(g, A.t, 0.02); }
  noteOn(m, vel = 0.8) {
    if (!this._b()) return null;
    const t = A.t;
    for (const v of this.vs) if (v.m === m && v.rel == null) this._rel(v, t, 0.015);
    return this._add(m, vel, t);
  }
  noteOff(m) { if (!this.ok) return; const t = A.t; for (const v of this.vs) if (v.m === m && v.rel == null) this._rel(v, t); }
  play(m, vel, t, dur) { if (!this._b()) return null; const v = this._add(m, vel, t); if (v) this._rel(v, t + dur); return v; }
  allOff() { if (!this.ok) return; const t = A.t; for (const v of this.vs) if (v.rel == null) this._rel(v, t, 0.05); }
  _add(m, vel, t) { const v = this._start(m, vel, t); if (v) { v.m = m; v.vel = vel; v.t0 = t; v.rel = null; this.vs.add(v); } return v; }
  _rel(v, t, r) { v.rel = t; this._stop(v, t, r); }
  _ends(v, src) { src.onended = () => { this.vs.delete(v); if (this._kill) this._kill(v); }; }
  active() { const t = A.t; return [...this.vs].filter(v => v.rel == null || v.rel > t); }
}

const SYN = () => ({
  gain: 0.28, poly: 8, mode: 'poly', prio: 'last', glide: 0, vel: 0.5, tr: 0,
  osc: [{ w: 'sawtooth', lv: 1, semi: 0, det: 0 }], uni: 1, spread: 0, noise: 0, ring: false,
  f: { type: 'lowpass', cut: 20000, q: 0.7, env: 0, kt: 0, vel: 0 },
  ae: { a: 0.005, d: 0.3, s: 0.85, r: 0.25 },
  fe: { a: 0.005, d: 0.4, s: 0, r: 0.3 },
  pe: { amt: 0, d: 0.08 },
  lfo: { rate: 5, w: 'sine', pitch: 0, cut: 0, amp: 0 },
  pan: 0, rpan: 0
});

/* sintetizador sustractivo polifónico: osciladores → filtro → amplificador, con envolventes y LFO */
class Synth extends Inst {
  constructor(p) { super(); this.p = merge(SYN(), p || {}); this.gain = this.p.gain; this.held = []; this.mono = null; this.last = null; }
  _init(ctx) {
    const p = this.p;
    this.trem = ctx.createGain();
    this.panN = ctx.createStereoPanner(); this.panN.pan.value = p.pan;
    this.out.disconnect(); this.out.connect(this.trem); this.trem.connect(this.panN); this.panN.connect(this.dest || A.bus);
    this.lfoIn = ctx.createGain(); this.lP = ctx.createGain(); this.lC = ctx.createGain(); this.lA = ctx.createGain();
    this.lP.gain.value = 0; this.lC.gain.value = 0; this.lA.gain.value = 0;
    this.lfoIn.connect(this.lP); this.lfoIn.connect(this.lC); this.lfoIn.connect(this.lA); this.lA.connect(this.trem.gain);
    this._lfoSrc(ctx); this._lfo();
  }
  route(n) { this.dest = n; if (this.ok) { this.panN.disconnect(); this.panN.connect(n || A.bus); } }
  _lfoSrc(ctx) {
    if (this.lfoN) { try { this.lfoN.stop(); } catch (e) {} this.lfoN.disconnect(); }
    const L = this.p.lfo; let n;
    if (L.w === 'sh') {
      const sr = ctx.sampleRate, k = 1024, steps = 64, b = ctx.createBuffer(1, k * steps, sr), d = b.getChannelData(0);
      this.shv = [];
      for (let s = 0; s < steps; s++) { const v = Math.random() * 2 - 1; this.shv.push(v); for (let i = 0; i < k; i++) d[s * k + i] = v; }
      n = ctx.createBufferSource(); n.buffer = b; n.loop = true; n.playbackRate.value = L.rate * k / sr;
    } else { n = ctx.createOscillator(); n.type = L.w; n.frequency.value = L.rate; }
    n.connect(this.lfoIn); n.start();
    this.lfoN = n; this.lfoW = L.w; this.lfoT = ctx.currentTime; this.lfoPh = 0; this.lfoR = L.rate;
  }
  lfoPhase(t) { return ((this.lfoPh + (t - this.lfoT) * this.lfoR) % 1 + 1) % 1; }
  lfoValue(t) {
    const ph = this.lfoPhase(t), w = this.p.lfo.w;
    if (w === 'sh') { const sv2 = this.shv || [0]; return sv2[Math.floor(ph * 64) % 64] || 0; }
    return lfoShape(w, ph);
  }
  _lfo() {
    if (!this.ok) return;
    const L = this.p.lfo, ctx = A.ctx, t = ctx.currentTime;
    if (L.w !== this.lfoW) this._lfoSrc(ctx);
    else if (L.rate !== this.lfoR) {
      this.lfoPh = this.lfoPhase(t); this.lfoT = t; this.lfoR = L.rate;
      if (this.lfoN.frequency) this.lfoN.frequency.setValueAtTime(L.rate, t);
      else this.lfoN.playbackRate.setValueAtTime(L.rate * 1024 / ctx.sampleRate, t);
    }
    this.lP.gain.setTargetAtTime(L.pitch, t, 0.02);
    this.lC.gain.setTargetAtTime(L.cut * 1200, t, 0.02);
    this.lA.gain.setTargetAtTime(L.amp * 0.5, t, 0.02);
    this.trem.gain.setTargetAtTime(1 - L.amp * 0.5, t, 0.02);
  }
  _cut(m) { const f = this.p.f; return clamp(f.cut * Math.pow(2, (m - 60) / 12 * f.kt), 20, 20000); }
  _spr(u, n) { return n > 1 ? (u / (n - 1) - 0.5) * this.p.spread : 0; }
  _wave(os, w) { if (typeof w === 'string') os.type = w; else if (w) os.setPeriodicWave(w); }
  _start(m, vel, t, from) {
    const p = this.p, ctx = A.ctx, v = { src: [], osc: [] };
    const amp = v.amp = ctx.createGain(); amp.gain.value = 0;
    let tail = amp;
    if (p.rpan) { const pn = ctx.createStereoPanner(); pn.pan.value = (Math.random() * 2 - 1) * p.rpan; amp.connect(pn); tail = pn; }
    tail.connect(this.out); v.tail = tail;
    const fl = v.fl = ctx.createBiquadFilter(); fl.type = p.f.type; fl.Q.value = p.f.q; fl.frequency.value = this._cut(m); fl.connect(amp);
    this.lC.connect(fl.detune);
    const fe = ctx.createConstantSource(); fe.offset.value = 0; fe.connect(fl.detune); v.src.push(fe); v.fe = new Env(fe.offset);
    const pe = ctx.createConstantSource(); pe.offset.value = 0; v.src.push(pe); v.pe = pe;
    const mix = ctx.createGain(); mix.connect(fl);
    const f1 = mtof(m + p.tr), f0 = (from != null && p.glide > 0) ? mtof(from + p.tr) : f1;
    let ringG = null;
    if (p.ring && p.osc.length > 1) { ringG = ctx.createGain(); ringG.gain.value = 0; ringG.connect(mix); }
    p.osc.forEach((o, i) => {
      const n = (ringG && i === 1) ? 1 : Math.max(1, p.uni | 0);
      for (let u = 0; u < n; u++) {
        const os = ctx.createOscillator(); this._wave(os, o.w);
        const r = Math.pow(2, (o.semi || 0) / 12);
        os.frequency.setValueAtTime(f0 * r, t);
        if (f0 !== f1) os.frequency.setTargetAtTime(f1 * r, t, Math.max(0.001, p.glide / 3));
        os.detune.value = (o.det || 0) + this._spr(u, n);
        this.lP.connect(os.detune); pe.connect(os.detune);
        const g = ctx.createGain(); g.gain.value = (o.lv == null ? 1 : o.lv) / Math.sqrt(n);
        os.connect(g);
        if (ringG && i === 1) { g.gain.value = 1; g.connect(ringG.gain); }
        else if (ringG && i === 0) g.connect(ringG);
        else g.connect(mix);
        v.osc.push({ os, g, i, u, n, r, w: o.w }); v.src.push(os);
      }
    });
    const ns = ctx.createBufferSource(); ns.buffer = p.nbuf || A.noise; ns.loop = true;
    const ng = v.ng = ctx.createGain(); ng.gain.value = p.noise; ns.connect(ng); ng.connect(mix); v.src.push(ns);
    v.src.forEach(s => { if (s === ns) s.start(t, Math.random() * 1.5); else s.start(t); });
    const pk = (1 - p.vel) + p.vel * vel;
    v.ae = new Env(amp.gain); v.ae.on(t, p.ae.a, p.ae.d, p.ae.s, pk);
    v.fe.on(t, p.fe.a, p.fe.d, p.fe.s, p.f.env * 1200 * ((1 - p.f.vel) + p.f.vel * vel));
    if (p.pe.amt) { pe.offset.setValueAtTime(p.pe.amt * 100, t); pe.offset.setTargetAtTime(0, t, Math.max(0.003, p.pe.d / 4)); }
    this._ends(v, fe);
    return v;
  }
  _stop(v, t, rr) {
    const p = this.p, r = rr != null ? rr : Math.max(0.005, p.ae.r);
    v.ae.off(t, r); v.fe.off(t, Math.max(0.005, rr != null ? rr : p.fe.r));
    const end = t + r * 1.4 + 0.05;
    for (const s of v.src) { try { s.stop(end); } catch (e) {} }
  }
  _kill(v) {
    for (const o of v.osc) { try { this.lP.disconnect(o.os.detune); } catch (e) {} }
    try { this.lC.disconnect(v.fl.detune); } catch (e) {}
    try { v.tail.disconnect(); } catch (e) {}
    if (this.mono === v) this.mono = null;
  }
  noteOn(m, vel = 0.8) {
    if (!this._b()) return null;
    const t = A.t, p = this.p;
    if (p.mode === 'poly') {
      for (const v of this.vs) if (v.m === m && v.rel == null) this._rel(v, t, 0.02);
      const act = [...this.vs].filter(v => v.rel == null).sort((a, b) => a.t0 - b.t0);
      while (act.length >= p.poly) this._rel(act.shift(), t, 0.03);
      const v = this._start(m, vel, t, p.glide > 0 ? this.last : null);
      v.m = m; v.vel = vel; v.t0 = t; v.rel = null; this.vs.add(v);
      this.last = m; return v;
    }
    this.held = this.held.filter(x => x !== m); this.held.push(m);
    this._mono(t, vel, true);
    return this.mono;
  }
  noteOff(m) {
    if (!this.ok) return;
    const t = A.t;
    if (this.p.mode === 'poly') { for (const v of this.vs) if (v.m === m && v.rel == null) this._rel(v, t); return; }
    this.held = this.held.filter(x => x !== m);
    this._mono(t, null, false);
  }
  _tgt() { const h = this.held; if (!h.length) return null; const pr = this.p.prio; return pr === 'low' ? Math.min(...h) : pr === 'high' ? Math.max(...h) : h[h.length - 1]; }
  _mono(t, vel, pressed) {
    const n = this._tgt(), v = this.mono, p = this.p;
    if (n == null) { if (v && v.rel == null) this._rel(v, t); return; }
    if (!v || v.rel != null) {
      const nv = this._start(n, vel == null ? 0.8 : vel, t, this.last);
      nv.m = n; nv.vel = vel == null ? 0.8 : vel; nv.t0 = t; nv.rel = null; this.vs.add(nv); this.mono = nv;
    } else if (n !== v.m) {
      const f = mtof(n + p.tr), tau = Math.max(0.001, p.glide / 3);
      for (const o of v.osc) o.os.frequency.setTargetAtTime(f * o.r, t, tau);
      v.fl.frequency.setTargetAtTime(this._cut(n), t, tau);
      v.m = n;
      if (p.mode === 'mono' && pressed) this._retrig(v, vel, t);
    } else if (pressed && p.mode === 'mono') this._retrig(v, vel, t);
    this.last = n;
  }
  _retrig(v, vel, t) {
    const p = this.p; vel = vel == null ? v.vel : vel; v.t0 = t;
    v.ae.on(t, p.ae.a, p.ae.d, p.ae.s, (1 - p.vel) + p.vel * vel);
    v.fe.on(t, p.fe.a, p.fe.d, p.fe.s, p.f.env * 1200 * ((1 - p.f.vel) + p.f.vel * vel));
  }
  play(m, vel, t, dur) {
    if (!this._b()) return null;
    const v = this._start(m, vel, t, null);
    v.m = m; v.vel = vel; v.t0 = t; v.rel = null; this.vs.add(v);
    this._rel(v, t + dur); return v;
  }
  allOff() { this.held = []; super.allOff(); }
  set(q) { merge(this.p, q || {}); this._apply(); }
  _apply() {
    if (!this.ok) return;
    const p = this.p, t = A.t;
    this.out.gain.setTargetAtTime(p.gain, t, 0.02);
    this.panN.pan.setTargetAtTime(p.pan, t, 0.02);
    this._lfo();
    for (const v of this.vs) {
      if (v.fl.type !== p.f.type) v.fl.type = p.f.type;
      v.fl.frequency.setTargetAtTime(this._cut(v.m), t, 0.012);
      v.fl.Q.setTargetAtTime(p.f.q, t, 0.012);
      v.ng.gain.setTargetAtTime(p.noise, t, 0.02);
      for (const o of v.osc) {
        const oc = p.osc[o.i]; if (!oc) continue;
        if (o.w !== oc.w) { this._wave(o.os, oc.w); o.w = oc.w; }
        o.r = Math.pow(2, (oc.semi || 0) / 12);
        if (v.rel == null) o.os.frequency.setTargetAtTime(mtof(v.m + p.tr) * o.r, t, p.mode === 'poly' ? 0.01 : Math.max(0.01, p.glide / 3));
        o.os.detune.setTargetAtTime((oc.det || 0) + this._spr(o.u, o.n), t, 0.02);
        if (!(p.ring && o.i === 1)) o.g.gain.setTargetAtTime((oc.lv == null ? 1 : oc.lv) / Math.sqrt(o.n), t, 0.02);
      }
    }
  }
}
function lfoShape(w, ph) {
  if (w === 'sine') return Math.sin(2 * Math.PI * ph);
  if (w === 'triangle') return ph < 0.25 ? 4 * ph : ph < 0.75 ? 2 - 4 * ph : 4 * ph - 4;
  if (w === 'square') return ph < 0.5 ? 1 : -1;
  if (w === 'sawtooth') return ph < 0.5 ? 2 * ph : 2 * ph - 2;
  return 0;
}

/* ---------------------------------------------------------------- efectos */
function distCurve(type, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * 2 - 1; let y;
    switch (type) {
      case 'hard': y = clamp(x * 3, -1, 1); break;
      case 'fold': y = Math.sin(x * Math.PI * 2.5); break;
      case 'crush': y = Math.round(x * 4) / 4; break;
      case 'rect': y = Math.abs(x) * 1.8 - 0.6; break;
      case 'amp': y = x > 0 ? Math.tanh(x * 4) : Math.tanh(x * 2) * 0.85; break;
      default: y = Math.tanh(x * 4) / Math.tanh(4);
    }
    c[i] = y;
  }
  return c;
}
function makeIR(seconds, damp) {
  const ctx = A.ctx, sr = ctx.sampleRate, len = Math.max(1, Math.floor(sr * seconds)), ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr, env = Math.exp(-6.9 * t / seconds) * (i < sr * 0.004 ? i / (sr * 0.004) : 1);
      const k = 1 - clamp(damp * (0.25 + 0.75 * t / seconds), 0, 0.97);
      lp += ((Math.random() * 2 - 1) - lp) * k;
      d[i] = lp * env;
    }
  }
  return ir;
}
class FX {
  constructor(p) {
    this.ok = false;
    this.p = merge({ dist: 0, dtype: 'soft', tone: 0.6, cho: 0, chRate: 0.7, chDepth: 0.5, dly: 0, time: 0.33, fb: 0.4, dtone: 0.55, rev: 0, size: 2.2, damp: 0.5, pre: 0.02 }, p || {});
  }
  _b() {
    if (this.ok) return true;
    const ctx = A.ensure(); if (!ctx) return false;
    const c = n => ctx[n]();
    this.in = c('createGain'); this.out = c('createGain'); this.out.connect(A.bus);
    this.dry = c('createGain'); this.wet = c('createGain'); this.pre = c('createGain');
    this.ws = ctx.createWaveShaper(); this.ws.oversample = '4x';
    this.toneF = c('createBiquadFilter'); this.toneF.type = 'lowpass';
    this.dc = c('createBiquadFilter'); this.dc.type = 'highpass'; this.dc.frequency.value = 25;
    this.post = c('createGain');
    this.in.connect(this.dry); this.in.connect(this.pre); this.pre.connect(this.ws); this.ws.connect(this.toneF); this.toneF.connect(this.dc); this.dc.connect(this.post); this.post.connect(this.wet);
    this.mid = c('createGain'); this.dry.connect(this.mid); this.wet.connect(this.mid); this.mid.connect(this.out);
    this.sC = c('createGain'); this.sD = c('createGain'); this.sR = c('createGain');
    this.mid.connect(this.sC); this.mid.connect(this.sD); this.mid.connect(this.sR);
    // chorus: dos líneas cortas moduladas, una a cada lado
    this.chL = ctx.createDelay(0.06); this.chR = ctx.createDelay(0.06);
    this.chL.delayTime.value = 0.014; this.chR.delayTime.value = 0.019;
    this.chO = c('createOscillator'); this.chG1 = c('createGain'); this.chG2 = c('createGain');
    this.chO.connect(this.chG1); this.chO.connect(this.chG2); this.chG1.connect(this.chL.delayTime); this.chG2.connect(this.chR.delayTime); this.chO.start();
    const mg = ctx.createChannelMerger(2);
    this.sC.connect(this.chL); this.sC.connect(this.chR); this.chL.connect(mg, 0, 0); this.chR.connect(mg, 0, 1); mg.connect(this.out);
    // delay con realimentación y tono en el lazo
    this.dl = ctx.createDelay(3); this.dfb = c('createGain'); this.dfl = c('createBiquadFilter');
    this.sD.connect(this.dl); this.dl.connect(this.dfl); this.dfl.connect(this.dfb); this.dfb.connect(this.dl); this.dfl.connect(this.out);
    // reverb por convolución
    this.pd = ctx.createDelay(1); this.cv = c('createConvolver');
    this.sR.connect(this.pd); this.pd.connect(this.cv); this.cv.connect(this.out);
    this.ok = true; this.irKey = ''; this.apply();
    return true;
  }
  set(q) { merge(this.p, q || {}); this.apply(); }
  apply() {
    if (!this.ok) return;
    const p = this.p, t = A.t, s = (n, v) => n.setTargetAtTime(v, t, 0.02);
    const on = p.dist > 0.001;
    s(this.dry.gain, on ? 0 : 1); s(this.wet.gain, on ? 1 : 0);
    if (this.dtype !== p.dtype) { this.ws.curve = distCurve(p.dtype); this.dtype = p.dtype; }
    s(this.pre.gain, 0.6 + p.dist * 4.5); s(this.post.gain, 0.9 / (1 + p.dist * 1.2));
    s(this.toneF.frequency, 900 * Math.pow(18, p.tone));
    s(this.sC.gain, p.cho); this.chO.frequency.setTargetAtTime(p.chRate, t, 0.05);
    s(this.chG1.gain, p.chDepth * 0.006); s(this.chG2.gain, -p.chDepth * 0.006);
    s(this.sD.gain, p.dly); this.dl.delayTime.setTargetAtTime(p.time, t, 0.06); s(this.dfb.gain, Math.min(0.95, p.fb));
    if (p.dtone < 0.5) { this.dfl.type = 'lowpass'; this.dfl.frequency.setTargetAtTime(400 * Math.pow(30, p.dtone * 2), t, 0.03); }
    else { this.dfl.type = 'highpass'; this.dfl.frequency.setTargetAtTime(30 * Math.pow(60, (p.dtone - 0.5) * 2), t, 0.03); }
    s(this.sR.gain, p.rev); this.pd.delayTime.setTargetAtTime(p.pre, t, 0.03);
    const key = p.size.toFixed(2) + '/' + p.damp.toFixed(2);
    if (key !== this.irKey) {
      this.irKey = key; clearTimeout(this.irT);
      this.irT = setTimeout(() => { this.cv.buffer = makeIR(p.size, p.damp); }, this.cv.buffer ? 140 : 0);
    }
  }
  get input() { this._b(); return this.in; }
}

/* ---------------------------------------------------------------- dibujo */
const SC = { grid: 'rgba(237,233,246,0.07)', axis: 'rgba(237,233,246,0.18)', txt: 'rgba(237,233,246,0.6)', fg: '#EEEAF6', dim: '#8C85A0', vio: '#A08CFF', ora: '#FF7A00' };
function fit(cv) {
  const r = cv.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const dpr = Math.min(2, W.devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  return { g, w: r.width, h: r.height };
}
function grid(g, w, h, nx = 8, ny = 4) {
  g.strokeStyle = SC.grid; g.lineWidth = 1; g.beginPath();
  for (let i = 1; i < nx; i++) { const x = Math.round(w * i / nx) + 0.5; g.moveTo(x, 0); g.lineTo(x, h); }
  for (let j = 1; j < ny; j++) { const y = Math.round(h * j / ny) + 0.5; g.moveTo(0, y); g.lineTo(w, y); }
  g.stroke();
}
function txt(g, s, x, y, al = 'left', c = SC.txt, size = 11) {
  g.font = '500 ' + size + 'px "Chakra Petch", system-ui, sans-serif';
  g.fillStyle = c; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(s, x, y);
}
function path(g, pts, color, lw = 2) {
  g.strokeStyle = color; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
}
function idle(g, w, h, msg) {
  g.strokeStyle = SC.axis; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  txt(g, msg || 'Toca una tecla o pulsa Sonar', w / 2, h / 2 - 18, 'center', SC.dim, 12);
}
/* osciloscopio: forma de onda en vivo, enganchada al cruce por cero */
function scope(g, w, h, o = {}) {
  grid(g, w, h, 8, 4);
  if (!A.on) { idle(g, w, h, o.msg); return 0; }
  A.an.getFloatTimeDomainData(A.td);
  const d = A.td, sr = A.ctx.sampleRate, span = Math.min(d.length >> 1, Math.round((o.ms || 20) * sr / 1000));
  let i0 = 0;
  for (let i = 1; i < d.length - span; i++) if (d[i - 1] < 0 && d[i] >= 0) { i0 = i; break; }
  let pk = 0; for (let i = i0; i < i0 + span; i++) pk = Math.max(pk, Math.abs(d[i]));
  const y0 = h / 2;
  let k = h * 0.42;
  if (o.auto !== false) { scope.g = lerp(scope.g || 1, 1 / Math.max(pk, 0.04), 0.15); k *= Math.min(scope.g, 12); }
  else k *= (o.gain || 2.2);
  g.shadowColor = o.color || SC.ora; g.shadowBlur = RM ? 0 : 8;
  g.strokeStyle = o.color || heat(0.74); g.lineWidth = 2; g.beginPath();
  for (let x = 0; x <= w; x++) {
    const s = d[i0 + Math.floor(x / w * span)], y = y0 - clamp(s * k, -y0 + 2, y0 - 2);
    x ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke(); g.shadowBlur = 0;
  if (o.ms && o.label !== false) txt(g, (o.ms >= 1 ? Math.round(o.ms) : dec(o.ms, 1)) + ' ms en pantalla', w - 8, 12, 'right', SC.dim, 10);
  return pk;
}
/* espectro: cuánta energía hay en cada frecuencia, coloreado como cámara térmica */
function spectrum(g, w, h, o = {}) {
  const lin = !!o.lin, fmin = o.fmin || (lin ? 0 : 30), fmax = o.fmax || (lin ? 4000 : 16000), base = h - 16;
  g.strokeStyle = SC.grid; g.lineWidth = 1; g.beginPath();
  const marks = lin ? (o.marks || [1000, 2000, 3000]) : [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const X = f => lin ? (f - fmin) / (fmax - fmin) * w : Math.log(f / fmin) / Math.log(fmax / fmin) * w;
  marks.forEach(f => { if (f > fmin && f < fmax) { const x = Math.round(X(f)) + 0.5; g.moveTo(x, 0); g.lineTo(x, base); } });
  g.stroke();
  marks.forEach(f => { if (f > fmin && f < fmax) txt(g, f >= 1000 ? (f / 1000) + 'k' : String(f), X(f), h - 7, 'center', SC.dim, 10); });
  if (!A.on) { txt(g, o.msg || 'Toca una tecla o pulsa Sonar', w / 2, h / 2 - 8, 'center', SC.dim, 12); return; }
  A.an.getFloatFrequencyData(A.fd);
  const fd = A.fd, sr = A.ctx.sampleRate, nb = fd.length, bw = lin ? 2 : 3;
  for (let x = 0; x < w; x += bw) {
    const fa = lin ? fmin + (fmax - fmin) * x / w : fmin * Math.pow(fmax / fmin, x / w);
    const fb = lin ? fmin + (fmax - fmin) * (x + bw) / w : fmin * Math.pow(fmax / fmin, (x + bw) / w);
    const ba = clamp(Math.floor(fa / (sr / 2) * nb), 0, nb - 1), bb = clamp(Math.ceil(fb / (sr / 2) * nb), 0, nb - 1);
    let db = -200; for (let b = ba; b <= bb; b++) if (fd[b] > db) db = fd[b];
    const v = clamp((db + 96) / 76, 0, 1); if (v <= 0.01) continue;
    const bh = v * (base - 4);
    g.fillStyle = heat(v * 0.96); g.fillRect(x, base - bh, bw - (lin ? 0.5 : 1), bh);
  }
}

/* ---------------------------------------------------------------- piezas de interfaz para los laboratorios */
const UI = {
  head(root, title, sub) {
    const h = el('div', 'lab-h', root);
    el('span', 'lab-k', h, 'Laboratorio');
    el('h3', '', h, title);
    if (sub) el('p', '', h, sub);
    return h;
  },
  screen(root, hpx, cls) {
    const box = el('div', 'scr' + (cls ? ' ' + cls : ''), root);
    box.style.setProperty('--h', (hpx || 220) + 'px');
    const cv = el('canvas', '', box);
    cv.setAttribute('role', 'img');
    return { box, cv };
  },
  row(root, cls) { return el('div', 'ctrls' + (cls ? ' ' + cls : ''), root); },
  knob(row, o) {
    const wrap = el('label', 'kc', row); wrap.htmlFor = o.id;
    const top = el('span', 'kc-t', wrap);
    el('span', 'kc-l', top).textContent = o.label;
    const out = el('output', 'kc-v', top);
    const inp = el('input', '', wrap); inp.type = 'range'; inp.id = o.id; inp.min = 0; inp.max = 1000; inp.step = 1;
    const toN = x => o.log ? Math.log(x / o.min) / Math.log(o.max / o.min) : (x - o.min) / (o.max - o.min);
    const fromN = n => { let x = o.log ? o.min * Math.pow(o.max / o.min, n) : o.min + n * (o.max - o.min); if (o.step) x = Math.round(x / o.step) * o.step; return clamp(x, Math.min(o.min, o.max), Math.max(o.min, o.max)); };
    let val = o.value;
    const upd = fire => { out.textContent = o.fmt ? o.fmt(val) : String(val); inp.style.setProperty('--p', (clamp(toN(val), 0, 1) * 100).toFixed(1) + '%'); if (fire && o.on) o.on(val); };
    inp.value = Math.round(clamp(toN(val), 0, 1) * 1000); upd(false);
    inp.addEventListener('input', () => { val = fromN(inp.value / 1000); upd(true); });
    if (o.hint) { wrap.title = o.hint; }
    if (o.wide) wrap.classList.add('kc-w');
    return { get: () => val, set(x, fire = true) { val = x; inp.value = Math.round(clamp(toN(x), 0, 1) * 1000); upd(fire); }, inp, wrap };
  },
  seg(row, o) {
    const wrap = el('div', 'kc kc-seg', row);
    el('span', 'kc-l', wrap).textContent = o.label;
    const g = el('div', 'seg', wrap); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', o.label); g.id = o.id;
    let val = o.value;
    const bs = o.opts.map(([v, t]) => {
      const b = el('button', '', g); b.type = 'button'; b.textContent = t; b.setAttribute('role', 'radio');
      b.addEventListener('click', () => set(v, true));
      return [v, b];
    });
    function set(v, fire) { val = v; bs.forEach(([x, b]) => b.setAttribute('aria-checked', x === v ? 'true' : 'false')); if (fire && o.on) o.on(v); }
    set(val, false);
    if (o.wide) wrap.classList.add('kc-w');
    return { get: () => val, set, wrap };
  },
  tog(row, o) {
    const b = el('button', 'tg' + (o.cls ? ' ' + o.cls : ''), row); b.type = 'button'; if (o.id) b.id = o.id;
    b.setAttribute('aria-pressed', 'false');
    const ic = el('span', 'tg-i', b); const tx = el('span', 'tg-t', b);
    let on = false;
    const keep = (o.cls || '').indexOf('tg-s') >= 0;
    const paint = () => { ic.innerHTML = on && !keep ? ICON.stop : (o.icon ? ICON[o.icon] : ICON.play); tx.textContent = on ? (o.off || 'Parar') : o.text; };
    b.addEventListener('click', () => set(!on, true));
    function set(v, fire) { on = v; b.setAttribute('aria-pressed', v ? 'true' : 'false'); paint(); if (fire && o.on) o.on(v); }
    paint();
    return { get: () => on, set, b };
  },
  btn(row, o) {
    const b = el('button', 'bt' + (o.cls ? ' ' + o.cls : ''), row); b.type = 'button'; if (o.id) b.id = o.id;
    b.innerHTML = (o.icon ? '<span class="tg-i">' + ICON[o.icon] + '</span>' : '') + '<span>' + o.text + '</span>';
    b.addEventListener('click', e => { A.ensure(); o.on && o.on(e); });
    return b;
  },
  note(root, html, cls) { return el('p', 'lab-n' + (cls ? ' ' + cls : ''), root, html); },
  read(root, cls) { return el('div', 'lab-r' + (cls ? ' ' + cls : ''), root); }
};
const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor"/></svg>',
  dice: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5.5" cy="5.5" r="1.2" fill="currentColor"/><circle cx="10.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/></svg>',
  ear: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 6.5a3.5 3.5 0 1 1 7 0c0 2.2-2.5 2.6-2.5 5a2 2 0 0 1-3.6 1.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  wave: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8c1.7-5 3.3-5 5 0s3.3 5 5 0 2.3-3.4 4-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};

/* ---------------------------------------------------------------- bucle de animación */
const Anim = {
  fns: [], raf: 0,
  set(fns) { this.fns = fns; if (!this.raf && fns.length) this.raf = requestAnimationFrame(Anim.loop); },
  loop(ts) {
    Anim.raf = 0;
    for (const f of Anim.fns) { try { f(ts / 1000); } catch (e) { console.error(e); } }
    if (Anim.fns.length) Anim.raf = requestAnimationFrame(Anim.loop);
  }
};

/* reproductor de frases: programa notas un poco por delante del reloj de audio */
class Player {
  constructor() { this.timer = 0; this.on = false; }
  start(fn, stepDur, steps, loop = true) {
    if (!A.ensure()) return;
    this.stop(); this.on = true; this.fn = fn; this.sd = stepDur; this.n = steps; this.loop = loop;
    this.i = 0; this.next = A.t + 0.08;
    this.timer = setInterval(() => this._tick(), 25); this._tick();
  }
  _tick() {
    if (!this.on) return;
    const sd = typeof this.sd === 'function' ? this.sd() : this.sd;
    while (this.next < A.t + 0.12) {
      if (!this.loop && this.i >= this.n) { const end = this.next; this.on = false; clearInterval(this.timer); setTimeout(() => this.onEnd && this.onEnd(), Math.max(0, (end - A.t) * 1000)); return; }
      try { this.fn(this.i % this.n, this.next, sd, this.i); } catch (e) { console.error(e); }
      this.i++; this.next += sd;
    }
  }
  stop() { this.on = false; clearInterval(this.timer); }
}

/* ---------------------------------------------------------------- teclado inferior (las 27 teclas del FM-1) */
const KEYMAP = {}, KEYLAB = {};
['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'].forEach((c, i) => { KEYMAP[c] = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16][i]; KEYLAB[c] = 'ZXCVBNM,./'[i]; });
[['KeyS', 1, 'S'], ['KeyD', 3, 'D'], ['KeyF', 5, 'F'], ['KeyH', 8, 'H'], ['KeyJ', 10, 'J'], ['KeyL', 13, 'L'], ['Semicolon', 15, ';'], ['Quote', 17, "'"]].forEach(([c, n, l]) => { KEYMAP[c] = n; KEYLAB[c] = l; });
['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO'].forEach((c, i) => { KEYMAP[c] = 18 + i; KEYLAB[c] = 'QWERTYUIO'[i]; });
const isBlackIdx = n => [1, 3, 6, 8, 10].includes((n + 5) % 12);

const Dock = {
  inst: null, name: '', oct: 0, ptr: new Map(), kbd: new Map(), latch: false, sus: new Set(), els: [], lis: [], lastM: null,
  init() {
    const box = $('#dk-keys'); if (!box) return;
    this.box = box;
    let w = 0;
    for (let n = 0; n < 27; n++) {
      const black = isBlackIdx(n);
      const k = el('div', 'key ' + (black ? 'b' : 'w'), box); k.dataset.n = n;
      k.style.left = ((black ? w - 0.5 : w) / 16 * 100) + '%';
      const sc = Object.keys(KEYMAP).find(c => KEYMAP[c] === n);
      if (sc) el('kbd', '', k).textContent = KEYLAB[sc];
      if (!black) { const m = 53 + n; el('span', 'kn' + (pc(m) === 0 ? ' c' : ''), k).textContent = nameEn(m); w++; }
      this.els[n] = k;
    }
    box.addEventListener('pointerdown', e => {
      const n = this._at(e); if (n == null) return;
      e.preventDefault();
      try { box.setPointerCapture(e.pointerId); } catch (x) { /* nada */ }
      this._press(e.pointerId, n);
    });
    box.addEventListener('pointermove', e => {
      const cur = this.ptr.get(e.pointerId); if (!cur) return;
      const n = this._at(e);
      if (n != null && n !== cur.n) { this._release(e.pointerId); this._press(e.pointerId, n); }
    });
    const up = e => this._release(e.pointerId);
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up); box.addEventListener('lostpointercapture', up);
    box.addEventListener('contextmenu', e => e.preventDefault());
    W.addEventListener('keydown', e => this._key(e, true));
    W.addEventListener('keyup', e => this._key(e, false));
    W.addEventListener('blur', () => { for (const id of [...this.kbd.keys()]) this._kup(id); });
    $('#dk-om') && $('#dk-om').addEventListener('click', () => this.setOct(this.oct - 1));
    $('#dk-op') && $('#dk-op').addEventListener('click', () => this.setOct(this.oct + 1));
    const lt = $('#dk-latch');
    if (lt) lt.addEventListener('click', () => { this.latch = !this.latch; lt.setAttribute('aria-pressed', this.latch ? 'true' : 'false'); if (!this.latch) { for (const m of this.sus) this.inst && this.inst.noteOff(m); this.sus.clear(); } });
    const mn = $('#dk-min');
    if (mn) {
      const setMin = v => { document.body.classList.toggle('dock-min', v); mn.setAttribute('aria-expanded', v ? 'false' : 'true'); mn.querySelector('span').textContent = v ? 'Mostrar teclado' : 'Ocultar'; store.set('dockmin', v); };
      mn.addEventListener('click', () => setMin(!document.body.classList.contains('dock-min')));
      setMin(store.get('dockmin', W.innerWidth < 560));
    }
    const vol = $('#vol');
    if (vol) { vol.value = Math.round(A.vol * 100); vol.style.setProperty('--p', vol.value + '%'); vol.addEventListener('input', () => { A.setVol(vol.value / 100); vol.style.setProperty('--p', vol.value + '%'); }); }
    this.setOct(0);
  },
  _at(e) { const t = document.elementFromPoint(e.clientX, e.clientY); const k = t && t.closest ? t.closest('.key') : null; return k && k.parentNode === this.box ? +k.dataset.n : null; },
  _key(e, down) {
    const tg = e.target, tn = tg && tg.tagName;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (tn === 'TEXTAREA' || tn === 'SELECT' || (tn === 'INPUT' && !/range|checkbox|radio|button/.test(tg.type)) || (tg && tg.isContentEditable)) return;
    if (down && (e.code === 'BracketLeft' || e.code === 'BracketRight')) { if (!e.repeat) this.setOct(this.oct + (e.code === 'BracketLeft' ? -1 : 1)); e.preventDefault(); return; }
    if (!(e.code in KEYMAP)) return;
    e.preventDefault();
    if (down) { if (e.repeat || this.kbd.has(e.code)) return; const n = KEYMAP[e.code], m = 53 + n + 12 * this.oct; this.kbd.set(e.code, { n, m }); this._on(m, n); }
    else this._kup(e.code);
  },
  _kup(code) { const p = this.kbd.get(code); if (!p) return; this.kbd.delete(code); this._off(p.m, p.n); },
  _press(id, n) { const m = 53 + n + 12 * this.oct; this.ptr.set(id, { n, m }); this._on(m, n); },
  _release(id) { const p = this.ptr.get(id); if (!p) return; this.ptr.delete(id); this._off(p.m, p.n); },
  _on(m, n) {
    A.ensure();
    if (this.latch && this.sus.has(m)) { this.sus.delete(m); this.inst && this.inst.noteOff(m); }
    if (this.inst) this.inst.noteOn(m, 0.8);
    if (this.els[n]) this.els[n].classList.add('on');
    this.lastM = m;
    const f = mtof(m), r = $('#dk-note');
    if (r) r.innerHTML = '<b>' + nameEs(m) + '</b> <span>' + nameEn(m) + ' · ' + fHz(f) + '</span>';
    this.lis.forEach(fn => { try { fn(m, true); } catch (e) { console.error(e); } });
  },
  _off(m, n) {
    if (this.els[n]) this.els[n].classList.remove('on');
    this.lis.forEach(fn => { try { fn(m, false); } catch (e) { console.error(e); } });
    if (this.latch) { this.sus.add(m); return; }
    if (this.inst) this.inst.noteOff(m);
  },
  setOct(o) {
    this.oct = clamp(o, -3, 3);
    const v = $('#dk-oct'); if (v) v.textContent = 'OCT ' + (this.oct > 0 ? '+' : this.oct < 0 ? '−' : '') + Math.abs(this.oct);
    const r = $('#dk-range'); if (r) r.textContent = nameEn(53 + 12 * this.oct) + '–' + nameEn(79 + 12 * this.oct);
  },
  use(inst, name) {
    if (this.inst && this.inst !== inst) { this.inst.allOff && this.inst.allOff(); this.sus.clear(); }
    this.inst = inst; this.name = name || '';
    const n = $('#dk-inst'); if (n) n.textContent = name || '';
  },
  listen(fn) { this.lis.push(fn); }
};

/* ---------------------------------------------------------------- el FM-1 dibujado (proporciones del panel real) */
const P_KNOBS = [['MASTER', 67, 80], ['SELECT', 157, 80], ['PRESETS', 67, 168], ['ALGORITHM', 157, 168], ['KNOB 1', 473, 80], ['KNOB 2', 568, 80], ['KNOB 3', 663, 80], ['KNOB 4', 758, 80]];
const P_R1 = ['FX', 'SCL', 'ENV', 'LFO', 'EDIT', 'GLO'], P_R2 = ['HOME', 'SAVE', 'ARP', 'SEQ', 'PLAY', 'REC'];
const P_BX = [485, 538, 590, 643, 696, 749], P_BY = [172, 224];
const P_UP = ['OP1', 'OP2', 'OP3', 'OP4', 'OP5', 'OP6', 'PIT', 'GLO', 'MONO', 'POLY', ''];
const keyName = n => ['F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'][n % 12] + (3 + Math.floor((n + 5) / 12));
function panel(box, o = {}) {
  const hl = o.hl || [], mini = !!o.mini;
  const s = sv('svg', { viewBox: '0 0 840 504', class: 'fm1' + (mini ? ' mini' : ''), role: o.interactive ? 'group' : 'img', 'aria-label': o.label || 'Panel del M-VAVE FM-1' + (hl.length ? ': ' + hl.join(', ') : '') }, box);
  sv('rect', { x: 1, y: 1, width: 838, height: 502, rx: 40, class: 'dv-body' }, s);
  sv('rect', { x: 44, y: 214, width: 134, height: 43, rx: 8, class: 'dv-well' }, s);
  sv('rect', { x: 448, y: 140, width: 338, height: 117, rx: 12, class: 'dv-well' }, s);
  sv('rect', { x: 28, y: 287, width: 784, height: 183, rx: 26, class: 'dv-well' }, s);
  sv('rect', { x: 216, y: 39, width: 199, height: 198, rx: 22, class: 'dv-bezel' }, s);
  sv('rect', { x: 241, y: 63, width: 150, height: 150, rx: 3, class: 'dv-lcd' }, s);
  if (o.title) {
    const lines = String(o.title).split('|');
    lines.forEach((ln, i) => { const t = sv('text', { x: 316, y: 138 + (i - (lines.length - 1) / 2) * 30, class: 'dv-lcdt', 'text-anchor': 'middle' }, s); t.textContent = ln; });
  } else {
    for (let i = 0; i < 5; i++) sv('rect', { x: 256, y: 150 - i * 4, width: 120, height: 2, fill: heat(0.15 + i * 0.18), opacity: 0.8 }, s);
  }
  const ctls = {};
  const isHL = id => hl.indexOf(id) >= 0;
  const ctl = id => {
    const g = sv('g', { class: 'ctl' + (isHL(id) ? ' hl' : ''), 'data-ctl': id }, s);
    if (o.interactive) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', id); }
    ctls[id] = g; return g;
  };
  const lab = (g, x, y, t, cls) => { const e = sv('text', { x, y, class: cls || 'dv-lbl', 'text-anchor': 'middle' }, g); e.textContent = t; return e; };
  for (const [n, x, y] of P_KNOBS) {
    const g = ctl(n);
    sv('circle', { cx: x, cy: y, r: 30, class: 'hit' }, g);
    sv('circle', { cx: x, cy: y, r: 19, class: 'dv-cap' }, g);
    sv('circle', { cx: x, cy: y, r: 13, class: 'dv-capin' }, g);
    sv('line', { x1: x, y1: y - 5, x2: x, y2: y - 16, class: 'dv-ind' }, g);
    if (!mini || isHL(n)) lab(g, x, y - 32, n);
  }
  [['OCT-', 54], ['OCT+', 120]].forEach(([n, x]) => {
    const g = ctl(n);
    sv('rect', { x, y: 222, width: 54, height: 28, rx: 6, class: 'dv-btn' }, g);
    lab(g, x + 27, 241, n.replace('-', '−'), 'dv-blab');
  });
  [P_R1, P_R2].forEach((row, j) => row.forEach((n, i) => {
    const g = ctl(n), X = P_BX[i], Y = P_BY[j];
    sv('rect', { x: X - 22, y: Y - 22, width: 44, height: 44, rx: 9, class: 'dv-btn' }, g);
    lab(g, X, Y + 4, n === 'PLAY' ? 'PLAY' : n, 'dv-blab');
  }));
  let w = 0, bk = 0;
  for (let n = 0; n < 27; n++) {
    const black = isBlackIdx(n), name = keyName(n);
    const x = 64 + (black ? w - 0.5 : w) * 47.6;
    const g = ctl(name);
    g.classList.add(black ? 'kb' : 'kw');
    const y = black ? 300 : 382, kw = black ? 40 : 43, kh = black ? 76 : 77;
    g.dataset.cx = x; g.dataset.cy = y + kh / 2;
    sv('rect', { x: x - kw / 2, y, width: kw, height: kh, rx: kw / 2, class: 'dv-key' }, g);
    if (black) bk++;
    if (!mini) {
      if (black && P_UP[bk - 1]) lab(g, x, 293, P_UP[bk - 1], 'dv-print');
      lab(g, x, black ? 392 : 474, name, 'dv-kname');
    } else if (isHL(name)) lab(g, x, black ? 392 : 474, name, 'dv-kname');
    if (!black) w++;
  }
  if (o.steps) {
    hl.forEach((id, i) => {
      const g = ctls[id]; if (!g) return;
      let cx, cy;
      const k = P_KNOBS.find(q => q[0] === id);
      if (k) { cx = k[1] + 26; cy = k[2] + 24; }
      else if (P_R1.indexOf(id) >= 0) { cx = P_BX[P_R1.indexOf(id)] + 19; cy = P_BY[0] - 21; }
      else if (P_R2.indexOf(id) >= 0) { cx = P_BX[P_R2.indexOf(id)] + 19; cy = P_BY[1] - 21; }
      else if (id === 'OCT-' || id === 'OCT+') { cx = id === 'OCT-' ? 100 : 166; cy = 220; }
      else if (g.dataset.cx) { cx = +g.dataset.cx + 15; cy = +g.dataset.cy - 34; }
      else return;
      const bg = sv('g', { class: 'dv-step' }, s);
      sv('circle', { cx, cy, r: 13 }, bg);
      const t = sv('text', { x: cx, y: cy + 6, 'text-anchor': 'middle' }, bg); t.textContent = String(i + 1);
    });
  }
  return { svg: s, ctls };
}

/* ---------------------------------------------------------------- navegación, avance y pequeñas interacciones */
const Labs = {
  defs: {},
  def(id, fn) { this.defs[id] = fn; },
  build(node) {
    if (node._lab) return node._lab;
    const fn = this.defs[node.dataset.lab];
    if (!fn) return null;
    node.innerHTML = '';
    try { node._lab = fn(node) || {}; }
    catch (e) { console.error(e); node.innerHTML = '<p class="lab-n">Este laboratorio no pudo iniciarse en este navegador.</p>'; node._lab = {}; }
    const L = node._lab;
    if (L.inst) node.addEventListener('pointerdown', () => Dock.use(L.inst, L.name), true);
    return L;
  }
};
const DEFAULT_INST = new Synth({ osc: [{ w: 'triangle' }], f: { cut: 6000 }, ae: { a: 0.006, d: 0.4, s: 0.6, r: 0.35 }, gain: 0.3 });
let activeLabs = [];
function activate(view) {
  activeLabs.forEach(L => { try { L.hide && L.hide(); } catch (e) { console.error(e); } });
  activeLabs = $$('.lab[data-lab]', view).map(n => Labs.build(n)).filter(Boolean);
  activeLabs.forEach(L => { try { L.show && L.show(); } catch (e) { console.error(e); } });
  const wi = activeLabs.find(L => L.inst);
  Dock.use(wi ? wi.inst : DEFAULT_INST, wi ? wi.name : 'Triángulo suave');
  Anim.set(activeLabs.filter(L => L.draw).map(L => L.draw));
}
const Router = {
  order: [], cur: null,
  init() {
    this.order = $$('#rail a[data-l]').map(a => a.dataset.l);
    W.addEventListener('hashchange', () => this.go(location.hash.slice(1)));
    this.go(location.hash.slice(1) || 'inicio', true);
  },
  go(id, first) {
    const v = $('.view[data-view="' + id + '"]') || $('.view[data-view="inicio"]');
    if (!v) return;
    id = v.dataset.view;
    if (this.cur === id) return;
    $$('.view').forEach(x => { x.hidden = x !== v; });
    this.cur = id;
    $$('#rail a[data-l]').forEach(a => { if (a.dataset.l === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    activate(v);
    if (!first) {
      W.scrollTo(0, 0);
      const h = v.querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    document.body.classList.remove('rail-open');
  }
};
const Prog = {
  done: new Set(store.get('done', [])),
  toggle(id) { if (this.done.has(id)) this.done.delete(id); else this.done.add(id); store.set('done', [...this.done]); this.ui(); },
  ui() {
    const all = Router.order.length || 1, n = Router.order.filter(id => this.done.has(id)).length;
    $$('#rail a[data-l]').forEach(a => a.classList.toggle('done', this.done.has(a.dataset.l)));
    $$('[data-prog-n]').forEach(e => { e.textContent = n + ' de ' + all; });
    $$('[data-prog-bar]').forEach(e => { e.style.width = (n / all * 100) + '%'; });
    $$('.mark').forEach(b => { const d = this.done.has(b.dataset.id); b.setAttribute('aria-pressed', d ? 'true' : 'false'); b.querySelector('span').textContent = d ? 'Lección completada' : 'Marcar como completada'; });
    const nx = $('#continue');
    if (nx) { const next = Router.order.find(id => !this.done.has(id)) || Router.order[0]; nx.href = '#' + next; const a = $('#rail a[data-l="' + next + '"]'); const lab = $('#continue-t'); if (lab && a) lab.textContent = a.textContent.replace(/^\d+/, '').trim(); }
  }
};
function lessonNav() {
  $$('nav.lnav').forEach(nav => {
    const view = nav.closest('.view'), id = view.dataset.view, i = Router.order.indexOf(id);
    const prev = Router.order[i - 1], next = Router.order[i + 1];
    const t = k => { const a = $('#rail a[data-l="' + k + '"]'); return a ? a.textContent.replace(/^\d+/, '').trim() : ''; };
    nav.innerHTML = '';
    const mk = el('button', 'mark', nav); mk.type = 'button'; mk.dataset.id = id;
    mk.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Marcar como completada</span>';
    mk.addEventListener('click', () => Prog.toggle(id));
    const row = el('div', 'lnav-r', nav);
    if (prev) el('a', 'lnav-a prev', row, '<small>Anterior</small><span>' + t(prev) + '</span>').href = '#' + prev;
    else el('a', 'lnav-a prev', row, '<small>Volver</small><span>Inicio del curso</span>').href = '#inicio';
    if (next) el('a', 'lnav-a next', row, '<small>Siguiente</small><span>' + t(next) + '</span>').href = '#' + next;
  });
}
function quizzes() {
  $$('.quiz').forEach(q => {
    const fb = $('.q-f', q);
    $$('.q-o button', q).forEach(b => {
      b.type = 'button';
      b.addEventListener('click', () => {
        if (q.classList.contains('solved')) return;
        const ok = b.hasAttribute('data-ok');
        b.classList.add(ok ? 'ok' : 'no');
        if (ok) { q.classList.add('solved'); fb.textContent = fb.dataset.ok || '¡Correcto!'; fb.className = 'q-f ok'; }
        else { fb.textContent = b.dataset.why || fb.dataset.no || 'No exactamente. Prueba otra opción.'; fb.className = 'q-f no'; }
      });
    });
  });
}
function tries() {
  const st = store.get('try', {});
  $$('.try input[type=checkbox]').forEach(c => {
    if (st[c.id]) c.checked = true;
    c.addEventListener('change', () => { st[c.id] = c.checked; store.set('try', st); });
  });
}
function minis() {
  $$('.fm-mini, .fm-full').forEach(f => {
    const hl = (f.dataset.hl || '').split(',').map(x => x.trim()).filter(Boolean);
    panel(f, { hl, mini: f.classList.contains('fm-mini'), steps: f.hasAttribute('data-steps'), title: f.dataset.title, label: f.getAttribute('aria-label') || undefined });
  });
}

function init() {
  const sb = $('#snd');
  if (sb) sb.addEventListener('click', () => {
    if (A.on) { A.ctx.suspend().then(() => soundUI()); }
    else A.ensure();
  });
  $$('[data-unlock]').forEach(b => b.addEventListener('click', () => A.ensure()));
  const rt = $('#rail-t');
  if (rt) rt.addEventListener('click', () => { const o = !document.body.classList.contains('rail-open'); document.body.classList.toggle('rail-open', o); rt.setAttribute('aria-expanded', o ? 'true' : 'false'); });
  const sc = $('#scrim'); if (sc) sc.addEventListener('click', () => document.body.classList.remove('rail-open'));
  minis(); quizzes(); tries();
  Dock.init();
  Router.init();
  lessonNav();
  Prog.ui();
  soundUI();
  document.documentElement.classList.add('js');
}

W.FM1C = { $, $$, el, sv, clamp, lerp, mtof, pc, nameEn, nameEs, dec, fHz, fS, fPct, RM, store, heat, HEATS, A, Env, pwHarm, pwCycle, cycle, Inst, Synth, lfoShape, FX, distCurve, makeIR, SC, fit, grid, txt, path, idle, scope, spectrum, UI, ICON, Anim, Player, Dock, panel, Labs, Router, Prog };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
})();
