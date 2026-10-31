/* Síntesis con tu FM-1 · motores de síntesis para los laboratorios */
(function () {
'use strict';
const F = window.FM1C;
const { A, Env, Inst, clamp, mtof } = F;
const mrg = (a, b) => { for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && v.constructor === Object) { if (!a[k] || typeof a[k] !== 'object') a[k] = {}; mrg(a[k], v); } else a[k] = v; } return a; };

/* ------------------------------------------------ FM de dos operadores */
function besselJ(n, x) {
  const N = 200; let s = 0;
  for (let i = 0; i < N; i++) { const tau = (i + 0.5) * Math.PI / N; s += Math.cos(n * tau - x * Math.sin(tau)); }
  return s / N;
}
/* bandas laterales: portadora ± k·moduladora, con amplitud J_k(índice) */
function fmLines(cr, mr, I, K = 24) {
  const map = new Map();
  for (let k = -K; k <= K; k++) {
    const f = cr + k * mr;
    let a = besselJ(Math.abs(k), I);
    if (k < 0 && (k % 2)) a = -a;
    if (f < 0) a = -a;
    const key = Math.abs(f).toFixed(4);
    map.set(key, (map.get(key) || 0) + a);
  }
  return [...map].map(([f, a]) => ({ f: +f, a: Math.abs(a) })).filter(o => o.a > 0.004);
}
/* un operador que se modula a sí mismo (realimentación): de seno a casi-sierra */
function fbCycle(beta, N = 1024) {
  const c = new Float32Array(N); let y1 = 0, y2 = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
    const y = Math.sin(2 * Math.PI * i / N + beta * (y1 + y2) * 0.5);
    y2 = y1; y1 = y; c[i] = y;
  }
  return c;
}
class FM2 extends Inst {
  constructor(p) {
    super();
    this.p = mrg({ gain: 0.26, cr: 1, mr: 1, idx: 2, ienv: true, ia: 0.002, id: 0.7, is: 0.25, ir: 0.5, a: 0.003, d: 1.6, s: 0.3, r: 0.5, fb: 0, vel: 0.5, det: 0 }, p || {});
    this.gain = this.p.gain; this.fbw = null; this.fbk = -1;
  }
  _modWave() {
    const fb = this.p.fb; if (fb <= 0.001) return null;
    if (this.fbw && this.fbk === fb) return this.fbw;
    this.fbk = fb; this.fbw = F.pwCycle(fbCycle(fb), 64); return this.fbw;
  }
  _start(m, vel, t) {
    const p = this.p, ctx = A.ctx, f = mtof(m), fm = f * p.mr;
    const car = ctx.createOscillator(), mod = ctx.createOscillator();
    car.frequency.value = f * p.cr; mod.frequency.value = fm; car.detune.value = p.det;
    const w = this._modWave(); if (w) mod.setPeriodicWave(w);
    const mg = ctx.createGain(); mg.gain.value = 0; mod.connect(mg); mg.connect(car.frequency);
    const amp = ctx.createGain(); amp.gain.value = 0; car.connect(amp); amp.connect(this.out);
    const vs = (1 - p.vel) + p.vel * vel;
    const v = { car, mod, mg, amp, f, t0: t };
    v.ie = new Env(mg.gain);
    if (p.ienv) v.ie.on(t, p.ia, p.id, p.is, p.idx * fm * vs);
    else mg.gain.setValueAtTime(p.idx * fm, t);
    v.ae = new Env(amp.gain); v.ae.on(t, p.a, p.d, p.s, vs);
    car.start(t); mod.start(t);
    this._ends(v, car);
    return v;
  }
  _stop(v, t, rr) {
    const p = this.p, r = rr != null ? rr : p.r;
    v.ae.off(t, r); if (p.ienv) v.ie.off(t, rr != null ? rr : p.ir);
    const end = t + r * 1.4 + 0.05; v.car.stop(end); v.mod.stop(end);
  }
  _kill(v) { try { v.amp.disconnect(); } catch (e) {} }
  /* índice actual de una voz, para dibujar */
  idxNow(v, t) { const p = this.p; if (!p.ienv) return p.idx; const fm = v.f * p.mr; return v.ie.val(t) / (fm || 1); }
  set(q) {
    mrg(this.p, q || {}); if (!this.ok) return;
    const p = this.p, t = A.t, w = this._modWave();
    this.out.gain.setTargetAtTime(p.gain, t, 0.02);
    for (const v of this.vs) {
      const fm = v.f * p.mr;
      v.car.frequency.setTargetAtTime(v.f * p.cr, t, 0.01); v.mod.frequency.setTargetAtTime(fm, t, 0.01);
      v.car.detune.setTargetAtTime(p.det, t, 0.02);
      if (w) v.mod.setPeriodicWave(w); else v.mod.type = 'sine';
      if (!p.ienv && v.rel == null) { v.mg.gain.cancelScheduledValues(t); v.mg.gain.setTargetAtTime(p.idx * fm, t, 0.02); }
    }
  }
}

/* ------------------------------------------------ distorsión de fase (al estilo Casio CZ) */
function pdPhase(type, dcw, x) {
  if (type === 'saw') { const b = 0.5 - 0.48 * dcw; return x < b ? 0.5 * x / b : 0.5 + 0.5 * (x - b) / (1 - b); }
  if (type === 'sqr') { const q = 0.5 - 0.48 * dcw, hx = x < 0.5 ? x : x - 0.5, off = x < 0.5 ? 0 : 0.5; return off + (hx < q ? 0.5 * hx / q : 0.5); }
  return x;
}
function pdSample(type, dcw, x) {
  if (type === 'res') { const k = 1 + dcw * 12; return (1 - x) * -Math.cos(2 * Math.PI * x * k); }
  return -Math.cos(2 * Math.PI * pdPhase(type, dcw, x));
}
function pdCycle(type, dcw, N = 1024) { const c = new Float32Array(N); for (let i = 0; i < N; i++) c[i] = pdSample(type, dcw, i / N); return c; }
class PD extends Inst {
  constructor(p) { super(); this.p = mrg({ gain: 0.3, type: 'saw', dcw: 0.4, env: 0, ed: 0.5, a: 0.004, d: 0.8, s: 0.75, r: 0.35 }, p || {}); this.gain = this.p.gain; this.cache = new Map(); }
  wave(type, q) { const key = type + q; let w = this.cache.get(key); if (!w) { w = F.pwCycle(pdCycle(type, q / 48), 96); this.cache.set(key, w); } return w; }
  dcwAt(v, t) { const p = this.p; if (!p.env) return p.dcw; return clamp(p.dcw + p.env * Math.exp(-(t - v.t0) / p.ed), 0, 1); }
  _setW(v, t) { const q = Math.round(clamp(this.dcwAt(v, t), 0, 1) * 48); if (q !== v.q) { v.q = q; v.os.setPeriodicWave(this.wave(this.p.type, q)); } }
  _start(m, vel, t) {
    const ctx = A.ctx, p = this.p, os = ctx.createOscillator();
    os.frequency.value = mtof(m);
    const v = { os, q: -1, t0: t };
    this._setW(v, t);
    const amp = ctx.createGain(); amp.gain.value = 0; os.connect(amp); amp.connect(this.out); v.amp = amp;
    v.ae = new Env(amp.gain); v.ae.on(t, p.a, p.d, p.s, 0.5 + 0.5 * vel);
    os.start(t); this._ends(v, os); return v;
  }
  _stop(v, t, rr) { const r = rr != null ? rr : this.p.r; v.ae.off(t, r); v.os.stop(t + r * 1.4 + 0.05); }
  _kill(v) { try { v.amp.disconnect(); } catch (e) {} }
  tick() { const t = A.t; for (const v of this.vs) this._setW(v, Math.max(t, v.t0)); }
  set(q) { mrg(this.p, q || {}); for (const v of this.vs) v.q = -1; if (this.ok) this.tick(); }
}

/* ------------------------------------------------ órgano de drawbars (como WHEEL) */
const DB_FEET = ["16'", "5⅓'", "8'", "4'", "2⅔'", "2'", "1⅗'", "1⅓'", "1'"];
const DB_H = [1, 3, 2, 4, 6, 8, 10, 12, 16];  /* armónicos de la mitad de la nota: 0,5 · 1,5 · 1 · 2 · 3 · 4 · 5 · 6 · 8 */
class Organ extends Inst {
  constructor(p) { super(); this.p = mrg({ gain: 0.2, bars: [8, 8, 8, 0, 0, 0, 0, 0, 0], perc: 0, click: 0.35, rotor: 0 }, p || {}); this.gain = this.p.gain; }
  _init(ctx) {
    this.rot = ctx.createGain(); this.pn = ctx.createStereoPanner();
    this.out.disconnect(); this.out.connect(this.rot); this.rot.connect(this.pn); this.pn.connect(this.dest || A.bus);
    this.rl = ctx.createOscillator(); this.rl.frequency.value = 0.8;
    this.ra = ctx.createGain(); this.rp = ctx.createGain(); this.rpi = ctx.createGain();
    this.ra.gain.value = 0; this.rp.gain.value = 0; this.rpi.gain.value = 0;
    this.rl.connect(this.ra); this.rl.connect(this.rp); this.rl.connect(this.rpi);
    this.ra.connect(this.rot.gain); this.rp.connect(this.pn.pan); this.rl.start();
    this._wave(); this._rotor();
  }
  route(n) { this.dest = n; if (this.ok) { this.pn.disconnect(); this.pn.connect(n || A.bus); } }
  amps() { const a = new Array(16).fill(0); this.p.bars.forEach((b, i) => { if (b > 0) a[DB_H[i] - 1] += Math.pow(10, (b - 8) * 3 / 20); }); return a; }
  _wave() { const a = this.amps(); if (a.every(x => x === 0)) a[1] = 1e-4; this.w = F.pwHarm(a); for (const v of this.vs) v.os.setPeriodicWave(this.w); }
  _rotor() {
    const r = this.p.rotor, t = A.t, d = r ? 1 : 0;
    this.rl.frequency.setTargetAtTime(r === 2 ? 6.6 : 0.8, t, r === 2 ? 0.45 : 1.1);
    this.ra.gain.setTargetAtTime(0.16 * d, t, 0.3); this.rot.gain.setTargetAtTime(1 - 0.16 * d, t, 0.3);
    this.rp.gain.setTargetAtTime(0.55 * d, t, 0.3); this.rpi.gain.setTargetAtTime(7 * d, t, 0.3);
  }
  set(q) { const old = JSON.stringify(this.p.bars), oldR = this.p.rotor; mrg(this.p, q || {}); if (!this.ok) return; if (JSON.stringify(this.p.bars) !== old) this._wave(); if (this.p.rotor !== oldR) this._rotor(); }
  _start(m, vel, t) {
    const ctx = A.ctx, p = this.p, f = mtof(m);
    const os = ctx.createOscillator(); os.setPeriodicWave(this.w); os.frequency.value = f / 2; this.rpi.connect(os.detune);
    const amp = ctx.createGain(); amp.gain.value = 0; os.connect(amp); amp.connect(this.out);
    const v = { os, amp, src: [os] };
    v.ae = new Env(amp.gain); v.ae.on(t, 0.006, 0.05, 1, 1);
    if (p.perc) {
      const po = ctx.createOscillator(); po.frequency.value = f * p.perc;
      const pg = ctx.createGain(); pg.gain.setValueAtTime(0.55, t); pg.gain.setTargetAtTime(0, t, 0.13);
      po.connect(pg); pg.connect(amp); po.start(t); v.src.push(po);
    }
    if (p.click > 0) {
      const ns = ctx.createBufferSource(); ns.buffer = A.noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const cg = ctx.createGain(); cg.gain.setValueAtTime(p.click * 0.45, t); cg.gain.setTargetAtTime(0, t, 0.004);
      ns.connect(hp); hp.connect(cg); cg.connect(this.out); ns.start(t, Math.random()); ns.stop(t + 0.05);
    }
    os.start(t); this._ends(v, os); return v;
  }
  _stop(v, t, rr) { const r = rr != null ? rr : 0.04; v.ae.off(t, r); for (const s of v.src) { try { s.stop(t + r * 1.4 + 0.05); } catch (e) {} } }
  _kill(v) { try { this.rpi.disconnect(v.os.detune); } catch (e) {} try { v.amp.disconnect(); } catch (e) {} }
}

/* ------------------------------------------------ aditiva con parciales (como ADD) */
const SPECTRA = {
  harm: { name: 'HARM · armónico', r: n => n },
  odd: { name: 'ODD · impares', r: n => 2 * n - 1 },
  bell: { name: 'BELL · campana', list: [0.5, 1, 1.19, 1.5, 2, 2.5, 2.66, 3, 4.07, 5.2] },
  bar: { name: 'BAR · barra metálica', list: [1, 2.756, 5.404, 8.933, 13.34] },
  drum: { name: 'DRUM · membrana', list: [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501, 3.6, 4.06] },
  sub: { name: 'SUB · subarmónico', list: [0.5, 1, 1.5, 2, 3, 4, 6, 8] }
};
function partialList(p) {
  const S = SPECTRA[p.kind] || SPECTRA.harm, out = [];
  const n = Math.max(1, p.n | 0);
  for (let i = 0; i < n; i++) {
    let r = S.list ? S.list[i] : S.r(i + 1);
    if (r == null) break;
    r = r * (1 + p.stretch * (r - 1) * 0.03);
    const a = Math.pow(1 / (i + 1), 1.6 - p.bright * 1.4);
    out.push({ r, a });
  }
  return out;
}
class Partials extends Inst {
  constructor(p) { super(); this.p = mrg({ gain: 0.32, kind: 'harm', n: 10, bright: 0.5, stretch: 0, decay: 2.5, hi: 0.6, sus: 0, a: 0.004, r: 0.5 }, p || {}); this.gain = this.p.gain; }
  _start(m, vel, t) {
    const ctx = A.ctx, p = this.p, f = mtof(m), nyq = ctx.sampleRate / 2 - 500, list = partialList(p);
    const sum = list.reduce((s, q) => s + q.a, 0) || 1;
    const v = { o: [], g: [], master: ctx.createGain(), t0: t };
    v.master.gain.value = 1; v.master.connect(this.out);
    list.forEach(q => {
      const fr = f * q.r; if (fr > nyq) return;
      const os = ctx.createOscillator(); os.frequency.value = fr;
      const g = ctx.createGain(); g.gain.value = 0;
      const pk = (q.a / sum) * (0.5 + 0.5 * vel) * 1.6;
      const tau = Math.max(0.03, p.decay / (1 + p.hi * (q.r - 1) * 0.9));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + p.a);
      g.gain.setTargetAtTime(pk * p.sus, t + p.a, tau / 3);
      os.connect(g); g.connect(v.master); os.start(t);
      v.o.push(os); v.g.push(g);
    });
    if (!v.o.length) return null;
    this._ends(v, v.o[0]); return v;
  }
  _stop(v, t, rr) {
    const r = rr != null ? rr : this.p.r;
    v.master.gain.setValueAtTime(1, t); v.master.gain.setTargetAtTime(0, t, r / 5);
    v.o.forEach(o => { try { o.stop(t + r * 1.3 + 0.05); } catch (e) {} });
  }
  _kill(v) { try { v.master.disconnect(); } catch (e) {} }
}

/* ------------------------------------------------ cuerda Karplus-Strong (como STRING) */
function ksRender(sr, f, p, vel = 0.8) {
  const T = 0.35 + p.decay * 7, dur = Math.min(8, T + 0.3), n = Math.floor(sr * dur);
  const Lt = sr / f, N = Math.max(4, Math.floor(Lt - 0.6)), d = Lt - 0.5 - N, C = (1 - d) / (1 + d);
  const dl = new Float32Array(N);
  /* excitación: con qué se toca la cuerda */
  const pos = Math.max(1, Math.round(clamp(p.pos, 0.04, 0.5) * N));
  for (let i = 0; i < N; i++) {
    const x = i / N;
    let e;
    if (p.exc === 'hammer') e = Math.exp(-Math.pow((x - 0.25) / 0.06, 2)) - Math.exp(-Math.pow((x - 0.75) / 0.06, 2));
    else if (p.exc === 'pick') e = (x < p.pos ? x / p.pos : (1 - x) / (1 - p.pos)) * 1.6 - 0.8 + (Math.random() * 2 - 1) * 0.25;
    else if (p.exc === 'bow') e = (Math.random() * 2 - 1) * 0.05;
    else e = Math.random() * 2 - 1;
    dl[i] = e;
  }
  if (p.exc === 'pluck' || p.exc === 'noise') {
    if (p.exc === 'pluck') { let lp = 0; const k = 0.15 + 0.8 * p.bright; for (let i = 0; i < N; i++) { lp += (dl[i] - lp) * k; dl[i] = lp * 1.6; } }
    const c = Float32Array.from(dl);
    for (let i = 0; i < N; i++) dl[i] = c[i] - c[(i + pos) % N];
  }
  let mean = 0; for (let i = 0; i < N; i++) mean += dl[i]; mean /= N; for (let i = 0; i < N; i++) dl[i] = (dl[i] - mean) * (0.35 + 0.65 * vel);
  const out = new Float32Array(n), g = Math.pow(0.001, 1 / (T * f)), S = 0.5 - 0.42 * p.bright;
  const snaps = [], every = Math.round(sr / 40), pts = 96;
  let idx = 0, xp = 0, apx = 0, apy = 0;
  for (let i = 0; i < n; i++) {
    const x = dl[idx];
    out[i] = x;
    const lp = (1 - S) * x + S * xp; xp = x;
    const ap = C * lp + apx - C * apy; apx = lp; apy = ap;
    let nx = ap * g;
    if (p.exc === 'bow' && i < n - sr * 0.3) nx += (Math.random() * 2 - 1) * 0.012 * Math.min(1, i / (sr * 0.15));
    dl[idx] = nx;
    idx = (idx + 1) % N;
    if (i % every === 0 && snaps.length < 160) { const s = new Float32Array(pts); for (let k = 0; k < pts; k++) s[k] = dl[(idx + Math.floor(k / pts * N)) % N]; snaps.push(s); }
  }
  const fade = Math.floor(sr * 0.25); for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return { buf: out, snaps, dt: every / sr, N };
}
class Strings extends Inst {
  constructor(p) { super(); this.p = mrg({ gain: 0.55, exc: 'pluck', decay: 0.45, bright: 0.6, pos: 0.18, damp: 0.12 }, p || {}); this.gain = this.p.gain; this.last = null; }
  _start(m, vel, t) {
    const ctx = A.ctx, r = ksRender(ctx.sampleRate, mtof(m), this.p, vel);
    const b = ctx.createBuffer(1, r.buf.length, ctx.sampleRate); b.getChannelData(0).set(r.buf);
    const s = ctx.createBufferSource(); s.buffer = b;
    const g = ctx.createGain(); g.gain.value = 1; s.connect(g); g.connect(this.out); s.start(t);
    const v = { s, g, r, t0: t }; this.last = v; this._ends(v, s); return v;
  }
  _stop(v, t, rr) { const r = rr != null ? rr : this.p.damp; v.g.gain.setValueAtTime(1, t); v.g.gain.setTargetAtTime(0, t, r / 4); try { v.s.stop(t + r * 1.6 + 0.05); } catch (e) {} }
  _kill(v) { try { v.g.disconnect(); } catch (e) {} }
}

/* ------------------------------------------------ voz por formantes (como VOICE) */
const VOWELS = { i: [290, 2300, 3000], e: [450, 1950, 2600], a: [720, 1300, 2600], o: [480, 900, 2450], u: [320, 780, 2350] };
class Formant extends Inst {
  constructor(p) { super(); this.p = mrg({ gain: 0.85, f1: 720, f2: 1300, f3: 2600, sharp: 1, buzz: 0.6, breath: 0.08, shift: 1, glide: 0.09, vib: 16, a: 0.05, r: 0.2 }, p || {}); this.gain = this.p.gain; this.held = []; this.cur = null; }
  _init(ctx) {
    const p = this.p;
    this.os = ctx.createOscillator(); this.os.type = 'sawtooth'; this.os.frequency.value = 220;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass';
    this.ns = ctx.createBufferSource(); this.ns.buffer = A.noise; this.ns.loop = true; this.ng = ctx.createGain();
    this.amp = ctx.createGain(); this.amp.gain.value = 0; this.amp.connect(this.out);
    this.bp = [0, 1, 2].map(() => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; return b; });
    this.bg = [1, 0.62, 0.32].map(x => { const g = ctx.createGain(); g.gain.value = x; return g; });
    this.os.connect(this.lp);
    this.bp.forEach((b, i) => { this.lp.connect(b); this.ng.connect(b); b.connect(this.bg[i]); this.bg[i].connect(this.amp); });
    this.ns.connect(this.ng);
    this.vl = ctx.createOscillator(); this.vl.frequency.value = 5.4; this.vg = ctx.createGain(); this.vg.gain.value = 0; this.vl.connect(this.vg); this.vg.connect(this.os.detune);
    this.os.start(); this.ns.start(); this.vl.start();
    this.env = new Env(this.amp.gain);
    this._apply(true);
    void p;
  }
  _apply(now) {
    const p = this.p, t = A.t, tc = now ? 0.001 : 0.03;
    const fs = [p.f1, p.f2, p.f3].map(f => f * p.shift), bw = [75, 95, 150];
    this.bp.forEach((b, i) => { b.frequency.setTargetAtTime(fs[i], t, tc); b.Q.setTargetAtTime(fs[i] / (bw[i] / p.sharp), t, tc); });
    this.lp.frequency.setTargetAtTime(500 + p.buzz * 7000, t, tc);
    this.ng.gain.setTargetAtTime(p.breath * 0.9, t, tc);
    this.out.gain.setTargetAtTime(p.gain, t, tc);
  }
  set(q) { mrg(this.p, q || {}); if (this.ok) this._apply(false); }
  vowel(f1, f2, f3) { this.set({ f1, f2, f3: f3 || this.p.f3 }); }
  _go(m, t, vel, attack) {
    const p = this.p, f = mtof(m);
    if (attack) { this.os.frequency.setValueAtTime(f, t); this.env.on(t, p.a, 0.2, 0.9, 0.5 + 0.5 * vel); this.vg.gain.setValueAtTime(0, t); this.vg.gain.setTargetAtTime(p.vib, t + 0.25, 0.25); }
    else this.os.frequency.setTargetAtTime(f, t, Math.max(0.005, p.glide / 3));
    this.cur = m;
  }
  noteOn(m, vel = 0.8) {
    if (!this._b()) return null;
    const t = A.t, wasOn = this.held.length > 0;
    this.held = this.held.filter(x => x !== m); this.held.push(m);
    this._go(m, t, vel, !wasOn);
    return null;
  }
  noteOff(m) {
    if (!this.ok) return;
    const t = A.t;
    this.held = this.held.filter(x => x !== m);
    if (this.held.length) this._go(this.held[this.held.length - 1], t, 0.8, false);
    else { this.env.off(t, this.p.r); this.cur = null; }
  }
  play(m, vel, t, dur) {
    if (!this._b()) return null;
    const p = this.p, f = mtof(m);
    this.os.frequency.setTargetAtTime(f, t, Math.max(0.005, p.glide / 3));
    this.env.on(t, p.a, 0.2, 0.9, 0.5 + 0.5 * vel); this.env.off(t + dur, p.r);
    return null;
  }
  allOff() { if (!this.ok) return; this.held = []; this.env.off(A.t, 0.08); this.cur = null; }
}

/* ------------------------------------------------ bits y muestras (como LOFI) */
function chipWave(kind, x, duty) {
  if (kind === 'pulse') return x < duty ? 1 : -1;
  if (kind === 'tri') return x < 0.5 ? 4 * x - 1 : 3 - 4 * x;
  if (kind === 'saw') return 2 * x - 1;
  return Math.sin(2 * Math.PI * x);
}
function chipRender(sr, f, p, cycles) {
  const n = Math.max(64, Math.round(cycles * sr / f)), d = new Float32Array(n);
  const lv = Math.pow(2, p.bits) - 1, div = Math.max(1, p.div | 0);
  let ph = 0, held = 0;
  for (let i = 0; i < n; i++) {
    if (i % div === 0) { let y = chipWave(p.wave, ph, p.duty); if (p.bits < 16) y = Math.round((y * 0.5 + 0.5) * lv) / lv * 2 - 1; held = y; }
    d[i] = held * 0.55; ph += f / sr; ph -= Math.floor(ph);
  }
  return d;
}
class Chip extends Inst {
  constructor(p) { super(); this.p = mrg({ gain: 0.3, wave: 'pulse', duty: 0.5, bits: 4, div: 1, a: 0.003, r: 0.12 }, p || {}); this.gain = this.p.gain; }
  _buf(f) { const ctx = A.ctx, cyc = Math.max(1, Math.round(f * 0.6)), d = chipRender(ctx.sampleRate, f, this.p, cyc), b = ctx.createBuffer(1, d.length, ctx.sampleRate); b.getChannelData(0).set(d); return b; }
  _start(m, vel, t) {
    const ctx = A.ctx, s = ctx.createBufferSource(); s.buffer = this._buf(mtof(m)); s.loop = true;
    const g = ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.out);
    const v = { s, g, t0: t }; v.ae = new Env(g.gain); v.ae.on(t, this.p.a, 0.1, 0.9, 0.6 + 0.4 * vel);
    s.start(t); this._ends(v, s); return v;
  }
  _stop(v, t, rr) { const r = rr != null ? rr : this.p.r; v.ae.off(t, r); try { v.s.stop(t + r * 1.4 + 0.05); } catch (e) {} }
  _kill(v) { try { v.g.disconnect(); } catch (e) {} }
  set(q) { mrg(this.p, q || {}); }
}
/* bytebeat: música escrita como una fórmula de t (un contador de muestras) */
const BYTEBEATS = [
  { name: 'Viznut', code: 't*(((t>>12)|(t>>8))&(63&(t>>4)))', f: t => t * (((t >> 12) | (t >> 8)) & (63 & (t >> 4))) },
  { name: 'Tejeez', code: '(t*(t>>5|t>>8))>>(t>>16)', f: t => (t * ((t >> 5) | (t >> 8))) >> (t >> 16) },
  { name: '42', code: 't*(42&t>>10)', f: t => t * (42 & (t >> 10)) },
  { name: 'Escalones', code: '(t*5&t>>7)|(t*3&t>>10)', f: t => ((t * 5) & (t >> 7)) | ((t * 3) & (t >> 10)) }
];
function byteRender(fn, secs = 32) {
  const sr = 8000, n = sr * secs, d = new Float32Array(n), raw = new Uint8Array(n);
  for (let t = 0; t < n; t++) { const v = fn(t) & 255; raw[t] = v; d[t] = (v / 127.5 - 1) * 0.42; }
  return { d, raw, sr };
}

/* ------------------------------------------------ batería sintetizada (como DRUM-X) */
const DRUM_PC = { 0: 'bd', 1: 'rs', 2: 'sd', 3: 'cp', 4: 'sd', 5: 'lt', 6: 'ch', 7: 'mt', 8: 'cb', 9: 'ht', 10: 'oh', 11: 'oh' };
const DRUM_NAME = { bd: 'Bombo (BD)', sd: 'Caja (SD)', cp: 'Palmas (CP)', ch: 'Charles cerrado (CH)', oh: 'Charles abierto (OH)', lt: 'Tom grave', mt: 'Tom medio', ht: 'Tom agudo', rs: 'Aro (RS)', cb: 'Cencerro (CB)' };
class Drums extends Inst {
  constructor(p) { super(); this.p = mrg({ gain: 0.55, tune: 1, decay: 1, tone: 0.5, pmod: 1, noise: 1 }, p || {}); this.gain = this.p.gain; this.hits = []; }
  hit(kind, t, vel = 0.9) {
    if (!this._b()) return null;
    const ctx = A.ctx, p = this.p, o = this.out, tn = p.tune, dk = p.decay;
    const G = (v0) => { const g = ctx.createGain(); g.gain.value = v0; return g; };
    const env = (g, pk, tau, at = 0.001) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + at); g.gain.setTargetAtTime(0, t + at, tau); };
    const noise = (dur) => { const s = ctx.createBufferSource(); s.buffer = A.noise; s.start(t, Math.random() * 1.2); s.stop(t + dur); return s; };
    const flt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; return b; };
    let main = null, end = t + 1;
    if (kind === 'bd') {
      const os = ctx.createOscillator(), g = G(0), f0 = 50 * tn;
      os.frequency.setValueAtTime(f0 * (1 + 5 * p.pmod), t); os.frequency.exponentialRampToValueAtTime(f0, t + 0.055 + 0.04 * p.pmod);
      env(g, vel, 0.11 * dk + 0.02); os.connect(g); g.connect(o); os.start(t); end = t + 0.9 * dk + 0.3; os.stop(end); main = os;
      const c = noise(0.03), hp = flt('highpass', 1800), cg = G(0); env(cg, 0.35 * vel * p.noise, 0.004); c.connect(hp); hp.connect(cg); cg.connect(o);
    } else if (kind === 'sd') {
      const os = ctx.createOscillator(), g = G(0); os.type = 'triangle';
      os.frequency.setValueAtTime(185 * tn * 1.5, t); os.frequency.exponentialRampToValueAtTime(185 * tn, t + 0.03);
      env(g, 0.7 * vel, 0.05 * dk); os.connect(g); g.connect(o); os.start(t); os.stop(t + 0.6);
      const n = noise(0.7), hp = flt('highpass', 1200 + 2500 * p.tone), ng = G(0); env(ng, 0.75 * vel * p.noise, 0.07 * dk + 0.01);
      n.connect(hp); hp.connect(ng); ng.connect(o); main = n; end = t + 0.7;
    } else if (kind === 'cp') {
      const n = noise(0.8), bp = flt('bandpass', 1100 + 900 * p.tone, 1.1), g = G(0);
      g.gain.setValueAtTime(0, t);
      [0, 0.011, 0.022].forEach(d => { g.gain.setValueAtTime(0.9 * vel, t + d); g.gain.setTargetAtTime(0.05, t + d + 0.001, 0.004); });
      g.gain.setValueAtTime(0.75 * vel, t + 0.031); g.gain.setTargetAtTime(0, t + 0.031, 0.09 * dk);
      n.connect(bp); bp.connect(g); g.connect(o); main = n; end = t + 0.8;
    } else if (kind === 'ch' || kind === 'oh') {
      const sum = G(0.18), bp = flt('bandpass', 9000 + 2000 * p.tone, 0.9), hp = flt('highpass', 6800), g = G(0);
      const osc = [205.3, 304.4, 369.6, 522.7, 540, 800].map(fq => { const s = ctx.createOscillator(); s.type = 'square'; s.frequency.value = fq * tn * 1.6; s.connect(sum); s.start(t); return s; });
      const dur = kind === 'ch' ? 0.25 : 1.2;
      env(g, 0.8 * vel, kind === 'ch' ? 0.018 : 0.16 * dk);
      sum.connect(bp); bp.connect(hp); hp.connect(g); g.connect(o);
      osc.forEach(s => s.stop(t + dur)); main = osc[0]; end = t + dur;
    } else if (kind === 'cb') {
      const sum = G(0.25), bp = flt('bandpass', 800 * tn, 2.4), g = G(0);
      [540, 800].forEach(fq => { const s = ctx.createOscillator(); s.type = 'square'; s.frequency.value = fq * tn; s.connect(sum); s.start(t); s.stop(t + 0.8); main = main || s; });
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.002); g.gain.setTargetAtTime(0.3 * vel, t + 0.002, 0.012); g.gain.setTargetAtTime(0, t + 0.03, 0.09 * dk);
      sum.connect(bp); bp.connect(g); g.connect(o); end = t + 0.8;
    } else if (kind === 'rs') {
      const os = ctx.createOscillator(), g = G(0); os.type = 'triangle'; os.frequency.value = 1700 * tn;
      env(g, 0.6 * vel, 0.012); os.connect(g); g.connect(o); os.start(t); os.stop(t + 0.15); main = os; end = t + 0.15;
    } else {
      const base = kind === 'lt' ? 95 : kind === 'mt' ? 135 : 185;
      const os = ctx.createOscillator(), g = G(0);
      os.frequency.setValueAtTime(base * tn * 1.6, t); os.frequency.exponentialRampToValueAtTime(base * tn, t + 0.08);
      env(g, 0.8 * vel, 0.14 * dk); os.connect(g); g.connect(o); os.start(t); os.stop(t + 1.2); main = os; end = t + 1.2;
    }
    this.hits.push({ kind, t, vel });
    if (this.hits.length > 64) this.hits.shift();
    return { main, end };
  }
  _start(m, vel, t) { const k = DRUM_PC[((m % 12) + 12) % 12]; const h = this.hit(k, t, vel); return h ? { kind: k } : null; }
  _stop() { /* golpes de una sola vez: soltar la tecla no hace nada */ }
  noteOn(m, vel = 0.9) { if (!this._b()) return null; return this._start(m, vel, A.t); }
  noteOff() {}
  play(m, vel, t) { if (!this._b()) return null; return this._start(m, vel, t); }
  allOff() {}
}

/* ------------------------------------------------ colores de ruido */
function noiseBuf(kind) {
  const ctx = A.ctx, sr = ctx.sampleRate, n = sr * 3, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w * 0.45;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.1; b6 = w * 0.115926;
    } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  }
  return b;
}

Object.assign(F, { besselJ, fmLines, fbCycle, FM2, pdPhase, pdSample, pdCycle, PD, DB_FEET, DB_H, Organ, SPECTRA, partialList, Partials, ksRender, Strings, VOWELS, Formant, chipWave, chipRender, Chip, BYTEBEATS, byteRender, DRUM_PC, DRUM_NAME, Drums, noiseBuf, mrg });
})();
