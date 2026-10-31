/* Síntesis con tu FM-1 · laboratorios: familias de síntesis y del sonido a la música */
(function () {
'use strict';
const F = window.FM1C;
const { $, el, sv, clamp, mtof, nameEn, nameEs, dec, fHz, fS, fPct, RM, heat, A, Synth, FX, SC, grid, txt, path, scope, spectrum, UI, Player, Labs, painter, live, FM2, fmLines, PD, pdPhase, pdSample, Organ, DB_FEET, Partials, SPECTRA, partialList, Strings, Formant, VOWELS, Chip, chipWave, BYTEBEATS, byteRender, Drums, DRUM_NAME, noiseBuf } = F;
const latest = inst => { let v = null; for (const q of inst.vs) if (!v || q.t0 > v.t0) v = q; return v; };

/* ======================================================= 12 · FM de dos operadores */
const FMPRE = {
  epiano: ['Piano eléctrico', { cr: 1, mr: 1, idx: 2.4, ienv: true, ia: 0.002, id: 0.6, is: 0.15, a: 0.002, d: 2.2, s: 0.2, r: 0.5, fb: 0 }],
  campana: ['Campana', { cr: 1, mr: 3.5, idx: 5, ienv: true, ia: 0.002, id: 2.2, is: 0, a: 0.002, d: 4, s: 0, r: 2.5, fb: 0 }],
  bajo: ['Bajo FM', { cr: 1, mr: 1, idx: 3.5, ienv: true, ia: 0.002, id: 0.25, is: 0.25, a: 0.002, d: 0.6, s: 0.5, r: 0.12, fb: 0.5 }],
  clarinete: ['Clarinete', { cr: 1, mr: 2, idx: 1.6, ienv: true, ia: 0.06, id: 0.5, is: 0.8, a: 0.05, d: 0.3, s: 0.9, r: 0.2, fb: 0 }],
  metales: ['Metales', { cr: 1, mr: 1, idx: 3, ienv: true, ia: 0.12, id: 0.4, is: 0.6, a: 0.06, d: 0.4, s: 0.85, r: 0.25, fb: 0.3 }],
  metal: ['Metal raro', { cr: 1, mr: 1.41, idx: 6, ienv: true, ia: 0.002, id: 1.2, is: 0.3, a: 0.002, d: 2, s: 0.4, r: 1, fb: 0 }]
};
Labs.def('fm', root => {
  UI.head(root, 'Dos operadores', 'La <b>portadora</b> es la que oyes; la <b>moduladora</b> mueve su frecuencia muy rápido y así le cambia el timbre. Mira cómo aparecen bandas laterales a los dos lados de la nota. Con la envolvente del índice activada, el brillo cae con el tiempo.');
  const g2 = el('div', 'scr-2', root);
  const sb = UI.screen(g2, 230), sc = UI.screen(g2, 230);
  sb.cv.setAttribute('aria-label', 'Espectro teórico de la FM: bandas laterales y armónicos');
  sc.cv.setAttribute('aria-label', 'Osciloscopio');
  const fm = new FM2(Object.assign({}, FMPRE.epiano[1]));
  let on = false;
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'fm-play', text: 'Sonar', on: v => { on = v; if (v) fm.noteOn(57); else fm.noteOff(57); } });
  const kc = UI.seg(row, { id: 'fm-cr', label: 'Portadora · RATIO', value: 1, opts: [[0.5, '0,5'], [1, '1'], [2, '2'], [3, '3']], on: v => fm.set({ cr: v }) });
  const km = UI.knob(row, { id: 'fm-mr', label: 'Moduladora · RATIO', min: 0.5, max: 14, step: 0.01, value: 1, fmt: v => '× ' + dec(v, 2), on: v => fm.set({ mr: v }) });
  const ki = UI.knob(row, { id: 'fm-idx', label: 'ÍNDICE', min: 0, max: 10, step: 0.05, value: 2.4, fmt: v => dec(v, 2), on: v => fm.set({ idx: v }) });
  const ke = UI.tog(row, { id: 'fm-env', text: 'Envolvente del índice', icon: 'wave', off: 'Envolvente activa', cls: 'tg-s', on: v => fm.set({ ienv: v }) });
  ke.set(true, false);
  const kd = UI.knob(row, { id: 'fm-dec', label: 'Caída del índice', min: 0.05, max: 4, log: true, value: 0.6, fmt: fS, on: v => fm.set({ id: v }) });
  const kf = UI.knob(row, { id: 'fm-fb', label: 'FB · realimentación', min: 0, max: 1.4, step: 0.01, value: 0, fmt: v => dec(v, 2), on: v => fm.set({ fb: v }) });
  const row2 = UI.row(root, 'ctrls-1');
  Object.keys(FMPRE).forEach(k => UI.btn(row2, { text: FMPRE[k][0], on: () => {
    const p = FMPRE[k][1]; fm.set(Object.assign({}, p));
    kc.set(p.cr, false); km.set(p.mr, false); ki.set(p.idx, false); kd.set(p.id, false); kf.set(p.fb, false); ke.set(p.ienv, false);
    fm.play(57, 0.85, A.t + 0.03, 1.4);
  } }));
  const drawSb = live(sb.cv, (g, w, h) => {
    const p = fm.p; let I = p.idx;
    const v = latest(fm);
    if (p.ienv && v && A.ctx && (v.rel == null || A.t - v.rel < 3)) I = fm.idxNow(v, A.t);
    const lines = fmLines(p.cr, p.mr, I, 30), fmax = 12, base = h - 34, X = f => 14 + (w - 28) * f / fmax;
    g.strokeStyle = SC.grid; g.setLineDash([3, 4]); g.beginPath();
    for (let k = 1; k <= fmax; k++) { const x = Math.round(X(k)) + 0.5; g.moveTo(x, 18); g.lineTo(x, base); }
    g.stroke(); g.setLineDash([]);
    for (let k = 1; k <= fmax; k++) txt(g, '×' + k, X(k), base + 10, 'center', SC.dim, 9);
    lines.forEach(l => {
      if (l.f < 0.01 || l.f > fmax + 0.2) return;
      const bh = Math.min(1, l.a) * (base - 28), x = X(l.f);
      const onH = Math.abs(l.f * 2 - Math.round(l.f * 2)) < 0.02;
      g.fillStyle = onH ? heat(0.3 + Math.min(1, l.a) * 0.65) : heat(0.12 + Math.min(1, l.a) * 0.3);
      g.fillRect(x - 3, base - bh, 6, bh);
      if (!onH && l.a > 0.08) { g.strokeStyle = '#22d3ee'; g.lineWidth = 1; g.strokeRect(x - 3.5, base - bh - 0.5, 7, bh + 1); }
    });
    const harm = Math.abs(p.mr * 2 - Math.round(p.mr * 2)) < 0.02;
    txt(g, 'índice ahora: ' + dec(I, 2), 10, 12, 'left', SC.fg, 11);
    txt(g, harm ? 'relación armónica: las bandas caen sobre armónicos' : 'relación inarmónica: bandas entre armónicos (campana, metal)', w - 10, 12, 'right', harm ? SC.vio : '#22d3ee', 10);
    txt(g, 'frecuencia en múltiplos de la nota', w / 2, h - 8, 'center', SC.dim, 9);
  });
  const drawSc = live(sc.cv, (g, w, h) => scope(g, w, h, { ms: 12 }));
  return { inst: fm, name: 'FM de 2 operadores', draw: () => { drawSb(); drawSc(); }, hide: () => { if (on) play.set(false, true); } };
});

/* ======================================================= 12b · los algoritmos de 6 operadores */
const ALGS = {
  1: { ops: { 1: [0, 0], 2: [0, 1], 3: [1, 0], 4: [1, 1], 5: [1, 2], 6: [1, 3] }, e: [[2, 1], [4, 3], [5, 4], [6, 5]], fb: 6, txt: 'Una pareja (2 → 1) y una torre de cuatro (6 → 5 → 4 → 3). Portadoras: 1 y 3. La torre larga da timbres muy complejos y cambiantes.' },
  5: { ops: { 1: [0, 0], 2: [0, 1], 3: [1, 0], 4: [1, 1], 5: [2, 0], 6: [2, 1] }, e: [[2, 1], [4, 3], [6, 5]], fb: 6, txt: 'Tres parejas independientes: tres FM de dos operadores como la de arriba, sumadas. El piano eléctrico clásico del DX7 está hecho así.' },
  16: { ops: { 1: [1, 0], 2: [0, 1], 3: [1, 1], 4: [1, 2], 5: [2, 1], 6: [2, 2] }, e: [[2, 1], [3, 1], [4, 3], [5, 1], [6, 5]], fb: 6, txt: 'Una sola portadora con tres ramas de modulación. Todo el timbre sale de un único operador que se oye: metales, leads, sonidos con mucho carácter.' },
  22: { ops: { 1: [0, 0], 2: [0, 1], 3: [1, 0], 4: [2, 0], 5: [3, 0], 6: [2, 1] }, e: [[2, 1], [6, 3], [6, 4], [6, 5]], fb: 6, txt: 'Un modulador (6) alimenta a tres portadoras a la vez, más una pareja aparte. Mucho cuerpo: órganos, metales, pads.' },
  32: { ops: { 1: [0, 0], 2: [1, 0], 3: [2, 0], 4: [3, 0], 5: [4, 0], 6: [5, 0] }, e: [], fb: 6, txt: 'Seis portadoras y ninguna modulación entre ellas (solo la realimentación del 6): es síntesis aditiva con seis senos. Perfecto para órganos.' }
};
Labs.def('fm-alg', root => {
  UI.head(root, 'Seis operadores, 32 algoritmos', 'Un algoritmo es el cableado: quién modula a quién. Abajo, en naranja, las portadoras (las que oyes). Arriba, en violeta, las moduladoras (las que dan color). El lazo es la realimentación.');
  const box = el('div', 'alg', root);
  const tx = UI.note(root, '');
  const row = UI.row(root, 'ctrls-1');
  let cur = 5;
  function draw() {
    box.innerHTML = '';
    const A2 = ALGS[cur], cols = Math.max(...Object.values(A2.ops).map(p => p[0])) + 1, rows = Math.max(...Object.values(A2.ops).map(p => p[1])) + 1;
    const W = 120 + cols * 110, H = 90 + rows * 92;
    const s = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Algoritmo ' + cur + ' del DX7' }, box);
    const pos = n => { const p = A2.ops[n]; return [70 + p[0] * 110 + 30, H - 70 - p[1] * 92]; };
    const carriers = Object.keys(A2.ops).filter(n => A2.ops[n][1] === 0).map(Number);
    const xs = carriers.map(n => pos(n)[0]);
    sv('line', { x1: Math.min(...xs) - 30, y1: H - 26, x2: Math.max(...xs) + 30, y2: H - 26, class: 'alg-bus' }, s);
    sv('path', { d: 'M' + (Math.max(...xs) + 30) + ' ' + (H - 26) + 'h30m-8 -6 8 6 -8 6', class: 'alg-bus' }, s);
    const tt = sv('text', { x: Math.max(...xs) + 66, y: H - 22, class: 'alg-t' }, s); tt.textContent = 'salida';
    carriers.forEach(n => { const [x, y] = pos(n); sv('line', { x1: x, y1: y + 26, x2: x, y2: H - 26, class: 'alg-w c' }, s); });
    A2.e.forEach(([a, b]) => { const [x1, y1] = pos(a), [x2, y2] = pos(b); sv('path', { d: 'M' + x1 + ' ' + (y1 + 26) + ' C' + x1 + ' ' + (y1 + 52) + ' ' + x2 + ' ' + (y2 - 52) + ' ' + x2 + ' ' + (y2 - 26), class: 'alg-w' }, s); });
    if (A2.fb) { const [x, y] = pos(A2.fb); sv('path', { d: 'M' + (x + 26) + ' ' + y + ' h16 v-40 h-42 v14', class: 'alg-fb' }, s); }
    Object.keys(A2.ops).forEach(n => {
      const [x, y] = pos(+n), car = carriers.indexOf(+n) >= 0;
      sv('rect', { x: x - 26, y: y - 26, width: 52, height: 52, rx: 12, class: 'alg-op ' + (car ? 'car' : 'mod') }, s);
      const t = sv('text', { x, y: y + 8, 'text-anchor': 'middle', class: 'alg-n' }, s); t.textContent = n;
    });
    tx.innerHTML = '<b>Algoritmo ' + cur + '.</b> ' + A2.txt;
  }
  UI.seg(row, { id: 'alg-sel', label: 'ALG', value: 5, wide: true, opts: Object.keys(ALGS).map(k => [+k, k]), on: v => { cur = v; draw(); } });
  draw();
  return {};
});

/* ======================================================= 13 · distorsión de fase */
Labs.def('fase', root => {
  UI.head(root, 'Doblar la fase', 'Un coseno leído a velocidad desigual. A la izquierda, la fase «doblada» (la diagonal punteada sería un coseno normal). A la derecha, la onda que sale. DCW decide cuánto se dobla; ENV hace que empiece más brillante y se suavice, como un filtro que se cierra.');
  const g2 = el('div', 'scr-2', root);
  const sp = UI.screen(g2, 190), sw = UI.screen(g2, 190);
  const ss = UI.screen(root, 110);
  sp.cv.setAttribute('aria-label', 'Curva de fase doblada'); sw.cv.setAttribute('aria-label', 'Forma de onda resultante');
  const pd = new PD({ type: 'saw', dcw: 0.4, env: 0, ed: 0.5 });
  let on = false;
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'pd-play', text: 'Sonar', on: v => { on = v; if (v) pd.noteOn(45); else pd.noteOff(45); } });
  UI.seg(row, { id: 'pd-w', label: 'WAVE', value: 'saw', opts: [['saw', 'SAW'], ['sqr', 'SQR'], ['res', 'RSAW']], on: v => pd.set({ type: v }) });
  UI.knob(row, { id: 'pd-dcw', label: 'DCW', min: 0, max: 1, value: 0.4, fmt: fPct, on: v => pd.set({ dcw: v }) });
  UI.knob(row, { id: 'pd-env', label: 'ENV → DCW', min: 0, max: 1, value: 0, fmt: fPct, on: v => pd.set({ env: v }) });
  UI.knob(row, { id: 'pd-ed', label: 'Caída de ENV', min: 0.05, max: 3, log: true, value: 0.5, fmt: fS, on: v => pd.set({ ed: v }) });
  const cur = () => { const v = latest(pd); return v && A.ctx ? pd.dcwAt(v, A.t) : pd.p.dcw; };
  const drawP = live(sp.cv, (g, w, h) => {
    grid(g, w, h, 4, 4);
    const d = cur(), ty = pd.p.type, pad = 16, W2 = w - 2 * pad, H2 = h - 2 * pad;
    g.setLineDash([4, 4]); path(g, [[pad, h - pad], [w - pad, pad]], SC.axis, 1.5); g.setLineDash([]);
    const pts = [];
    for (let i = 0; i <= 200; i++) { const x = i / 200; const ph = ty === 'res' ? (x * (1 + d * 12)) % 1 : pdPhase(ty, d, x); pts.push([pad + W2 * x, h - pad - H2 * ph]); }
    path(g, pts, SC.vio, 2.2);
    txt(g, ty === 'res' ? 'fase acelerada (resonancia)' : 'fase doblada', 8, 10, 'left', SC.dim, 10);
    txt(g, 'DCW ' + Math.round(d * 100) + ' %', w - 8, h - 8, 'right', SC.fg, 11);
  });
  const drawW = live(sw.cv, (g, w, h) => {
    grid(g, w, h, 4, 4);
    const d = cur(), ty = pd.p.type, pts = [];
    for (let i = 0; i <= 400; i++) { const x = (i / 400 * 2) % 1; pts.push([i / 400 * w, h / 2 - pdSample(ty, d, x) * h * 0.38]); }
    path(g, pts, heat(0.74), 2.2);
    txt(g, 'dos ciclos de la onda', 8, 10, 'left', SC.dim, 10);
  });
  const drawS = live(ss.cv, (g, w, h) => spectrum(g, w, h, { lin: true, fmax: 4400, marks: [1000, 2000, 3000, 4000] }));
  return { inst: pd, name: 'Distorsión de fase', draw: () => { if (pd.ok) pd.tick(); drawP(); drawW(); drawS(); }, hide: () => { if (on) play.set(false, true); } };
});

/* ======================================================= 14 · órgano de drawbars */
const REGS = [['Jazz', [8, 8, 8, 0, 0, 0, 0, 0, 0], 3], ['Lleno', [8, 8, 8, 8, 8, 8, 8, 8, 8], 0], ['Flauta', [0, 0, 8, 0, 0, 0, 0, 0, 0], 0], ['Suave', [8, 3, 8, 0, 0, 0, 0, 0, 0], 0], ['Gospel', [8, 8, 8, 8, 0, 0, 0, 0, 8], 0], ['Lengüeta', [0, 0, 8, 8, 8, 8, 0, 0, 0], 0]];
Labs.def('organo', root => {
  UI.head(root, 'Nueve drawbars', 'Arrastra cada barra hacia abajo para sacarla (0 = guardada, 8 = al máximo). Cada barra es un seno: 16\' suena una octava por debajo, 8\' es la nota, 4\' una octava arriba… Toca el teclado o pulsa <b>Acorde</b>.');
  const g2 = el('div', 'scr-2', root);
  const db = UI.screen(g2, 240), sp = UI.screen(g2, 240);
  db.box.classList.add('edit');
  db.cv.setAttribute('aria-label', 'Nueve drawbars de órgano: arrastra para cambiarlas');
  sp.cv.setAttribute('aria-label', 'Los senos que suman las drawbars');
  const org = new Organ({ bars: [8, 8, 8, 0, 0, 0, 0, 0, 0], perc: 3 });
  const bars = org.p.bars;
  const cols = ['#9A6A45', '#9A6A45', '#EEE7D7', '#EEE7D7', '#24202A', '#EEE7D7', '#24202A', '#24202A', '#EEE7D7'];
  let chord = false;
  const pD = painter(db.cv, (g, w, h) => {
    const bw = w / 9;
    for (let i = 0; i < 9; i++) {
      const x = i * bw + bw * 0.22, ww = bw * 0.56, top = 30, len = (h - 60) * bars[i] / 8;
      g.fillStyle = 'rgba(237,233,246,0.06)'; g.fillRect(x, top, ww, h - 60);
      g.fillStyle = cols[i]; g.fillRect(x, top, ww, len + 14);
      g.fillStyle = cols[i] === '#24202A' ? '#EEE7D7' : '#1A1620';
      g.font = '600 12px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(bars[i]), x + ww / 2, top + len + 4);
      txt(g, DB_FEET[i], x + ww / 2, 14, 'center', SC.fg, 11);
    }
    txt(g, 'registro ' + bars.slice(0, 2).join('') + ' ' + bars.slice(2, 6).join('') + ' ' + bars.slice(6).join(''), w / 2, h - 12, 'center', SC.vio, 12);
  });
  const pS = painter(sp.cv, (g, w, h) => {
    grid(g, w, h, 4, 4);
    const ratios = [0.5, 1.5, 1, 2, 3, 4, 5, 6, 8], X = r => 20 + (w - 40) * Math.log(r / 0.4) / Math.log(10 / 0.4), base = h - 26;
    ratios.forEach((r, i) => { const v = bars[i] ? Math.pow(10, (bars[i] - 8) * 3 / 20) : 0; g.fillStyle = heat(0.2 + v * 0.75); g.fillRect(X(r) - 5, base - v * (base - 30), 10, v * (base - 30)); txt(g, '×' + dec(r, r % 1 ? 1 : 0), X(r), base + 12, 'center', SC.dim, 9); });
    txt(g, 'frecuencia de cada seno respecto a la nota', 10, 12, 'left', SC.dim, 10);
  });
  let drag = -1;
  const at = e => { const r = db.cv.getBoundingClientRect(); const i = drag >= 0 ? drag : clamp(Math.floor((e.clientX - r.left) / r.width * 9), 0, 8); drag = i; bars[i] = clamp(Math.round((e.clientY - r.top - 30) / (r.height - 60) * 8), 0, 8); org.set({ bars: bars.slice() }); pD.mark(); pS.mark(); };
  db.cv.style.touchAction = 'none';
  db.cv.addEventListener('pointerdown', e => { drag = -1; db.cv.setPointerCapture(e.pointerId); A.ensure(); at(e); });
  db.cv.addEventListener('pointermove', e => { if (drag >= 0) at(e); });
  db.cv.addEventListener('pointerup', () => { drag = -1; });
  const row = UI.row(root);
  const ch = UI.tog(row, { id: 'org-ch', text: 'Acorde', on: v => { chord = v; [48, 52, 55, 60].forEach(m => v ? org.noteOn(m) : org.noteOff(m)); } });
  UI.seg(row, { id: 'org-perc', label: 'PERC', value: 3, opts: [[0, 'OFF'], [2, '2ND'], [3, '3RD']], on: v => org.set({ perc: v }) });
  UI.seg(row, { id: 'org-rot', label: 'ROTOR', value: 0, opts: [[0, 'OFF'], [1, 'SLOW'], [2, 'FAST']], on: v => org.set({ rotor: v }) });
  UI.knob(row, { id: 'org-click', label: 'CLICK', min: 0, max: 1, value: 0.35, fmt: fPct, on: v => org.set({ click: v }) });
  const row2 = UI.row(root, 'ctrls-1');
  REGS.forEach(([n, b, perc]) => UI.btn(row2, { text: n, on: () => { b.forEach((x, i) => { bars[i] = x; }); org.set({ bars: bars.slice(), perc }); pD.mark(); pS.mark(); if (!chord) [48, 52, 55].forEach(m => org.play(m, 0.8, A.t + 0.03, 1.2)); } }));
  return { inst: org, name: 'Órgano de drawbars', draw: () => { pD.draw(); pS.draw(); }, hide: () => { if (chord) ch.set(false, true); } };
});

/* ======================================================= 14b · aditiva con espectros (ADD) */
Labs.def('add', root => {
  UI.head(root, 'Espectros que se apagan', 'Elige un espectro (MODE), cuántos parciales, su brillo y si los agudos mueren antes. Cada barra es un seno; mira cómo se apaga cada uno después de tocar.');
  const sc = UI.screen(root, 210);
  sc.cv.setAttribute('aria-label', 'Parciales del sonido y cómo decae cada uno');
  const ad = new Partials({ kind: 'bell', n: 9, bright: 0.6, decay: 3, hi: 0.7 });
  const row = UI.row(root);
  UI.btn(row, { id: 'add-hit', text: 'Golpear', icon: 'play', on: () => ad.noteOn(60, 0.9) && setTimeout(() => ad.noteOff(60), 2500) });
  UI.seg(row, { id: 'add-mode', label: 'MODE', value: 'bell', wide: true, opts: Object.keys(SPECTRA).map(k => [k, k.toUpperCase()]), on: v => { ad.p.kind = v; } });
  UI.knob(row, { id: 'add-n', label: 'PARTIAL', min: 1, max: 10, step: 1, value: 9, fmt: String, on: v => { ad.p.n = v; } });
  UI.knob(row, { id: 'add-b', label: 'BRIGHT', min: 0, max: 1, value: 0.6, fmt: fPct, on: v => { ad.p.bright = v; } });
  UI.knob(row, { id: 'add-s', label: 'SHIFT', min: 0, max: 1, value: 0, fmt: fPct, on: v => { ad.p.stretch = v; } });
  UI.knob(row, { id: 'add-d', label: 'DECAY', min: 0.2, max: 8, log: true, value: 3, fmt: fS, on: v => { ad.p.decay = v; } });
  UI.knob(row, { id: 'add-hi', label: 'Agudos mueren antes', min: 0, max: 1.5, value: 0.7, fmt: v => dec(v, 2), on: v => { ad.p.hi = v; } });
  UI.knob(row, { id: 'add-sus', label: 'Sostener', min: 0, max: 1, value: 0, fmt: fPct, on: v => { ad.p.sus = v; } });
  const draw = live(sc.cv, (g, w, h) => {
    grid(g, w, h, 8, 4);
    const list = partialList(ad.p), base = h - 26, X = r => 24 + (w - 48) * Math.log(r / 0.4) / Math.log(16 / 0.4);
    const sum = list.reduce((s, q) => s + q.a, 0) || 1, v = latest(ad), t = A.t;
    [0.5, 1, 2, 4, 8, 16].forEach(r => txt(g, '×' + dec(r, r % 1 ? 1 : 0), X(r), base + 12, 'center', SC.dim, 9));
    list.forEach(q => {
      let lvl = q.a / sum * 2.2;
      if (v && A.ctx) { const tau = Math.max(0.03, ad.p.decay / (1 + ad.p.hi * (q.r - 1) * 0.9)) / 3, el2 = Math.max(0, t - v.t0); let k = ad.p.sus + (1 - ad.p.sus) * Math.exp(-el2 / tau); if (v.rel != null && t > v.rel) k *= Math.exp(-(t - v.rel) / (ad.p.r / 5)); lvl *= k; } else lvl *= 0.25;
      const bh = clamp(lvl, 0, 1) * (base - 30), x = X(q.r);
      g.fillStyle = heat(0.15 + clamp(lvl, 0, 1) * 0.8); g.fillRect(x - 4, base - bh, 8, bh);
      g.fillStyle = 'rgba(237,233,246,0.25)'; g.fillRect(x - 4, base - (q.a / sum * 2.2) * (base - 30), 8, 1.5);
    });
    txt(g, (SPECTRA[ad.p.kind] || {}).name || '', 10, 12, 'left', SC.fg, 11);
  });
  return { inst: ad, name: 'Aditiva', draw };
});

/* ======================================================= 15 · cuerda Karplus-Strong */
Labs.def('cuerda', root => {
  UI.head(root, 'Una cuerda hecha de eco', 'Un ruido corto entra en un lazo de retardo del largo exacto de una vibración. Cada vuelta se suaviza un poco: el ruido se convierte en una nota que decae. Arriba ves lo que circula por el lazo, de ruido a onda limpia.');
  const s1 = UI.screen(root, 160), s2 = UI.screen(root, 110);
  s1.cv.setAttribute('aria-label', 'Contenido del lazo de retardo en el tiempo');
  s2.cv.setAttribute('aria-label', 'Forma completa de la nota y su caída');
  const st = new Strings({ exc: 'pluck', decay: 0.45, bright: 0.6, pos: 0.18 });
  const row = UI.row(root);
  UI.btn(row, { id: 'ks-pl', text: 'Pulsar', icon: 'play', on: () => { st.noteOn(45, 0.9); setTimeout(() => st.noteOff(45), 2600); } });
  UI.seg(row, { id: 'ks-exc', label: 'EXCITE', value: 'pluck', wide: true, opts: [['noise', 'NOISE'], ['pluck', 'PLUCK'], ['pick', 'PICK'], ['hammer', 'HAMMR'], ['bow', 'BOW']], on: v => { st.p.exc = v; } });
  UI.knob(row, { id: 'ks-dec', label: 'DECAY', min: 0, max: 1, value: 0.45, fmt: fPct, on: v => { st.p.decay = v; } });
  UI.knob(row, { id: 'ks-br', label: 'BRIGHT', min: 0, max: 1, value: 0.6, fmt: fPct, on: v => { st.p.bright = v; } });
  UI.knob(row, { id: 'ks-pos', label: 'POS', min: 0.04, max: 0.5, value: 0.18, fmt: v => Math.round(v * 100) + ' % del largo', on: v => { st.p.pos = v; } });
  let ov = null, ovFor = null;
  const draw1 = live(s1.cv, (g, w, h) => {
    grid(g, w, h, 8, 4);
    const v = st.last;
    if (!v || !A.ctx) { txt(g, 'Pulsa «Pulsar» o toca una tecla', w / 2, h / 2, 'center', SC.dim, 12); return; }
    const k = Math.min(v.r.snaps.length - 1, Math.max(0, Math.floor((A.t - v.t0) / v.r.dt)));
    const s = v.r.snaps[k]; let mx = 0.0001; for (let i = 0; i < s.length; i++) mx = Math.max(mx, Math.abs(s[i]));
    const pts = []; for (let i = 0; i < s.length; i++) pts.push([10 + (w - 20) * i / (s.length - 1), h / 2 - s[i] / Math.max(mx, 0.25) * h * 0.36]);
    path(g, pts, heat(0.35 + Math.min(1, mx) * 0.6), 2.2);
    txt(g, 'vuelta ' + Math.round((A.t - v.t0) * mtof(v.m)) + ' del lazo · ' + v.r.N + ' muestras de largo', 10, 12, 'left', SC.dim, 10);
  });
  const draw2 = live(s2.cv, (g, w, h) => {
    const v = st.last;
    if (!v) { txt(g, 'La nota completa aparecerá aquí', w / 2, h / 2, 'center', SC.dim, 11); return; }
    if (ovFor !== v || !ov || ov.w !== Math.round(w)) {
      const b = v.r.buf, n = Math.round(w), mm = new Float32Array(n * 2);
      for (let x = 0; x < n; x++) { let lo = 0, hi = 0; const a = Math.floor(x / n * b.length), z = Math.floor((x + 1) / n * b.length); for (let i = a; i < z; i++) { if (b[i] < lo) lo = b[i]; if (b[i] > hi) hi = b[i]; } mm[x * 2] = lo; mm[x * 2 + 1] = hi; }
      ov = { mm, w: n }; ovFor = v;
    }
    let pk = 0.001; for (let i = 0; i < ov.mm.length; i++) pk = Math.max(pk, Math.abs(ov.mm[i]));
    for (let x = 0; x < ov.w; x++) { const lo = ov.mm[x * 2] / pk, hi = ov.mm[x * 2 + 1] / pk; g.fillStyle = heat(0.3 + Math.abs(hi) * 0.6); g.fillRect(x, h / 2 - hi * h * 0.42, 1, (hi - lo) * h * 0.42 || 1); }
    const dur = v.r.buf.length / A.ctx.sampleRate, x = (A.t - v.t0) / dur * w;
    if (x >= 0 && x <= w) { g.fillStyle = SC.ora; g.fillRect(x, 0, 2, h); }
  });
  return { inst: st, name: 'Cuerda (Karplus-Strong)', draw: () => { draw1(); draw2(); } };
});

/* ======================================================= 16 · la voz: formantes */
Labs.def('voz', root => {
  UI.head(root, 'El mapa de las vocales', 'Arrastra el punto: hacia arriba la boca se cierra (F1 baja), hacia la izquierda la lengua va adelante (F2 sube). Pulsa <b>Cantar</b> o toca el teclado: es una sola voz, con glide entre notas.');
  const g2 = el('div', 'scr-2', root);
  const pad = UI.screen(g2, 260), sp = UI.screen(g2, 260);
  pad.box.classList.add('edit');
  pad.cv.setAttribute('aria-label', 'Carta de vocales: arrastra para cambiar F1 y F2');
  sp.cv.setAttribute('aria-label', 'Espectro de la voz con sus formantes');
  const fo = new Formant();
  const F1 = [250, 900], F2 = [2700, 650];
  const toXY = (f1, f2, w, h) => [20 + (w - 40) * Math.log(F2[0] / f2) / Math.log(F2[0] / F2[1]), 20 + (h - 40) * Math.log(f1 / F1[0]) / Math.log(F1[1] / F1[0])];
  const fromXY = (x, y, w, h) => [F1[0] * Math.pow(F1[1] / F1[0], clamp((y - 20) / (h - 40), 0, 1)), F2[0] / Math.pow(F2[0] / F2[1], clamp((x - 20) / (w - 40), 0, 1))];
  const f3for = (f1, f2) => { let ws = 0, s = 0; Object.values(VOWELS).forEach(v => { const d = Math.hypot(Math.log(f1 / v[0]), Math.log(f2 / v[1])) + 0.05; ws += 1 / d; s += v[2] / d; }); return s / ws; };
  let on = false;
  const setV = (f1, f2) => fo.vowel(f1, f2, f3for(f1, f2));
  const draw1 = live(pad.cv, (g, w, h) => {
    grid(g, w, h, 6, 6);
    g.strokeStyle = 'rgba(160,140,255,0.35)'; g.lineWidth = 1.5; g.beginPath();
    ['i', 'e', 'a', 'o', 'u', 'i'].forEach((k, j) => { const [x, y] = toXY(VOWELS[k][0], VOWELS[k][1], w, h); j ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    Object.keys(VOWELS).forEach(k => { const [x, y] = toXY(VOWELS[k][0], VOWELS[k][1], w, h); g.fillStyle = 'rgba(160,140,255,0.25)'; g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill(); txt(g, k, x, y, 'center', SC.fg, 16); });
    const [x, y] = toXY(fo.p.f1, fo.p.f2, w, h);
    g.fillStyle = SC.ora; g.shadowColor = SC.ora; g.shadowBlur = 14; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    txt(g, 'F1 ' + Math.round(fo.p.f1) + ' Hz · F2 ' + Math.round(fo.p.f2) + ' Hz', w - 10, h - 10, 'right', SC.dim, 10);
    txt(g, '← lengua adelante', 10, h - 10, 'left', SC.dim, 9); txt(g, 'boca cerrada ↑', w - 10, 12, 'right', SC.dim, 9);
  });
  let drag = false;
  const at = e => { const r = pad.cv.getBoundingClientRect(); const [f1, f2] = fromXY(e.clientX - r.left, e.clientY - r.top, r.width, r.height); setV(f1, f2); };
  pad.cv.style.touchAction = 'none';
  pad.cv.addEventListener('pointerdown', e => { drag = true; pad.cv.setPointerCapture(e.pointerId); A.ensure(); if (!fo.ok) fo._b(); if (!on) sing.set(true, true); at(e); });
  pad.cv.addEventListener('pointermove', e => { if (drag) at(e); });
  pad.cv.addEventListener('pointerup', () => { drag = false; });
  const draw2 = live(sp.cv, (g, w, h) => spectrum(g, w, h, { fmin: 80, fmax: 5000 }));
  const row = UI.row(root);
  const sing = UI.tog(row, { id: 'voz-on', text: 'Cantar', on: v => { on = v; if (v) fo.noteOn(48, 0.8); else fo.noteOff(48); } });
  ['a', 'e', 'i', 'o', 'u'].forEach(k => UI.btn(row, { text: k.toUpperCase(), cls: 'bt-sq', on: () => { if (!fo.ok) fo._b(); setV(VOWELS[k][0], VOWELS[k][1]); } }));
  UI.btn(row, { id: 'voz-demo', text: 'A-E-I-O-U cantado', icon: 'play', on: () => {
    if (!fo.ok) fo._b();
    const seq = ['a', 'e', 'i', 'o', 'u', 'a'], notes = [48, 50, 52, 53, 55, 48];
    seq.forEach((k, i) => setTimeout(() => { setV(VOWELS[k][0], VOWELS[k][1]); fo.noteOn(notes[i], 0.8); if (i) fo.noteOff(notes[i - 1]); }, i * 600));
    setTimeout(() => fo.noteOff(48), seq.length * 600 + 400);
  } });
  const row2 = UI.row(root);
  UI.knob(row2, { id: 'voz-buzz', label: 'BUZZ', min: 0, max: 1, value: 0.6, fmt: fPct, on: v => fo.set({ buzz: v }) });
  UI.knob(row2, { id: 'voz-br', label: 'BREATH', min: 0, max: 1, value: 0.08, fmt: fPct, on: v => fo.set({ breath: v }) });
  UI.knob(row2, { id: 'voz-q', label: 'Q', min: 0.4, max: 2.5, value: 1, fmt: v => '× ' + dec(v, 1), on: v => fo.set({ sharp: v }) });
  UI.knob(row2, { id: 'voz-sh', label: 'SHIFT', min: 0.75, max: 1.4, value: 1, fmt: v => v < 0.97 ? 'voz más grande' : v > 1.03 ? 'voz más pequeña' : 'normal', on: v => fo.set({ shift: v }) });
  UI.knob(row2, { id: 'voz-vib', label: 'Vibrato', min: 0, max: 50, step: 1, value: 16, fmt: v => v + ' cents', on: v => fo.set({ vib: v }) });
  return { inst: fo, name: 'Voz de formantes', draw: () => { draw1(); draw2(); }, hide: () => { if (on) sing.set(false, true); } };
});

/* ======================================================= 17 · bits y muestras */
Labs.def('bits', root => {
  UI.head(root, 'Menos bits, menos muestras', 'BITS decide cuántos escalones de volumen hay; MUESTREO, cada cuántas muestras se toma un valor nuevo. La línea fina es la onda ideal; la gruesa, la que sale.');
  const g2 = el('div', 'scr-2', root);
  const s1 = UI.screen(g2, 200), s2 = UI.screen(g2, 200);
  s1.cv.setAttribute('aria-label', 'Onda ideal y onda con pocos bits'); s2.cv.setAttribute('aria-label', 'Espectro');
  const ch = new Chip({ wave: 'sine', bits: 4, div: 1, duty: 0.5 });
  let on = false;
  const restart = () => { pW.mark(); if (on) { ch.noteOff(57); ch.noteOn(57); } };
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'bit-play', text: 'Sonar', on: v => { on = v; if (v) ch.noteOn(57); else ch.noteOff(57); } });
  UI.seg(row, { id: 'bit-w', label: 'WAVE', value: 'sine', opts: [['sine', 'SIN'], ['tri', 'TRI'], ['saw', 'SAW'], ['pulse', 'PLS']], on: v => { ch.set({ wave: v }); restart(); } });
  UI.knob(row, { id: 'bit-b', label: 'BITS', min: 1, max: 12, step: 1, value: 4, fmt: v => v + ' bits · ' + Math.pow(2, v) + ' niveles', on: v => { ch.set({ bits: v }); restart(); } });
  UI.knob(row, { id: 'bit-d', label: 'MUESTREO', min: 1, max: 32, step: 1, value: 1, fmt: v => v === 1 ? 'completo' : '1 de cada ' + v, on: v => { ch.set({ div: v }); restart(); } });
  UI.knob(row, { id: 'bit-du', label: 'DUTY', min: 0.05, max: 0.5, value: 0.5, fmt: fPct, on: v => { ch.set({ duty: v }); restart(); } });
  const pW = painter(s1.cv, (g, w, h) => {
    grid(g, w, h, 4, 4);
    const p = ch.p, sr = 48000, f = 220, n = Math.round(sr / f * 2), lv = Math.pow(2, p.bits) - 1;
    const ideal = [], crushed = [];
    let held = 0;
    for (let i = 0; i <= n; i++) {
      const ph = (i * f / sr) % 1, y = chipWave(p.wave, ph, p.duty);
      if (i % p.div === 0) { held = p.bits < 16 ? Math.round((y * 0.5 + 0.5) * lv) / lv * 2 - 1 : y; }
      const x = i / n * w; ideal.push([x, h / 2 - y * h * 0.38]); crushed.push([x, h / 2 - held * h * 0.38]);
    }
    path(g, ideal, 'rgba(160,140,255,0.6)', 1.2);
    const st = []; crushed.forEach((p2, i) => { if (i) st.push([p2[0], crushed[i - 1][1]]); st.push(p2); });
    path(g, st, heat(0.75), 2.2);
    txt(g, 'dos ciclos a 220 Hz · ' + Math.round(48000 / p.div) + ' muestras por segundo', 8, 12, 'left', SC.dim, 10);
  });
  const draw2 = live(s2.cv, (g, w, h) => spectrum(g, w, h, {}));
  return { inst: ch, name: 'Chip de pocos bits', draw: () => { pW.draw(); draw2(); }, hide: () => { if (on) play.set(false, true); } };
});

/* ======================================================= 17b · bytebeat */
Labs.def('bytebeat', root => {
  UI.head(root, 'Música en una línea', 'Cada fórmula se calcula 8000 veces por segundo con un contador <b>t</b> que sube de uno en uno; el resultado se queda con 8 bits (0 a 255). De ahí sale ritmo, melodía y timbre a la vez. Las luces son los 8 bits del valor que suena.');
  const sc = UI.screen(root, 200);
  sc.cv.setAttribute('aria-label', 'Los ocho bits del valor actual y la onda reciente');
  let sel = 0, src = null, gain = null, t0 = 0, rate = 1, on = false, data = null;
  const start = () => {
    if (!A.ensure()) return;
    stop();
    data = byteRender(BYTEBEATS[sel].f, 32);
    const ctx = A.ctx, b = ctx.createBuffer(1, data.d.length, data.sr); b.getChannelData(0).set(data.d);
    src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.playbackRate.value = rate;
    gain = ctx.createGain(); gain.gain.value = 0.7; src.connect(gain); gain.connect(A.bus); src.start(); t0 = A.t;
  };
  const stop = () => { if (src) { try { src.stop(); } catch (e) {} src.disconnect(); src = null; } };
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'bb-play', text: 'Sonar', on: v => { on = v; if (v) start(); else stop(); } });
  UI.seg(row, { id: 'bb-f', label: 'Fórmula', value: 0, wide: true, opts: BYTEBEATS.map((b, i) => [i, b.name]), on: v => { sel = v; code.textContent = BYTEBEATS[v].code; if (on) start(); } });
  UI.knob(row, { id: 'bb-r', label: 'MOTION', min: 0.5, max: 2, value: 1, fmt: v => '× ' + dec(v, 2), on: v => { const old = rate; rate = v; if (src) { const tt = curT(old); src.playbackRate.setValueAtTime(v, A.t); t0 = A.t - tt / (8000 * v); } } });
  const code = el('code', 'bb-code', root); code.textContent = BYTEBEATS[0].code;
  const curT = r => data ? ((A.t - t0) * 8000 * (r || rate)) : 0;
  const draw = live(sc.cv, (g, w, h) => {
    grid(g, w, h, 8, 4);
    if (!src || !data) { txt(g, 'Pulsa Sonar', w / 2, h / 2, 'center', SC.dim, 12); }
    const t = Math.floor(curT()) % (data ? data.raw.length : 1), v = data && src ? data.raw[t] : 0;
    const bw = Math.min(46, (w - 40) / 8);
    for (let b = 7; b >= 0; b--) {
      const x = 20 + (7 - b) * (bw + 4) + bw / 2, onb = (v >> b) & 1;
      g.fillStyle = onb ? heat(0.4 + b * 0.075) : 'rgba(237,233,246,0.08)';
      g.beginPath(); g.arc(x, 34, bw * 0.32, 0, Math.PI * 2); g.fill();
      txt(g, 'bit ' + b, x, 62, 'center', SC.dim, 9);
    }
    txt(g, 't = ' + (data && src ? t : 0) + '   valor = ' + v, w - 12, 34, 'right', SC.fg, 12);
    if (data && src) {
      const n = Math.floor(w / 2), pts = [];
      for (let i = 0; i < n; i++) { const k = (t - n + i + data.raw.length) % data.raw.length; pts.push([i * 2, h - 12 - data.raw[k] / 255 * (h - 90)]); }
      path(g, pts, heat(0.7), 1.4);
    }
  });
  return { draw, hide: () => { if (on) play.set(false, true); } };
});

/* ======================================================= 18 · percusión */
const PADS = ['bd', 'sd', 'cp', 'ch', 'oh', 'lt', 'rs', 'cb'];
const LANES = [['bd', 'BD'], ['sd', 'SD'], ['cp', 'CP'], ['ch', 'CH'], ['oh', 'OH']];
Labs.def('percusion', root => {
  UI.head(root, 'Una batería sin muestras', 'Toca los pads: cada golpe se sintetiza en el momento con osciladores y ruido. La gráfica muestra la anatomía del último golpe: su tono (violeta) y su volumen (naranja). Abajo, programa un ritmo de 16 pasos.');
  const dr = new Drums();
  const pads = el('div', 'pads', root);
  let last = 'bd', lastT = 0;
  PADS.forEach(k => { const b = el('button', 'pad', pads, '<b>' + k.toUpperCase() + '</b><span>' + DRUM_NAME[k].replace(/ \(.*\)/, '') + '</span>'); b.type = 'button'; b.addEventListener('pointerdown', e => { e.preventDefault(); A.ensure(); dr.hit(k, A.t, 0.95); last = k; lastT = performance.now(); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }); });
  const sc = UI.screen(root, 150);
  sc.cv.setAttribute('aria-label', 'Tono y volumen del último golpe');
  const row = UI.row(root);
  UI.knob(row, { id: 'dr-tune', label: 'TUNE', min: 0.5, max: 2, value: 1, fmt: v => '× ' + dec(v, 2), on: v => { dr.p.tune = v; } });
  UI.knob(row, { id: 'dr-dec', label: 'DECAY', min: 0.3, max: 3, value: 1, fmt: v => '× ' + dec(v, 2), on: v => { dr.p.decay = v; } });
  UI.knob(row, { id: 'dr-tone', label: 'TONE', min: 0, max: 1, value: 0.5, fmt: fPct, on: v => { dr.p.tone = v; } });
  UI.knob(row, { id: 'dr-pm', label: 'PMOD (bombo)', min: 0, max: 1.6, value: 1, fmt: v => dec(v, 2), on: v => { dr.p.pmod = v; } });
  UI.knob(row, { id: 'dr-ns', label: 'NOISE', min: 0, max: 1.5, value: 1, fmt: fPct, on: v => { dr.p.noise = v; } });
  const draw1 = live(sc.cv, (g, w, h) => {
    grid(g, w, h, 8, 4);
    const p = dr.p, T = 0.6, X = t => 12 + (w - 24) * t / T, base = h - 20;
    const pitch = [], amp = [];
    for (let i = 0; i <= 160; i++) {
      const t = T * i / 160; let f = 0, a = 0;
      if (last === 'bd') { const f0 = 50 * p.tune, f1 = f0 * (1 + 5 * p.pmod), td = 0.055 + 0.04 * p.pmod; f = t < td ? f1 * Math.pow(f0 / f1, t / td) : f0; a = Math.exp(-t / (0.11 * p.decay + 0.02)); }
      else if (last === 'sd') { f = 185 * p.tune * (t < 0.03 ? 1.5 - t / 0.06 : 1); a = Math.max(Math.exp(-t / (0.05 * p.decay)) * 0.7, Math.exp(-t / (0.07 * p.decay + 0.01)) * 0.75); }
      else if (last === 'ch' || last === 'oh') { f = 0; a = Math.exp(-t / (last === 'ch' ? 0.018 : 0.16 * p.decay)); }
      else if (last === 'cp') { a = t < 0.031 ? Math.exp(-((t % 0.011) / 0.004)) : 0.75 * Math.exp(-(t - 0.031) / (0.09 * p.decay)); }
      else if (last === 'cb') { f = 800 * p.tune; a = t < 0.03 ? 0.3 + 0.7 * Math.exp(-t / 0.012) : 0.3 * Math.exp(-(t - 0.03) / (0.09 * p.decay)); }
      else if (last === 'rs') { f = 1700 * p.tune; a = Math.exp(-t / 0.012); }
      else { const b = last === 'lt' ? 95 : last === 'mt' ? 135 : 185; f = b * p.tune * (t < 0.08 ? 1.6 - 0.6 * t / 0.08 : 1); a = Math.exp(-t / (0.14 * p.decay)); }
      pitch.push([X(t), base - clamp(Math.log(Math.max(f, 30) / 30) / Math.log(2000 / 30), 0, 1) * (base - 20)]);
      amp.push([X(t), base - a * (base - 20)]);
    }
    if (!['ch', 'oh', 'cp'].includes(last)) path(g, pitch, SC.vio, 2);
    path(g, amp, SC.ora, 2.2);
    txt(g, DRUM_NAME[last] + (['ch', 'oh', 'cp'].includes(last) ? ' · ruido, sin tono definido' : ''), 10, 12, 'left', SC.fg, 11);
    txt(g, '600 ms', w - 10, h - 8, 'right', SC.dim, 9);
    const age = (performance.now() - lastT) / 1000;
    if (age < T) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(X(age), 18, 1.5, base - 18); }
  });
  /* secuenciador de 16 pasos */
  el('h4', 'lab-sub', root, 'Tu primer ritmo: 16 pasos');
  const gridEl = el('div', 'steps', root);
  const pat = { bd: [0, 4, 8, 12], sd: [], cp: [4, 12], ch: [2, 6, 10, 14], oh: [] };
  const cells = {};
  LANES.forEach(([k, n]) => {
    el('span', 'st-l', gridEl, n);
    cells[k] = [];
    for (let i = 0; i < 16; i++) {
      const b = el('button', 'st' + (i % 4 === 0 ? ' beat' : ''), gridEl); b.type = 'button'; b.setAttribute('aria-label', n + ' paso ' + (i + 1));
      const set = () => b.setAttribute('aria-pressed', pat[k].includes(i) ? 'true' : 'false');
      b.addEventListener('click', () => { const j = pat[k].indexOf(i); if (j >= 0) pat[k].splice(j, 1); else pat[k].push(i); set(); });
      set(); cells[k].push(b);
    }
  });
  let bpm = 120, swing = 0;
  const pl = new Player();
  let stepNow = -1;
  const row2 = UI.row(root);
  const play = UI.tog(row2, { id: 'dr-play', text: 'PLAY', on: v => {
    if (v) pl.start((i, t) => {
      const sw = i % 2 ? swing * (60 / bpm / 4) : 0;
      LANES.forEach(([k]) => { if (pat[k].includes(i)) dr.hit(k, t + sw, i % 4 === 0 ? 0.95 : 0.75); });
      setTimeout(() => { stepNow = i; Object.values(cells).forEach(c => c.forEach((b, j) => b.classList.toggle('now', j === i))); }, Math.max(0, (t - A.t) * 1000));
    }, () => 60 / bpm / 4, 16);
    else { pl.stop(); stepNow = -1; Object.values(cells).forEach(c => c.forEach(b => b.classList.remove('now'))); }
  } });
  UI.knob(row2, { id: 'dr-bpm', label: 'BPM', min: 60, max: 180, step: 1, value: bpm, fmt: String, on: v => { bpm = v; } });
  UI.knob(row2, { id: 'dr-sw', label: 'SWING', min: 0, max: 0.6, value: 0, fmt: fPct, on: v => { swing = v; } });
  UI.btn(row2, { text: 'Borrar', on: () => { LANES.forEach(([k]) => { pat[k].length = 0; cells[k].forEach(b => b.setAttribute('aria-pressed', 'false')); }); } });
  void stepNow;
  return { inst: dr, name: 'Batería sintetizada', draw: draw1, hide: () => { if (play.get()) play.set(false, true); } };
});

/* ======================================================= 19 · efectos */
Labs.def('efectos', root => {
  UI.head(root, 'Color y espacio', 'Pulsa <b>Riff</b> (o toca el teclado) y añade efectos. La distorsión va en la pista (inserto); chorus, delay y reverb son <em>envíos</em>: mandas una parte de la señal a cada uno, como en el FM-1.');
  const sc = UI.screen(root, 170);
  sc.cv.setAttribute('aria-label', 'Curva de distorsión, ecos del delay y caída de la reverb');
  const fx = new FX({ dist: 0, dtype: 'soft', tone: 0.6, cho: 0, dly: 0, time: 0.33, fb: 0.45, rev: 0, size: 2.2, damp: 0.5 });
  const syn = new Synth({ osc: [{ w: 'sawtooth' }, { w: 'square', lv: 0.4, semi: -12 }], f: { cut: 1500, q: 3, env: 1.5 }, ae: { a: 0.004, d: 0.4, s: 0.3, r: 0.3 }, fe: { a: 0.003, d: 0.3, s: 0.2, r: 0.3 }, gain: 0.22 });
  let routed = false;
  const ensure = () => { if (!routed && A.ensure()) { syn.route(fx.input); routed = true; } };
  const origOn = syn.noteOn.bind(syn); syn.noteOn = (m, v) => { ensure(); return origOn(m, v); };
  const P = fx.p;
  const set = q => { ensure(); fx.set(q); };
  const pl = new Player(), riff = [45, null, 57, 45, null, 52, 55, null, 43, null, 55, 43, null, 50, 52, 55];
  const rowA = UI.row(root);
  const play = UI.tog(rowA, { id: 'fx-play', text: 'Riff', on: v => { if (v) { ensure(); pl.start((i, t, sd) => { if (riff[i] != null) syn.play(riff[i], 0.85, t, sd * 0.7); }, 60 / 100 / 4 * 2, riff.length); } else pl.stop(); } });
  const sec = (name) => { el('h4', 'lab-sub', root, name); return UI.row(root); };
  const r1 = sec('DIST · inserto en la pista');
  UI.knob(r1, { id: 'fx-dist', label: 'DIST', min: 0, max: 1, value: 0, fmt: fPct, on: v => set({ dist: v }) });
  UI.seg(r1, { id: 'fx-dt', label: 'TYPE', value: 'soft', wide: true, opts: [['soft', 'SOFT'], ['hard', 'HARD'], ['fold', 'FOLD'], ['crush', 'CRUSH'], ['rect', 'RECT'], ['amp', 'AMP']], on: v => set({ dtype: v }) });
  UI.knob(r1, { id: 'fx-tone', label: 'TONE', min: 0, max: 1, value: 0.6, fmt: fPct, on: v => set({ tone: v }) });
  const r2 = sec('CHORUS · envío');
  UI.knob(r2, { id: 'fx-cho', label: 'Envío', min: 0, max: 1, value: 0, fmt: fPct, on: v => set({ cho: v }) });
  UI.knob(r2, { id: 'fx-cr', label: 'RATE', min: 0.1, max: 4, log: true, value: 0.7, fmt: v => dec(v, 2) + ' Hz', on: v => set({ chRate: v }) });
  UI.knob(r2, { id: 'fx-cd', label: 'DEPTH', min: 0, max: 1, value: 0.5, fmt: fPct, on: v => set({ chDepth: v }) });
  const r3 = sec('DELAY · envío');
  UI.knob(r3, { id: 'fx-dly', label: 'Envío', min: 0, max: 1, value: 0, fmt: fPct, on: v => set({ dly: v }) });
  UI.knob(r3, { id: 'fx-time', label: 'TIME', min: 0.03, max: 1.2, log: true, value: 0.33, fmt: fS, on: v => set({ time: v }) });
  UI.knob(r3, { id: 'fx-fb', label: 'FEEDBK', min: 0, max: 0.92, value: 0.45, fmt: fPct, on: v => set({ fb: v }) });
  UI.knob(r3, { id: 'fx-dt2', label: 'TONE', min: 0, max: 1, value: 0.55, fmt: v => v < 0.47 ? 'más oscuro' : v > 0.53 ? 'más fino' : 'neutro', on: v => set({ dtone: v }) });
  const r4 = sec('REVERB · envío');
  UI.knob(r4, { id: 'fx-rev', label: 'Envío', min: 0, max: 1, value: 0, fmt: fPct, on: v => set({ rev: v }) });
  UI.knob(r4, { id: 'fx-size', label: 'SIZE', min: 0.3, max: 6, log: true, value: 2.2, fmt: v => dec(v, 1) + ' s', on: v => set({ size: v }) });
  UI.knob(r4, { id: 'fx-damp', label: 'DAMP', min: 0, max: 1, value: 0.5, fmt: fPct, on: v => set({ damp: v }) });
  UI.knob(r4, { id: 'fx-pre', label: 'PRE', min: 0, max: 0.15, value: 0.02, fmt: fS, on: v => set({ pre: v }) });
  const draw = live(sc.cv, (g, w, h) => {
    const pw = w / 3;
    [0, 1, 2].forEach(i => { g.strokeStyle = SC.grid; g.strokeRect(i * pw + 4.5, 4.5, pw - 9, h - 9); });
    const c = F.distCurve(P.dtype, 256), pre = 0.6 + P.dist * 4.5, pts = [];
    for (let i = 0; i <= 120; i++) { const x = i / 120 * 2 - 1; const xi = clamp(x * (P.dist > 0.001 ? pre : 1) * 0.5 + 0.5, 0, 1); const y = P.dist > 0.001 ? c[Math.round(xi * 255)] : x; pts.push([10 + (pw - 20) * (x * 0.5 + 0.5), h / 2 - y * (h * 0.36)]); }
    path(g, pts, heat(0.75), 2); txt(g, 'DIST: entrada → salida', 10, 14, 'left', SC.dim, 10);
    const n = 9, ex = pw + 12, ew = pw - 24;
    for (let k = 0; k < n; k++) { const tt = k * P.time, x = ex + ew * Math.min(1, tt / 2.4), a = k === 0 ? 1 : P.dly * Math.pow(P.fb, k - 1); if (tt > 2.4) break; g.fillStyle = k === 0 ? SC.fg : heat(0.3 + a * 0.6); g.fillRect(x, h - 18 - a * (h - 40), 5, a * (h - 40)); }
    txt(g, 'DELAY: ecos en 2,4 s', pw + 10, 14, 'left', SC.dim, 10);
    const rx = 2 * pw + 12, rw = pw - 24, rp = [];
    for (let i = 0; i <= 100; i++) { const tt = i / 100 * 6, a = tt < P.pre ? 0 : P.rev * Math.exp(-6.9 * (tt - P.pre) / P.size); rp.push([rx + rw * i / 100, h - 18 - a * (h - 40)]); }
    g.fillStyle = 'rgba(160,140,255,0.18)'; g.beginPath(); g.moveTo(rx, h - 18); rp.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(rx + rw, h - 18); g.closePath(); g.fill();
    path(g, rp, SC.vio, 1.8); txt(g, 'REVERB: cola en 6 s', 2 * pw + 10, 14, 'left', SC.dim, 10);
  });
  return { inst: syn, name: 'Sinte con efectos', draw, hide: () => { if (play.get()) play.set(false, true); } };
});

/* ======================================================= 20 · secuenciar y arpegiar */
const SCALES = { MAJ: [0, 2, 4, 5, 7, 9, 11], MIN: [0, 2, 3, 5, 7, 8, 10], DOR: [0, 2, 3, 5, 7, 9, 10], PEN: [0, 2, 4, 7, 9], MPEN: [0, 3, 5, 7, 10], BLUES: [0, 3, 5, 6, 7, 10] };
Labs.def('secuencia', root => {
  UI.head(root, 'Un patrón que gira', 'Cada columna es un paso; cada fila, una nota de la escala elegida. Activa pasos, cambia LEN y escucha cómo el patrón gira contra la batería de 16 pasos (polimetría). En modo LOCK, un clic en un paso le da su propio filtro abierto: un <em>parameter lock</em>.');
  const syn = new Synth({ osc: [{ w: 'sawtooth' }], f: { cut: 700, q: 9, env: 1.6, kt: 0.3 }, fe: { a: 0.003, d: 0.18, s: 0.1, r: 0.1 }, ae: { a: 0.003, d: 0.2, s: 0.5, r: 0.08 }, gain: 0.24 });
  const dr = new Drums({ gain: 0.45 });
  const ROWS = 8;
  let scale = 'MIN', root0 = 45, len = 16, bpm = 118, swing = 0.1, gate = 0.6, lockMode = false, drums = true;
  const notes = [0, null, 2, 0, null, 4, 3, null, 0, null, 2, 0, 5, null, 4, 2];
  const locks = new Set([5, 12]);
  const g = el('div', 'seq', root);
  const btns = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    el('span', 'seq-l', g, '');
    for (let c = 0; c < 16; c++) {
      const b = el('button', 'sq' + (c % 4 === 0 ? ' beat' : ''), g); b.type = 'button';
      b.addEventListener('click', () => {
        if (lockMode) { if (locks.has(c)) locks.delete(c); else locks.add(c); }
        else notes[c] = notes[c] === r ? null : r;
        paint();
      });
      btns.push({ b, r, c });
    }
  }
  const lockRow = el('div', 'seq-lk', root);
  const lockCells = [];
  el('span', 'seq-l', lockRow, 'LOCK');
  for (let c = 0; c < 16; c++) lockCells.push(el('span', 'lk', lockRow));
  const degNote = d => { const sc = SCALES[scale], o = Math.floor(d / sc.length); return root0 + sc[d % sc.length] + 12 * o; };
  function paint() {
    const labels = g.querySelectorAll('.seq-l');
    labels.forEach((l, i) => { l.textContent = nameEn(degNote(ROWS - 1 - i)); });
    btns.forEach(({ b, r, c }) => {
      b.setAttribute('aria-pressed', notes[c] === r ? 'true' : 'false');
      b.classList.toggle('off', c >= len);
      b.setAttribute('aria-label', 'Paso ' + (c + 1) + ', ' + nameEs(degNote(r)));
    });
    lockCells.forEach((l, c) => l.classList.toggle('on', locks.has(c)));
  }
  paint();
  const pl = new Player();
  let i16 = 0;
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'seq-play', text: 'PLAY', on: v => {
    if (v) {
      i16 = 0;
      pl.start((i, t, sd) => {
        const st = i % len, sw = (i % 2) ? swing * sd : 0;
        const d = notes[st];
        if (d != null) { if (locks.has(st)) syn.set({ f: { cut: 3200 } }); else syn.set({ f: { cut: 700 } }); syn.play(degNote(d), locks.has(st) ? 1 : 0.8, t + sw, sd * gate); }
        if (drums) { const k = i % 16; if (k % 4 === 0) dr.hit('bd', t, 0.9); if (k % 4 === 2) dr.hit('ch', t + sw, 0.6); if (k === 4 || k === 12) dr.hit('cp', t, 0.7); }
        setTimeout(() => btns.forEach(o => o.b.classList.toggle('now', o.c === st)), Math.max(0, (t - A.t) * 1000));
      }, () => 60 / bpm / 4, 64);
    } else { pl.stop(); btns.forEach(o => o.b.classList.remove('now')); }
  } });
  UI.seg(row, { id: 'seq-sc', label: 'SCALE', value: scale, wide: true, opts: Object.keys(SCALES).map(k => [k, k]), on: v => { scale = v; paint(); } });
  UI.knob(row, { id: 'seq-root', label: 'ROOT', min: 40, max: 51, step: 1, value: root0, fmt: v => nameEs(v).replace(/\d+$/, ''), on: v => { root0 = v; paint(); } });
  UI.knob(row, { id: 'seq-len', label: 'LEN', min: 1, max: 16, step: 1, value: len, fmt: v => v + ' pasos', on: v => { len = v; paint(); } });
  UI.knob(row, { id: 'seq-gate', label: 'GATE', min: 0.1, max: 1, value: gate, fmt: fPct, on: v => { gate = v; } });
  UI.knob(row, { id: 'seq-sw', label: 'SWING', min: 0, max: 0.5, value: swing, fmt: fPct, on: v => { swing = v; } });
  UI.knob(row, { id: 'seq-bpm', label: 'BPM', min: 70, max: 170, step: 1, value: bpm, fmt: String, on: v => { bpm = v; } });
  const row2 = UI.row(root, 'ctrls-1');
  UI.tog(row2, { id: 'seq-lock', text: 'Modo LOCK', icon: 'wave', off: 'Modo LOCK activo', cls: 'tg-s', on: v => { lockMode = v; g.classList.toggle('locking', v); } });
  const dt = UI.tog(row2, { id: 'seq-dr', text: 'Batería', icon: 'wave', off: 'Batería activa', cls: 'tg-s', on: v => { drums = v; } });
  dt.set(true, false);
  UI.btn(row2, { text: 'Dados', icon: 'dice', cls: 'bt-v', on: () => { for (let c = 0; c < 16; c++) notes[c] = Math.random() < 0.6 ? Math.floor(Math.random() * 6) : null; paint(); } });
  UI.btn(row2, { text: 'Borrar', on: () => { notes.fill(null); locks.clear(); paint(); } });
  /* arpegiador */
  el('h4', 'lab-sub', root, 'Arpegiador: mantén un acorde y deja que lo toque');
  const ar = UI.row(root);
  let chord = null, mode = 'UP', octs = 2, aRate = 4;
  const ap = new Player();
  const arpNotes = () => {
    if (!chord) return [];
    const base = []; for (let o = 0; o < octs; o++) chord.forEach(n => base.push(n + 12 * o));
    if (mode === 'DN') return base.slice().reverse();
    if (mode === 'UPDN') return base.concat(base.slice(1, -1).reverse());
    return base;
  };
  const degs = { I: [0, 2, 4], IV: [3, 5, 7], V: [4, 6, 8], vi: [5, 7, 9] };
  const chordBtns = Object.keys(degs).map(k => {
    const b = UI.btn(ar, { text: k, cls: 'bt-sq', on: () => {
      const same = chord && b.getAttribute('aria-pressed') === 'true';
      chordBtns.forEach(x => x.setAttribute('aria-pressed', 'false'));
      if (same) { chord = null; ap.stop(); return; }
      b.setAttribute('aria-pressed', 'true');
      chord = degs[k].map(d => degNote(d) + 12);
      if (!ap.on) ap.start((i, t, sd, k) => { const ns = arpNotes(); if (!ns.length) return; const n = mode === 'RND' ? ns[Math.floor(Math.random() * ns.length)] : ns[k % ns.length]; syn.play(n, 0.75, t, sd * 0.7); }, () => 60 / bpm / aRate, 1);
    } });
    b.setAttribute('aria-pressed', 'false');
    return b;
  });
  UI.seg(ar, { id: 'arp-mode', label: 'MODE', value: mode, opts: [['UP', 'UP'], ['DN', 'DN'], ['UPDN', 'UPDN'], ['RND', 'RND']], on: v => { mode = v; } });
  UI.seg(ar, { id: 'arp-oct', label: 'OCT', value: octs, opts: [[1, '1'], [2, '2'], [3, '3']], on: v => { octs = v; } });
  UI.seg(ar, { id: 'arp-rate', label: 'RATE', value: aRate, opts: [[2, '1/8'], [4, '1/16'], [3, '1/8T']], on: v => { aRate = v; } });
  return { inst: syn, name: 'Bajo secuenciado', hide: () => { if (play.get()) play.set(false, true); ap.stop(); chord = null; chordBtns.forEach(x => x.setAttribute('aria-pressed', 'false')); } };
});

/* ======================================================= 21 · recetas: aproximaciones para escuchar */
const RECIPES = {
  acid: () => {
    const s = new Synth({ osc: [{ w: 'sawtooth' }], mode: 'poly', f: { cut: 240, q: 19, env: 3.4, kt: 0.2 }, fe: { a: 0.002, d: 0.17, s: 0, r: 0.1 }, ae: { a: 0.002, d: 0.3, s: 0.6, r: 0.06 }, gain: 0.22 });
    const line = [33, 33, 45, 33, 43, 33, 36, 45, 33, 33, 48, 33, 43, 45, 31, 33], acc = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0];
    return { inst: s, name: 'Bajo ácido', bpm: 126, div: 4, n: 16, step: (i, t, sd) => { s.p.f.env = acc[i] ? 4.2 : 2.6; s.play(line[i], acc[i] ? 1 : 0.7, t, sd * 0.85); } };
  },
  pad: () => {
    const fx = new FX({ cho: 0.55, chDepth: 0.6, rev: 0.5, size: 4.5, damp: 0.4 });
    const s = new Synth({ osc: [{ w: 'sawtooth', det: -9 }, { w: 'sawtooth', det: 9 }], uni: 2, spread: 14, f: { cut: 1300, q: 2, env: 0.7, kt: 0.3 }, fe: { a: 1.2, d: 2, s: 0.5, r: 2 }, ae: { a: 1.3, d: 1, s: 0.85, r: 2.4 }, lfo: { rate: 0.18, cut: 0.4 }, gain: 0.13 });
    const ch = [[57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [55, 59, 62]];
    return { inst: s, fx, name: 'Pad cálido', bpm: 80, div: 1 / 4, n: 4, step: (i, t, sd) => ch[i].forEach(m => s.play(m, 0.7, t, sd * 0.92)) };
  },
  epiano: () => {
    const fx = new FX({ cho: 0.45, chRate: 0.9, rev: 0.22, size: 1.8 });
    const s = new FM2({ cr: 1, mr: 1, idx: 2.2, ienv: true, id: 0.9, is: 0.18, a: 0.002, d: 2.6, s: 0.12, r: 0.6, vel: 0.7, gain: 0.2 });
    const ch = [[50, 53, 57, 60], [43, 53, 55, 59], [48, 52, 55, 59], [45, 52, 55, 60]];
    return { inst: s, fx, name: 'Piano eléctrico FM', bpm: 84, div: 1 / 2, n: 8, step: (i, t, sd) => { const c = ch[Math.floor(i / 2) % 4]; c.forEach((m, j) => s.play(m, i % 2 ? 0.55 : 0.85, t + j * 0.012, sd * (i % 2 ? 0.5 : 0.95))); } };
  },
  bell: () => {
    const fx = new FX({ rev: 0.45, size: 4.5, damp: 0.3, dly: 0.2, time: 0.42, fb: 0.35 });
    const s = new FM2({ cr: 1, mr: 3.5, idx: 4.5, ienv: true, id: 2.4, is: 0, a: 0.002, d: 4, s: 0, r: 3, gain: 0.2 });
    const mel = [76, null, 79, 74, null, 72, null, null, 69, null, 72, 74, null, null, 67, null];
    return { inst: s, fx, name: 'Campana de cristal', bpm: 96, div: 2, n: 16, step: (i, t) => { if (mel[i] != null) s.play(mel[i], 0.8, t, 2.5); } };
  },
  guitar: () => {
    const fx = new FX({ dly: 0.18, time: 0.3, fb: 0.3, rev: 0.2, size: 1.6 });
    const s = new Strings({ exc: 'pluck', decay: 0.55, bright: 0.55, pos: 0.14, gain: 0.5 });
    const pk = [40, 47, 52, 55, 59, 55, 52, 47, 45, 52, 57, 60, 64, 60, 57, 52];
    return { inst: s, fx, name: 'Cuerda pulsada', bpm: 100, div: 4, n: 16, step: (i, t, sd) => s.play(pk[i], 0.75 + 0.2 * (i % 4 === 0), t, sd * 3) };
  },
  organ: () => {
    const s = new Organ({ bars: [8, 8, 8, 0, 0, 0, 0, 0, 0], perc: 3, rotor: 1, gain: 0.16 });
    const ch = [[48, 55, 60, 64], [48, 55, 60, 64], [53, 57, 60, 65], [55, 59, 62, 67]];
    return { inst: s, name: 'Órgano con rotor', bpm: 100, div: 1, n: 8, step: (i, t, sd) => { if (i === 4) s.set({ rotor: 2 }); if (i === 0) s.set({ rotor: 1 }); ch[Math.floor(i / 2) % 4].forEach(m => s.play(m, 0.8, t, sd * (i % 2 ? 0.45 : 0.9))); } };
  },
  voice: () => {
    const fx = new FX({ cho: 0.4, rev: 0.45, size: 3.5 });
    const s = new Formant({ glide: 0.12, vib: 18, gain: 0.8 });
    const mel = [57, 60, 64, 62, 60, 59, 57, 57], vw = ['a', 'a', 'o', 'a', 'e', 'a', 'o', 'u'];
    return { inst: s, fx, name: 'Voz que canta', bpm: 72, div: 1, n: 8, step: (i, t, sd) => { setTimeout(() => s.vowel(VOWELS[vw[i]][0], VOWELS[vw[i]][1], VOWELS[vw[i]][2]), Math.max(0, (t - A.t) * 1000)); s.play(mel[i], 0.8, t, sd * 0.95); } };
  },
  kick808: () => {
    const s = new Drums({ tune: 0.86, decay: 2.6, pmod: 0.7, gain: 0.55 });
    const bd = [0, 7, 10], ch = [2, 6, 10, 14], cp = [4, 12];
    return { inst: s, name: 'Bombo 808', bpm: 92, div: 4, n: 16, step: (i, t) => { if (bd.includes(i)) s.hit('bd', t, 1); if (ch.includes(i)) s.hit('ch', t, 0.5); if (cp.includes(i)) s.hit('cp', t, 0.7); } };
  },
  chip: () => {
    const fx = new FX({ dly: 0.25, time: 0.19, fb: 0.35 });
    const s = new Chip({ wave: 'pulse', duty: 0.125, bits: 4, div: 2, r: 0.04, gain: 0.22 });
    const ch = [60, 64, 67, 72, 76, 72, 67, 64, 57, 60, 64, 69, 72, 69, 64, 60];
    return { inst: s, fx, name: 'Arpegio chip', bpm: 140, div: 4, n: 16, step: (i, t, sd) => s.play(ch[i], 0.8, t, sd * 0.6) };
  },
  wind: () => {
    const s = new Synth({ osc: [{ w: 'sine', lv: 0 }], noise: 1, f: { type: 'bandpass', cut: 700, q: 5 }, ae: { a: 1.6, d: 0.5, s: 1, r: 2.5 }, lfo: { rate: 0.13, w: 'sine', cut: 1.6 }, gain: 0.55 });
    return { inst: s, name: 'Viento', bpm: 60, div: 1 / 8, n: 1, step: (i, t) => { if (!s.p.nbuf && A.ctx) s.p.nbuf = noiseBuf('pink'); s.play(57, 0.8, t, 7); } };
  }
};
Labs.def('receta', root => {
  const k = root.dataset.r, R = RECIPES[k] && RECIPES[k]();
  if (!R) return {};
  root.classList.add('lab-mini');
  if (R.fx) { let routed = false; const ens = () => { if (!routed && A.ensure()) { R.inst.route(R.fx.input); routed = true; } }; const o = R.inst.noteOn.bind(R.inst); R.inst.noteOn = (m, v) => { ens(); return o(m, v); }; R.ens = ens; }
  const pl = new Player();
  const row = el('div', 'rc-row', root);
  const tg = UI.tog(row, { id: 'rc-' + k, text: 'Escuchar la aproximación', on: v => {
    if (v) { if (R.ens) R.ens(); F.Dock.use(R.inst, R.name); pl.start((i, t, sd) => R.step(i, t, sd), 60 / R.bpm / R.div, R.n); }
    else { pl.stop(); R.inst.allOff && R.inst.allOff(); }
  } });
  el('span', 'rc-n', row, 'o tócala en el teclado de abajo');
  return { inst: R.inst, name: R.name, hide: () => { if (tg.get()) tg.set(false, true); } };
});

/* ======================================================= 22 · entrena tu oído */
const QUIZ = [
  ['cut', 'El corte del filtro (CUT)', 'EDIT › TONE › FILTER, KNOB 2', b => ({ f: { cut: b.f.cut * (Math.random() < 0.5 ? 0.3 : 3.2) } })],
  ['res', 'La resonancia (RES)', 'EDIT › TONE › FILTER, KNOB 3', () => ({ f: { q: 20 } })],
  ['atk', 'El ataque (ATK)', 'ENV › ENV, KNOB 1', () => ({ ae: { a: 0.55 } })],
  ['rel', 'El release (REL)', 'ENV › ENV, KNOB 4', () => ({ ae: { r: 1.8 } })],
  ['vib', 'Vibrato: LFO al tono', 'LFO › LFO DEST, KNOB 1 (PITCH)', () => ({ lfo: { rate: 5.5, pitch: 40 } })],
  ['trem', 'Trémolo: LFO al volumen', 'LFO › LFO DEST, KNOB 4 (AMP)', () => ({ lfo: { rate: 6, amp: 0.85 } })],
  ['wah', 'LFO al filtro', 'LFO › LFO DEST, KNOB 2 (FILTER)', () => ({ lfo: { rate: 3, cut: 1.8 } })],
  ['wave', 'La forma de onda (WAVE)', 'EDIT › SOUND · EDIT 1, KNOB 1', b => ({ osc: [{ w: b.osc[0].w === 'sawtooth' ? 'square' : 'sawtooth' }, { w: b.osc[0].w === 'sawtooth' ? 'square' : 'sawtooth', lv: 0 }] })],
  ['det', 'La desafinación (DETUNE)', 'EDIT › SOUND · EDIT 1, KNOB 2', b => ({ osc: [{ w: b.osc[0].w, det: -9 }, { w: b.osc[0].w, lv: 1, det: 9 }] })],
  ['oct', 'La octava', 'OCT− / OCT+', () => ({ tr: Math.random() < 0.5 ? 12 : -12 })]
];
Labs.def('oido', root => {
  UI.head(root, '¿Qué cambió?', 'Escucha <b>A</b> (el sonido de partida) y <b>B</b> (el mismo con un solo parámetro cambiado). Elige qué cambió. Diez rondas; usa auriculares si puedes.');
  const box = el('div', 'ear', root);
  const ab = el('div', 'ear-ab', box);
  const ba = UI.btn(ab, { id: 'ear-a', text: 'Escuchar A', icon: 'ear', cls: 'bt-big' });
  const bb = UI.btn(ab, { id: 'ear-b', text: 'Escuchar B', icon: 'ear', cls: 'bt-big bt-v' });
  const opts = el('div', 'ear-o', box);
  const fb = el('p', 'ear-f', box);
  const score = el('p', 'ear-s', box);
  const nx = UI.btn(box, { id: 'ear-next', text: 'Siguiente ronda', icon: 'play' });
  let round = 0, pts = 0, cur = null, answered = false, base = null, mod = null;
  const synA = new Synth(), synB = new Synth();
  const mkBase = () => ({ osc: [{ w: Math.random() < 0.5 ? 'sawtooth' : 'square' }, { w: 'sawtooth', lv: 0 }], f: { type: 'lowpass', cut: 1100 + Math.random() * 900, q: 2, env: 0.6 }, fe: { a: 0.01, d: 0.4, s: 0.4, r: 0.3 }, ae: { a: 0.01, d: 0.3, s: 0.75, r: 0.25 }, lfo: { rate: 5, w: 'sine', pitch: 0, cut: 0, amp: 0 }, tr: 0, gain: 0.26 });
  const reset = s => { s.p = F.mrg({ gain: 0.28, poly: 8, mode: 'poly', prio: 'last', glide: 0, vel: 0.5, tr: 0, osc: [{ w: 'sawtooth' }], uni: 1, spread: 0, noise: 0, ring: false, f: { type: 'lowpass', cut: 20000, q: 0.7, env: 0, kt: 0, vel: 0 }, ae: { a: 0.005, d: 0.3, s: 0.85, r: 0.25 }, fe: { a: 0.005, d: 0.4, s: 0, r: 0.3 }, pe: { amt: 0, d: 0.08 }, lfo: { rate: 5, w: 'sine', pitch: 0, cut: 0, amp: 0 }, pan: 0, rpan: 0 }, {}); };
  const playOn = (s, cfg) => { reset(s); s.set(JSON.parse(JSON.stringify(cfg))); s.set({}); const t = A.t + 0.05; s.play(48, 0.85, t, 1.2); s.play(55, 0.85, t + 0.03, 1.2); };
  function newRound() {
    answered = false; fb.textContent = ''; fb.className = 'ear-f';
    round++;
    if (round > 10) { score.innerHTML = '<b>' + pts + ' de 10.</b> ' + (pts >= 8 ? 'Tienes oído de sintetista.' : pts >= 5 ? 'Muy bien. Repite las lecciones de lo que fallaste y vuelve a intentarlo.' : 'Es normal al principio: repasa filtro, envolventes y LFO y vuelve.'); round = 0; pts = 0; opts.innerHTML = ''; nx.querySelector('span:last-child').textContent = 'Empezar otra vez'; return; }
    nx.querySelector('span:last-child').textContent = 'Siguiente ronda';
    cur = QUIZ[Math.floor(Math.random() * QUIZ.length)];
    base = mkBase(); mod = F.mrg(JSON.parse(JSON.stringify(base)), cur[3](base));
    const others = QUIZ.filter(q => q !== cur).sort(() => Math.random() - 0.5).slice(0, 3);
    const all = others.concat([cur]).sort(() => Math.random() - 0.5);
    opts.innerHTML = '';
    all.forEach(q => {
      const b = el('button', 'ear-b', opts, q[1]); b.type = 'button';
      b.addEventListener('click', () => {
        if (answered) return; answered = true;
        const ok = q === cur; if (ok) pts++;
        b.classList.add(ok ? 'ok' : 'no');
        if (!ok) [...opts.children].forEach(x => { if (x.textContent === cur[1]) x.classList.add('ok'); });
        fb.className = 'ear-f ' + (ok ? 'ok' : 'no');
        fb.innerHTML = (ok ? '¡Bien! ' : 'Era: <b>' + cur[1] + '</b>. ') + 'En tu FM-1: <span class="path">' + cur[2] + '</span>';
        score.textContent = 'Ronda ' + round + ' de 10 · ' + pts + ' aciertos';
      });
    });
    score.textContent = 'Ronda ' + round + ' de 10 · ' + pts + ' aciertos';
  }
  ba.addEventListener('click', () => { if (!base) newRound(); playOn(synA, base); });
  bb.addEventListener('click', () => { if (!base) newRound(); playOn(synB, mod); });
  nx.addEventListener('click', () => { newRound(); setTimeout(() => playOn(synA, base), 60); });
  score.textContent = 'Pulsa «Escuchar A» para empezar.';
  return { inst: synA, name: 'Sonido A' };
});
})();
