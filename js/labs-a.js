/* Síntesis con tu FM-1 · laboratorios: el instrumento, el sonido y la anatomía del sintetizador */
(function () {
'use strict';
const F = window.FM1C;
const { $, el, sv, clamp, lerp, mtof, nameEn, nameEs, dec, fHz, fS, fPct, RM, heat, A, Synth, FX, SC, fit, grid, txt, path, scope, spectrum, UI, Player, Dock, panel, Labs, cycle, pwHarm, pwCycle, lfoShape } = F;

/* lienzo que solo se repinta cuando algo cambia o cambia de tamaño */
function painter(cv, fn) {
  let dirty = true, lw = 0, lh = 0;
  return {
    mark() { dirty = true; },
    draw() {
      const r = cv.getBoundingClientRect();
      if (!dirty && Math.abs(r.width - lw) < 1 && Math.abs(r.height - lh) < 1) return;
      const c = fit(cv); if (!c) return;
      lw = r.width; lh = r.height; dirty = false; fn(c.g, c.w, c.h);
    }
  };
}
function live(cv, fn) { return () => { const c = fit(cv); if (c) fn(c.g, c.w, c.h); }; }
function drawCycle(g, w, h, cyc, color, lw = 2, cycles = 2, amp = 0.4) {
  const pts = [], N = cyc.length;
  for (let x = 0; x <= w; x++) { const i = Math.floor((x / w) * cycles * N) % N; pts.push([x, h / 2 - cyc[i] * h * amp]); }
  path(g, pts, color, lw);
}
F.painter = painter; F.live = live; F.drawCycle = drawCycle;

/* ======================================================= 1 · el panel del FM-1 */
const INFO = {
  'MASTER': ['Perilla', 'El volumen general: altavoz, auriculares y la salida USB.', '', ''],
  'SELECT': ['Encoder', 'Recorre las páginas de la sección en la que estás, una página por paso. Se detiene en la primera y en la última.', 'Con un botón mantenido: HOME + SELECT abre GEN (el generador de temas); EDIT, SEQ, LFO o FX + SELECT tiran los dados de esa parte; GLO + SELECT cambia el tempo.', 'panel'],
  'ALGORITHM': ['Encoder', 'Elige la pista: T1 a T6 (T1 a T4 mientras TRACKS esté en 4). En JIANT ya no elige el algoritmo FM; eso vive en EDIT de una pista FM6.', 'Con una capa mantenida, cambia la vista de la capa: MAP, KNOBS o STATE.', 'panel'],
  'PRESETS': ['Encoder', 'Siempre carga sonidos en la pista elegida: los presets de todos los motores en una sola lista y después los tuyos. En las páginas SEQ carga patrones; en GEN, el género.', '', 'recetas'],
  'KNOB 1': ['Perilla', 'La primera de las cuatro tarjetas de la pantalla. Cuando una página tiene que elegir algo (un paso, un operador, una etapa de la envolvente), lo elige KNOB 1.', 'Con LFO mantenido es la macro M1. Con un paso mantenido en SEQ › STEP graba un parameter lock.', 'envolvente'],
  'KNOB 2': ['Perilla', 'La segunda tarjeta de la pantalla. Su función cambia con la página: CUT en el filtro, DEC en la envolvente, WAVE en el LFO…', 'Con LFO mantenido es la macro M2.', 'filtro'],
  'KNOB 3': ['Perilla', 'La tercera tarjeta de la pantalla.', 'Con LFO mantenido es la macro M3.', 'filtro'],
  'KNOB 4': ['Perilla', 'La cuarta tarjeta de la pantalla.', 'Con LFO mantenido es la macro M4.', 'filtro'],
  'OCT-': ['Botón', 'Baja una octava el teclado (hasta −3). Con OCT+ a la vez vuelve a 0. En diálogos y páginas de acción significa NO o atrás.', '', 'altura'],
  'OCT+': ['Botón', 'Sube una octava el teclado (hasta +3). En diálogos y páginas de acción significa SÍ: hazlo.', '', 'altura'],
  'HOME': ['Botón', 'El ecosistema: una criatura por pista que se mueve con su sonido. Tocarlo otra vez pasa por ECO, BEING y GEN.', 'Mantenido unos 0,7 s abre el MENU (pantalla, audio, MIDI, USB, sistema). HOME + SELECT: GEN, el generador de temas.', 'panel'],
  'EDIT': ['Botón', 'El motor de la pista: SOUND (EDIT 1 y EDIT 2), TONE (FILTER, VOICE…) y FOCUS. En una pista FM6, el tercer grupo es OPERATOR.', 'Mantenido: F3 = INIT (el sonido base del motor) y G3 = RECALL. EDIT + SELECT tira los dados del sonido: OCT+ lo guarda, OCT− lo deshace.', 'oscilador'],
  'ENV': ['Botón', 'Las envolventes de cada pista: TRACKS, ENV (ATK DEC SUS REL), ENV DEST y STAGE.', 'No tiene capa.', 'envolvente'],
  'LFO': ['Botón', 'La modulación: MOD (la matriz de 4 ranuras), LFO, LFO DEST y MSEQ.', 'Mantenido: las cuatro perillas son las macros M1–M4 (quedan enganchadas hasta volver a pulsar LFO).', 'modulacion'],
  'FX': ['Botón', 'Los efectos: envíos de la pista, distorsión, delay, reverb, chorus, slicer, master y punch-in.', 'Mantenido: las teclas se vuelven efectos para tocar en vivo (repeticiones, stutter, tape stop…).', 'efectos'],
  'SCL': ['Botón', 'La escala (ROOT, SCALE, QUANT) y los acordes (CHORD).', 'Mantenido: cualquier tecla fija la tónica.', 'secuencia'],
  'GLO': ['Botón', 'Lo global: LIVE, MIX (niveles y paneo), GLOBAL (tempo, swing, afinación) y SYSTEM (TRACKS y LOAD).', 'Mantenido: mutes y solos en las teclas, F4 = TAP tempo y G4 = UNDO.', 'panel'],
  'SAVE': ['Botón', 'Guardar y cargar: canción, secciones A–D, proyectos y tus presets de sonido.', 'Mantenido: tocar o guardar secciones en vivo; C5 = NAME.', 'secuencia'],
  'ARP': ['Botón', 'El arpegiador de la pista: ARP (MODE, RATE, OCT, GATE) y ARP 2.', 'No tiene capa.', 'secuencia'],
  'SEQ': ['Botón', 'El secuenciador de 64 pasos: PATTERN, TRACK, BAR (el piano roll), STEP y AUTO.', 'Mantenido: SEQ TOOLS. G5 borra el paso del cursor.', 'secuencia'],
  'PLAY': ['Botón', 'Arranca y para.', 'GLO + PLAY vuelve al principio sin parar.', 'secuencia'],
  'REC': ['Botón', 'Arma la grabación en la pista elegida: lo que toques y los giros de perilla quedan grabados.', 'Mantenido: F3 borra la pista, G3 el metrónomo (CLICK).', 'secuencia']
};
const LAYERS = {
  EDIT: { F3: 'INIT', G3: 'RECALL' },
  GLO: { 'F#3': 'MUTE T1', 'G#3': 'MUTE T2', 'A#3': 'MUTE T3', 'C#4': 'MUTE T4', 'D#4': 'MUTE T5', 'F#4': 'MUTE T6', 'G#4': 'KICK', 'A#4': 'SNARE', 'C#5': 'HAT', 'D#5': 'PERC', F3: 'SOLO T1', G3: 'SOLO T2', A3: 'SOLO T3', B3: 'SOLO T4', C4: 'SOLO T5', D4: 'SOLO T6', E4: 'UNMUTE', F4: 'TAP', G4: 'UNDO' },
  FX: { F3: 'RPT 1/8', G3: 'RPT 1/16', A3: 'RPT 1/32', B3: 'GLITCH', C4: 'TAPE STOP', D4: 'OCT−', E4: 'OCT+', F4: '1/2 TEMPO', G4: 'DEC−', A4: 'DEC+', B4: 'STUT 1/8', C5: 'STUT 1/16', D5: 'ATK+', E5: 'ARP', F5: 'RANDOM', G5: 'BORRA', 'F#3': 'MUTE T1', 'G#3': 'MUTE T2', 'A#3': 'MUTE T3', 'C#4': 'MUTE T4', 'D#4': 'MUTE T5', 'F#4': 'MUTE T6', 'G#4': 'FREEZE', 'A#4': 'ALL/SYN', 'C#5': 'SHUFFLE', 'D#5': 'CRUSH', 'F#5': 'THROW' },
  SEQ: { F3: 'CLEAR', G3: 'REVERSE', A3: 'SHIFT ←', B3: 'SHIFT →', C4: 'RANDOM', D4: 'COOK', E4: 'BEAT', F4: 'CLR AUTO', G5: 'CLR STEP' }
};
const LAYER_TXT = {
  '': 'Sin capa: cada tecla toca su nota en la pista elegida.',
  EDIT: 'EDIT mantenido: F3 devuelve el sonido base del motor (INIT) y G3 recupera el sonido tal como lo guardó la sección (RECALL). Los dos preguntan antes.',
  GLO: 'GLO mantenido: las negras silencian pistas, las blancas graves las dejan solas, F4 marca el tempo con toques y G4 deshace el último cambio grande.',
  FX: 'FX mantenido: el teclado se vuelve una pedalera de efectos para tocar en vivo. Se graban en su propio carril.',
  SEQ: 'SEQ mantenido: herramientas del secuenciador. Ojo: no tienen deshacer.'
};
Labs.def('panel', root => {
  UI.head(root, 'Toca un control', 'Pasa el cursor o toca cualquier perilla, botón o tecla del dibujo. Abajo puedes ver qué hacen las teclas mientras mantienes un botón, como la vista MAP de JIANT.');
  const g = el('div', 'pn-g', root);
  const box = el('div', 'pn-svg', g);
  const info = el('div', 'pn-info', g);
  const P = panel(box, { interactive: true, label: 'Panel interactivo del FM-1' });
  const lessonName = id => { const a = $('#rail a[data-l="' + id + '"]'); return a ? a.textContent.replace(/^\d+/, '').trim() : ''; };
  let layer = '';
  function show(id) {
    Object.values(P.ctls).forEach(c => c.classList.toggle('sel', c.getAttribute('data-ctl') === id));
    let h = '';
    const I = INFO[id];
    if (I) {
      h += '<p class="pn-k">' + I[0] + '</p><h4>' + id.replace('-', '−') + '</h4><dl><dt>Al tocarlo</dt><dd>' + I[1] + '</dd>';
      if (I[2]) h += '<dt>Mantenido o combinado</dt><dd>' + I[2] + '</dd>';
      h += '</dl>';
      if (I[3]) h += '<p class="pn-l">Lo verás en <a href="#' + I[3] + '">' + lessonName(I[3]) + '</a></p>';
    } else {
      const black = id.indexOf('#') > 0;
      h += '<p class="pn-k">Tecla ' + (black ? 'negra' : 'blanca') + '</p><h4>' + id + '</h4><dl><dt>Sola</dt><dd>Toca esa nota en la pista seleccionada (sube o baja con OCT).</dd>';
      const ls = Object.keys(LAYERS).filter(L => LAYERS[L][id]).map(L => '<b>' + L + '</b> + ' + id + ' = ' + LAYERS[L][id]);
      if (ls.length) h += '<dt>Con un botón mantenido</dt><dd>' + ls.join('<br>') + '</dd>';
      h += '</dl>';
    }
    info.innerHTML = h;
  }
  Object.values(P.ctls).forEach(c => {
    const id = c.getAttribute('data-ctl');
    c.addEventListener('mouseenter', () => show(id));
    c.addEventListener('focus', () => show(id));
    c.addEventListener('click', () => show(id));
  });
  const overlays = [];
  function paintLayer() {
    overlays.forEach(o => o.remove()); overlays.length = 0;
    Object.values(P.ctls).forEach(c => c.classList.toggle('held', layer && c.getAttribute('data-ctl') === layer));
    if (layer) {
      const map = LAYERS[layer];
      Object.keys(map).forEach(k => {
        const c = P.ctls[k]; if (!c) return;
        const x = +c.dataset.cx, y = +c.dataset.cy;
        const t = sv('text', { x, y, class: 'dv-lay', 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: 'rotate(-90 ' + x + ' ' + y + ')' }, c);
        t.textContent = map[k]; overlays.push(t);
        c.classList.add('lay');
      });
    }
    Object.values(P.ctls).forEach(c => { if (!layer || !LAYERS[layer][c.getAttribute('data-ctl')]) c.classList.remove('lay'); });
    lt.innerHTML = LAYER_TXT[layer];
  }
  const row = UI.row(root, 'ctrls-1');
  UI.seg(row, { id: 'pn-layer', label: 'Capa en las teclas', value: '', wide: true, opts: [['', 'Ninguna'], ['EDIT', 'EDIT'], ['GLO', 'GLO'], ['FX', 'FX'], ['SEQ', 'SEQ']], on: v => { layer = v; paintLayer(); } });
  const lt = UI.note(root, '');
  paintLayer();
  show('EDIT');
  return {};
});

/* ======================================================= 2 · el sonido: aire que vibra */
Labs.def('sonido', root => {
  UI.head(root, 'Aire que vibra', 'Pulsa <b>Sonar</b> y mueve la frecuencia y el nivel. Arriba, las moléculas de aire empujadas por el altavoz (en cámara lenta). Abajo, la onda real que está sonando.');
  const air = UI.screen(root, 190), sc = UI.screen(root, 150);
  air.cv.setAttribute('aria-label', 'Animación de moléculas de aire comprimiéndose y expandiéndose');
  sc.cv.setAttribute('aria-label', 'Osciloscopio con la onda que suena');
  const syn = new Synth({ osc: [{ w: 'sine' }], ae: { a: 0.04, d: 0.1, s: 1, r: 0.08 }, gain: 0.35 * Math.pow(10, -6 / 20) });
  let f = 220, db = -6, on = false;
  const row = UI.row(root);
  const rd = UI.read(root);
  const upd = () => {
    syn.set({ tr: 12 * Math.log2(f / 220), gain: 0.35 * Math.pow(10, db / 20) });
    rd.innerHTML = '<span><i>Frecuencia</i><b>' + fHz(f) + '</b></span><span><i>Periodo</i><b>' + dec(1000 / f, 2) + ' ms</b></span><span><i>Longitud de onda</i><b>' + (343 / f >= 1 ? dec(343 / f, 2) + ' m' : Math.round(34300 / f) + ' cm') + '</b></span><span><i>Nivel</i><b>' + dec(db, 0) + ' dB</b></span>';
  };
  const play = UI.tog(row, { id: 'son-play', text: 'Sonar', on: v => { on = v; if (v) { syn.noteOn(57); } else syn.noteOff(57); } });
  UI.knob(row, { id: 'son-f', label: 'Frecuencia', min: 40, max: 2000, log: true, value: f, fmt: fHz, on: v => { f = v; upd(); } });
  UI.knob(row, { id: 'son-db', label: 'Nivel', min: -40, max: 0, step: 1, value: db, fmt: v => dec(v, 0) + ' dB', on: v => { db = v; upd(); } });
  upd();
  const cols = 38, rows = 7;
  let ph = 0, lastT = 0;
  const drawAir = live(air.cv, (g, w, h, t) => {
    const x0 = 64, span = w - x0 - 12, nrm = Math.log(f / 40) / Math.log(50);
    const fv = 0.35 + 1.6 * nrm, lam = Math.max(60, (240 - 160 * nrm) * Math.min(1, w / 700) + 30);
    const ampv = on ? 9 * Math.pow(10, db / 20) : 0;
    const now = performance.now() / 1000; const dt = Math.min(0.05, now - (lastT || now)); lastT = now;
    if (!RM && on) ph += dt * fv;
    const cone = Math.sin(2 * Math.PI * ph) * ampv;
    g.fillStyle = '#26212F'; g.fillRect(14, h / 2 - 46, 22, 92);
    g.fillStyle = heat(0.55 + 0.25 * Math.sin(2 * Math.PI * ph) * (on ? 1 : 0));
    g.beginPath(); g.moveTo(36 + cone, h / 2 - 52); g.lineTo(48 + cone, h / 2 - 60); g.lineTo(48 + cone, h / 2 + 60); g.lineTo(36 + cone, h / 2 + 52); g.closePath(); g.fill();
    txt(g, 'altavoz', 32, h - 12, 'center', SC.dim, 10);
    for (let c = 0; c < cols; c++) {
      const bx = x0 + span * c / (cols - 1);
      const k = 2 * Math.PI * (ph - (bx - x0) / lam);
      const dx = ampv * Math.sin(k), comp = on ? Math.cos(k) : 0;
      for (let r = 0; r < rows; r++) {
        const y = 22 + (h - 70) * r / (rows - 1) + ((c * 7 + r * 3) % 5) - 2;
        g.fillStyle = heat(0.42 + 0.4 * comp * Math.min(1, ampv / 4 + 0.3));
        g.beginPath(); g.arc(bx + dx + ((r * 13 + c * 5) % 7) - 3, y, 2.4, 0, Math.PI * 2); g.fill();
      }
    }
    const pts = [];
    for (let x = x0; x <= w - 12; x += 3) { const k = 2 * Math.PI * (ph - (x - x0) / lam); pts.push([x, h - 22 - (on ? Math.cos(k) * Math.min(14, ampv * 1.5) : 0)]); }
    path(g, pts, SC.vio, 1.5);
    txt(g, 'presión: comprimido arriba, enrarecido abajo', w - 12, h - 8, 'right', SC.dim, 10);
  });
  const drawSc = live(sc.cv, (g, w, h) => scope(g, w, h, { auto: false, gain: 2.6, ms: Math.min(40, Math.max(4, 3000 / f)), msg: 'Pulsa Sonar para escuchar y ver la onda' }));
  return { inst: syn, name: 'Seno puro', draw: () => { drawAir(); drawSc(); }, hide: () => { if (on) play.set(false, true); } };
});

/* ======================================================= 3 · altura: de hercios a notas */
const INTERVALS = [['1:1', 'Unísono', 1, 1, 1], ['2:1', 'Octava', 2, 2, 1], ['3:2', 'Quinta', 1.5, 3, 2], ['4:3', 'Cuarta', 4 / 3, 4, 3], ['5:4', 'Tercera mayor', 1.25, 5, 4], ['6:5', 'Tercera menor', 1.2, 6, 5], ['16:15', 'Segunda menor', 16 / 15, 16, 15], ['√2', 'Tritono', Math.SQRT2, 0, 0]];
Labs.def('altura', root => {
  UI.head(root, 'La escalera de las frecuencias', 'Toca el teclado de abajo (o tu teclado: Z X C V…). Cada nota aparece en la escalera con su frecuencia. Luego prueba los intervalos: dos notas a la vez y la forma que dibujan juntas.');
  const lad = UI.screen(root, 130), wv = UI.screen(root, 170);
  lad.cv.setAttribute('aria-label', 'Escala de frecuencias de 20 Hz a 20 kHz con las notas que tocas');
  wv.cv.setAttribute('aria-label', 'Dos ondas y su suma para el intervalo elegido');
  const syn = new Synth({ osc: [{ w: 'triangle' }], f: { cut: 5000 }, ae: { a: 0.01, d: 0.6, s: 0.5, r: 0.4 }, gain: 0.32 });
  const pair = new Synth({ osc: [{ w: 'sine' }], ae: { a: 0.02, d: 0.2, s: 0.9, r: 0.3 }, gain: 0.22 });
  const marks = [];
  Dock.listen((m, down) => { if (down && Router_cur() === 'altura') marks.push({ m, t: performance.now() }); });
  const row = UI.row(root);
  let iv = INTERVALS[2];
  UI.seg(row, { id: 'alt-iv', label: 'Intervalo', value: '3:2', wide: true, opts: INTERVALS.map(i => [i[0], i[1]]), on: v => { iv = INTERVALS.find(i => i[0] === v); pw.mark(); } });
  UI.btn(row, { id: 'alt-play', text: 'Escuchar el intervalo', icon: 'play', on: () => { const t = A.t + 0.05; pair.play(57, 0.8, t, 2.2); pair.play(57 + 12 * Math.log2(iv[2]), 0.8, t + 0.5, 1.7); marks.push({ m: 57, t: performance.now() }, { m: 57 + 12 * Math.log2(iv[2]), t: performance.now() + 500 }); } });
  const row2 = UI.row(root, 'ctrls-oct');
  [33, 45, 57, 69, 81, 93].forEach(m => UI.btn(row2, { text: nameEs(m) + ' · ' + Math.round(mtof(m)) + ' Hz', on: () => { syn.play(m, 0.8, A.t + 0.03, 0.9); marks.push({ m, t: performance.now() }); } }));
  const X = (w, f) => 10 + (w - 20) * Math.log(f / 20) / Math.log(1000);
  const drawLad = live(lad.cv, (g, w, h) => {
    const y = h / 2 + 8;
    g.fillStyle = 'rgba(160,140,255,0.12)'; g.fillRect(X(w, mtof(53 - 36)), y - 26, X(w, mtof(79 + 36)) - X(w, mtof(53 - 36)), 40);
    g.fillStyle = 'rgba(255,122,0,0.28)'; g.fillRect(X(w, mtof(53)), y - 26, X(w, mtof(79)) - X(w, mtof(53)), 40);
    txt(g, 'con OCT −3 … +3', X(w, mtof(53 - 36)) + 4, y - 34, 'left', SC.vio, 10);
    txt(g, 'teclas del FM-1', X(w, mtof(53)) + 2, y + 24, 'left', SC.ora, 10);
    g.strokeStyle = SC.axis; g.beginPath(); g.moveTo(10, y + 14.5); g.lineTo(w - 10, y + 14.5); g.stroke();
    [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(f => { const x = X(w, f); g.fillStyle = SC.axis; g.fillRect(x, y + 12, 1, 6); txt(g, f >= 1000 ? (f / 1000) + 'k' : String(f), x, h - 8, 'center', SC.dim, 10); });
    const now = performance.now();
    while (marks.length && now - marks[0].t > 6000) marks.shift();
    marks.forEach(mk => {
      const age = (now - mk.t) / 6000; if (age < 0) return;
      const x = X(w, mtof(mk.m)), a = 1 - age;
      g.fillStyle = heat(0.85, a); g.fillRect(x - 1, y - 30, 2, 44);
      if (age < 0.5) txt(g, nameEs(mk.m) + ' ' + fHz(mtof(mk.m)), x + 5, y - 38 + (marks.indexOf(mk) % 2) * 10, 'left', heat(0.9, a), 11);
    });
  });
  const pw = F.painter(wv.cv, (g, w, h) => {
    grid(g, w, h, 8, 4);
    const r = iv[2], cyc = 4, N = 900;
    const a = [], b = [], s = [];
    for (let i = 0; i <= N; i++) {
      const x = i / N * w, ph = i / N * cyc * 2 * Math.PI;
      a.push([x, h * 0.22 - Math.sin(ph) * h * 0.13]);
      b.push([x, h * 0.22 - Math.sin(ph * r) * h * 0.13]);
      s.push([x, h * 0.68 - (Math.sin(ph) + Math.sin(ph * r)) * h * 0.13]);
    }
    path(g, a, 'rgba(160,140,255,0.8)', 1.5); path(g, b, 'rgba(34,211,238,0.8)', 1.5); path(g, s, heat(0.75), 2.2);
    txt(g, 'las dos notas', 8, 12, 'left', SC.dim, 10); txt(g, 'juntas (lo que llega al oído)', 8, h * 0.44, 'left', SC.dim, 10);
    const msg = iv[3] ? 'proporción ' + iv[0] + ': el dibujo se repite cada ' + iv[4] + (iv[4] === 1 ? ' ciclo' : ' ciclos') + ' de la nota grave' : 'proporción irracional: el dibujo nunca se repite igual';
    txt(g, msg, w - 8, h - 10, 'right', SC.fg, 11);
  });
  return { inst: syn, name: 'Triángulo', draw: () => { drawLad(); pw.draw(); } };
});
function Router_cur() { return (F.Router && F.Router.cur) || ''; }

/* ======================================================= 4 · timbre: la mesa de armónicos */
const HPRE = {
  seno: { a: [1], ph: null, t: 'Seno' },
  sierra: { a: Array.from({ length: 16 }, (_, i) => 1 / (i + 1)), t: 'Sierra' },
  cuadrada: { a: Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 1 / (i + 1) : 0)), t: 'Cuadrada' },
  triangulo: { a: Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 1 / ((i + 1) * (i + 1)) : 0)), ph: Array.from({ length: 16 }, (_, i) => (i % 4 === 2 ? Math.PI : 0)), t: 'Triángulo' },
  organo: { a: [1, 0.8, 0.6, 0.5, 0, 0.35, 0, 0.3, 0, 0, 0, 0.2, 0, 0, 0, 0.15], t: 'Órgano' },
  hueca: { a: [1, 0, 0.55, 0, 0.4, 0, 0.3, 0, 0.22, 0, 0.18, 0, 0.14, 0, 0.1, 0], t: 'Solo impares suaves' }
};
Labs.def('timbre', root => {
  UI.head(root, 'La mesa de armónicos', 'Arrastra sobre las barras para dibujar la receta del sonido: cada barra es un seno, múltiplo exacto de la nota más grave. A la derecha ves la onda que resulta. Pulsa <b>Sonar</b> o toca el teclado.');
  const g2 = el('div', 'scr-2', root);
  const ed = UI.screen(g2, 220), wv = UI.screen(g2, 220);
  ed.cv.setAttribute('aria-label', 'Editor de 16 armónicos: arrastra para cambiar su volumen');
  wv.cv.setAttribute('aria-label', 'Un ciclo de la onda que forman los armónicos');
  ed.box.classList.add('edit');
  let amps = HPRE.sierra.a.slice(), phs = new Array(16).fill(0);
  const syn = new Synth({ osc: [{ w: 'sine' }], ae: { a: 0.02, d: 0.3, s: 0.9, r: 0.3 }, gain: 0.3 });
  let waveDirty = true, on = false;
  const rebuild = () => { if (!A.ctx) { waveDirty = true; return; } const a = amps.slice(); if (a.every(x => x < 0.001)) a[0] = 0.001; syn.set({ osc: [{ w: pwHarm(a, phs) }] }); waveDirty = false; pe.mark(); pv.mark(); };
  const base = 45;
  const pe = F.painter(ed.cv, (g, w, h) => {
    const bw = w / 16;
    for (let i = 0; i < 16; i++) {
      const v = amps[i], x = i * bw, bh = v * (h - 46);
      g.fillStyle = 'rgba(237,233,246,0.05)'; g.fillRect(x + 3, 10, bw - 6, h - 46);
      g.fillStyle = heat(0.15 + v * 0.8); g.fillRect(x + 3, h - 36 - bh, bw - 6, bh);
      txt(g, String(i + 1), x + bw / 2, h - 24, 'center', SC.fg, 11);
      const mm = base + 12 * Math.log2(i + 1), nm = Math.round(mm), cents = Math.round((mm - nm) * 100);
      if (bw > 30 || i % 2 === 0) txt(g, nameEn(nm) + (Math.abs(cents) > 10 ? (cents > 0 ? '+' : '') + cents : ''), x + bw / 2, h - 10, 'center', SC.dim, 9);
    }
  });
  const pv = F.painter(wv.cv, (g, w, h) => {
    grid(g, w, h, 4, 4);
    const N = 400, c = new Float32Array(N); let mx = 0;
    for (let i = 0; i < N; i++) { let s = 0; for (let n = 0; n < 16; n++) if (amps[n]) s += amps[n] * Math.sin(2 * Math.PI * (n + 1) * i / N + phs[n]); c[i] = s; mx = Math.max(mx, Math.abs(s)); }
    for (let i = 0; i < N; i++) c[i] /= (mx || 1);
    F.drawCycle(g, w, h, c, heat(0.74), 2.2, 2, 0.4);
    txt(g, 'dos ciclos de la onda resultante', 8, 12, 'left', SC.dim, 10);
  });
  let drag = false;
  const setAt = e => {
    const r = ed.cv.getBoundingClientRect(), i = clamp(Math.floor((e.clientX - r.left) / r.width * 16), 0, 15);
    const v = clamp(1 - (e.clientY - r.top - 10) / (r.height - 46), 0, 1);
    amps[i] = v < 0.03 ? 0 : v; pe.mark(); pv.mark(); waveDirty = true;
  };
  ed.cv.addEventListener('pointerdown', e => { drag = true; ed.cv.setPointerCapture(e.pointerId); setAt(e); e.preventDefault(); });
  ed.cv.addEventListener('pointermove', e => { if (drag) setAt(e); });
  ed.cv.addEventListener('pointerup', () => { drag = false; });
  ed.cv.style.touchAction = 'none';
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'tim-play', text: 'Sonar', on: v => { on = v; A.ensure(); if (waveDirty) rebuild(); if (v) syn.noteOn(base); else syn.noteOff(base); } });
  Object.keys(HPRE).forEach(k => UI.btn(row, { text: HPRE[k].t, on: () => { amps = new Array(16).fill(0).map((_, i) => HPRE[k].a[i] || 0); phs = HPRE[k].ph ? HPRE[k].ph.slice() : new Array(16).fill(0); waveDirty = true; pe.mark(); pv.mark(); } }));
  UI.btn(row, { text: 'Mezclar fases', icon: 'dice', cls: 'bt-v', on: () => { phs = phs.map(() => Math.random() * Math.PI * 2); waveDirty = true; pv.mark(); } });
  UI.note(root, '<b>Mezclar fases</b> cambia la forma del dibujo pero el oído casi no nota la diferencia: el timbre depende sobre todo de <em>cuánto</em> hay de cada armónico, no de cómo se alinean.');
  const origOn = syn.noteOn.bind(syn);
  syn.noteOn = (m, v) => { if (waveDirty) rebuild(); return origOn(m, v); };
  return { inst: syn, name: 'Mesa de armónicos', draw: () => { if (waveDirty && A.ctx && (on || syn.vs.size)) rebuild(); pe.draw(); pv.draw(); }, hide: () => { if (on) play.set(false, true); } };
});

/* ======================================================= 5 · las formas de onda */
const WAVES = [['sine', 'SIN', 'Seno'], ['triangle', 'TRI', 'Triángulo'], ['square', 'SQR', 'Cuadrada'], ['pulse', 'PLS', 'Pulso'], ['sawtooth', 'SAW', 'Sierra'], ['noise', 'NOISE', 'Ruido']];
function harmOf(kind, n, duty) {
  if (kind === 'sine') return n === 1 ? 1 : 0;
  if (kind === 'triangle') return n % 2 ? 1 / (n * n) : 0;
  if (kind === 'square') return n % 2 ? 1 / n : 0;
  if (kind === 'pulse') return Math.abs(Math.sin(Math.PI * n * duty)) / n * 2 / Math.PI * 1.57;
  if (kind === 'sawtooth') return 1 / n;
  return 0;
}
Labs.def('ondas', root => {
  UI.head(root, 'Seis formas de onda', 'Elige una forma y escúchala. El osciloscopio muestra su dibujo; el espectro, su receta de armónicos. Con <b>Pulso</b>, mueve el ancho o activa el PWM automático.');
  const gal = el('div', 'gal', root);
  const minis = WAVES.map(([k, s, t]) => {
    const b = el('button', 'gal-i', gal); b.type = 'button'; b.dataset.k = k; b.setAttribute('aria-label', t);
    const cv = el('canvas', '', b); el('span', '', b, '<b>' + s + '</b> ' + t);
    b.addEventListener('click', () => sel.set(k, true));
    return { k, b, cv };
  });
  const g2 = el('div', 'scr-2', root);
  const sc = UI.screen(g2, 170), sp = UI.screen(g2, 170);
  sc.cv.setAttribute('aria-label', 'Osciloscopio'); sp.cv.setAttribute('aria-label', 'Espectro de armónicos');
  const syn = new Synth({ osc: [{ w: 'sawtooth' }], ae: { a: 0.01, d: 0.3, s: 0.85, r: 0.25 }, gain: 0.26 });
  let kind = 'sawtooth', duty = 0.25, pwm = false, ncol = 'white', on = false, pwT = 0;
  const pulseCache = new Map();
  const pulseW = d => { const q = Math.round(d * 100); if (!pulseCache.has(q)) pulseCache.set(q, pwCycle(cycle('pulse', 1024, q / 100), 128)); return pulseCache.get(q); };
  const nb = {};
  const apply = () => {
    if (!A.ensure()) return;
    if (kind === 'noise') { nb[ncol] = nb[ncol] || F.noiseBuf(ncol); syn.set({ osc: [{ w: 'sine', lv: 0 }], noise: 0.9, nbuf: nb[ncol] }); }
    else syn.set({ osc: [{ w: kind === 'pulse' ? pulseW(duty) : kind, lv: 1 }], noise: 0 });
    minis.forEach(m => m.b.setAttribute('aria-pressed', m.k === kind ? 'true' : 'false'));
  };
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'ond-play', text: 'Sonar', on: v => { on = v; apply(); if (v) syn.noteOn(57); else syn.noteOff(57); } });
  const sel = UI.seg(row, { id: 'ond-w', label: 'Forma', value: kind, wide: true, opts: WAVES.map(w => [w[0], w[1]]), on: v => { kind = v; nr.wrap.hidden = v !== 'noise'; dk.wrap.hidden = v !== 'pulse'; pt.b.hidden = v !== 'pulse'; if (v !== 'pulse' && pwm) pt.set(false, true); apply(); } });
  const dk = UI.knob(row, { id: 'ond-duty', label: 'Ancho de pulso', min: 0.05, max: 0.95, value: duty, fmt: fPct, on: v => { duty = v; if (kind === 'pulse') apply(); } });
  const pt = UI.tog(row, { id: 'ond-pwm', text: 'PWM automático', icon: 'wave', off: 'PWM activo', cls: 'tg-s', on: v => { pwm = v; } });
  const nr = UI.seg(row, { id: 'ond-n', label: 'Color del ruido', value: 'white', opts: [['white', 'Blanco'], ['pink', 'Rosa'], ['brown', 'Marrón']], on: v => { ncol = v; apply(); } });
  nr.wrap.hidden = true; dk.wrap.hidden = true; pt.b.hidden = true;
  minis.forEach(m => m.b.setAttribute('aria-pressed', m.k === kind ? 'true' : 'false'));
  const pMinis = minis.map(m => F.painter(m.cv, (g, w, h) => {
    const N = 256, c = m.k === 'noise' ? Float32Array.from({ length: N }, () => Math.random() * 2 - 1) : cycle(m.k === 'pulse' ? 'pulse' : m.k, N, 0.25);
    F.drawCycle(g, w, h * 0.62, c, heat(0.72), 1.6, 2, 0.36);
    for (let n = 1; n <= 12; n++) {
      const a = m.k === 'noise' ? 0.35 + 0.3 * Math.random() : harmOf(m.k, n, 0.25), bw = w / 13;
      g.fillStyle = heat(0.2 + a * 0.75); g.fillRect(n * bw - bw * 0.3, h - 4 - a * h * 0.32, bw * 0.6, a * h * 0.32);
    }
  }));
  const drawSc = live(sc.cv, (g, w, h) => scope(g, w, h, { ms: 10 }));
  const drawSp = live(sp.cv, (g, w, h) => spectrum(g, w, h, kind === 'noise' ? {} : { lin: true, fmax: 4400, marks: [1000, 2000, 3000, 4000] }));
  return {
    inst: syn, name: 'Formas de onda',
    draw: () => {
      if (pwm && kind === 'pulse' && A.ctx) { pwT += 1 / 60; const d = 0.5 + 0.4 * Math.sin(pwT * 2 * Math.PI * 0.35); if (Math.abs(d - duty) > 0.008) { duty = d; dk.set(Math.round(d * 100) / 100, false); apply(); } }
      pMinis.forEach(p => p.draw()); drawSc(); drawSp();
    },
    hide: () => { if (on) play.set(false, true); }
  };
});

/* ======================================================= 6 · el mapa de cualquier sintetizador */
const STAGES = {
  osc: ['Oscilador', 'La fuente: crea una onda rica en armónicos con la altura de la nota.', 'EDIT › SOUND (EDIT 1 y EDIT 2): el motor de la pista.'],
  flt: ['Filtro', 'Quita o resalta frecuencias. Aquí, un paso bajo que se abre con cada nota.', 'EDIT › TONE › FILTER: TYPE, CUT, RES, DRIVE.'],
  amp: ['Amplificador + envolvente', 'Da forma al volumen de cada nota: cómo empieza, se sostiene y se apaga.', 'ENV › ENV: ATK, DEC, SUS, REL.'],
  lfo: ['LFO', 'Una oscilación lenta que mueve otro parámetro solo. Aquí mueve el filtro.', 'LFO › LFO y LFO › LFO DEST.'],
  fx: ['Efectos', 'Espacio y color al final de la cadena: aquí, delay y reverb.', 'FX: SENDS, DELAY, REVERB…']
};
Labs.def('mapa', root => {
  UI.head(root, 'Arma la cadena', 'Pulsa <b>Reproducir</b> y enciende o apaga cada bloque. Escucha cómo cada etapa cambia el mismo riff. Toca un bloque para leer qué hace y dónde está en tu FM-1.');
  const fx = new FX({ dly: 0.22, time: 0.375, fb: 0.35, rev: 0.3, size: 2.4 });
  const syn = new Synth({ osc: [{ w: 'sawtooth' }], gain: 0.24 });
  const st = { flt: true, amp: true, lfo: false, fx: true };
  const apply = () => {
    syn.set({
      f: st.flt ? { type: 'lowpass', cut: 500, q: 8, env: 2.6, kt: 0.5 } : { type: 'lowpass', cut: 20000, q: 0, env: 0, kt: 0 },
      ae: st.amp ? { a: 0.004, d: 0.28, s: 0.25, r: 0.2 } : { a: 0.003, d: 0.01, s: 1, r: 0.02 },
      fe: { a: 0.003, d: 0.25, s: 0.1, r: 0.2 },
      lfo: { rate: 0.35, w: 'sine', cut: st.lfo ? 1.4 : 0, pitch: 0 }
    });
    fx.set({ dly: st.fx ? 0.22 : 0, rev: st.fx ? 0.3 : 0 });
    Object.keys(blocks).forEach(k => blocks[k].classList.toggle('off', k in st && !st[k]));
  };
  const dia = el('div', 'chain', root);
  const blocks = {};
  const info = el('div', 'chain-i', root);
  const showInfo = k => { const s = STAGES[k]; info.innerHTML = '<b>' + s[0] + '.</b> ' + s[1] + ' <span class="path">' + s[2] + '</span>'; };
  ['kbd', 'osc', 'flt', 'amp', 'fx', 'out'].forEach((k, i) => {
    if (i) el('span', 'chain-a', dia, '<svg viewBox="0 0 24 12" aria-hidden="true"><path d="M0 6h20m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>');
    const lbl = { kbd: 'Teclado', osc: 'OSC', flt: 'FILTRO', amp: 'AMP', fx: 'FX', out: 'Salida' }[k];
    const b = el(k === 'kbd' || k === 'out' ? 'span' : 'button', 'chain-b ' + k, dia, '<b>' + lbl + '</b>');
    if (b.tagName === 'BUTTON') {
      b.type = 'button';
      b.addEventListener('click', () => { if (k in st) { st[k] = !st[k]; apply(); } showInfo(k); });
    }
    blocks[k] = b;
  });
  const mod = el('div', 'chain-m', root);
  const lb = el('button', 'chain-b lfo', mod, '<b>LFO</b><small>mueve el filtro</small>'); lb.type = 'button';
  lb.addEventListener('click', () => { st.lfo = !st.lfo; apply(); showInfo('lfo'); });
  blocks.lfo = lb;
  el('span', 'chain-e', mod, '<b>ENV</b><small>da forma a FILTRO y AMP</small>');
  showInfo('osc');
  const seq = [45, 57, 52, 57, 48, 60, 55, 60, 43, 55, 50, 55, 47, 59, 52, 59];
  const pl = new Player();
  const row = UI.row(root);
  let routed = false;
  const ensureFx = () => { if (!routed && A.ensure()) { syn.route(fx.input); routed = true; apply(); } };
  const play = UI.tog(row, { id: 'map-play', text: 'Reproducir', on: v => { if (v) { ensureFx(); pl.start((i, t, sd) => syn.play(seq[i], 0.85, t, sd * 0.8), 60 / 112 / 2, seq.length); } else pl.stop(); } });
  UI.note(root, 'El oscilador no se puede apagar: sin fuente no hay sonido. Prueba a dejar solo el oscilador (todo lo demás apagado): suena como un zumbido plano. Cada bloque que enciendes le da vida.');
  apply();
  const sc = UI.screen(root, 120);
  const drawSc = live(sc.cv, (g, w, h) => scope(g, w, h, { ms: 14, msg: 'Pulsa Reproducir' }));
  const origOn = syn.noteOn.bind(syn);
  syn.noteOn = (m, v) => { ensureFx(); return origOn(m, v); };
  return { inst: syn, name: 'Cadena completa', draw: drawSc, hide: () => { if (play.get()) play.set(false, true); } };
});

/* ======================================================= 7 · osciladores (como ANALOG) */
const AWAVES = ['SAW', 'SQR', 'TRI', 'SIN', 'PWM', 'SYNC', 'RING', 'SAW3'];
function syncCycle(ratio, N = 1024) { const c = new Float32Array(N); for (let i = 0; i < N; i++) { const x = (i / N * ratio) % 1; c[i] = 2 * x - 1; } return c; }
Labs.def('oscilador', root => {
  UI.head(root, 'Dos osciladores', 'Como el motor ANALOG del FM-1: elige WAVE y juega con DETUNE, MIX, INT y NOISE. Arriba ves los dos osciladores por separado en cámara lenta; abajo, lo que suena.');
  const g2 = el('div', 'scr-2', root);
  const sl = UI.screen(g2, 170), sc = UI.screen(g2, 170);
  const sp = UI.screen(root, 120);
  sl.cv.setAttribute('aria-label', 'Los dos osciladores y su suma, en cámara lenta');
  const syn = new Synth({ osc: [{ w: 'sawtooth' }, { w: 'sawtooth' }], ae: { a: 0.01, d: 0.3, s: 0.9, r: 0.3 }, gain: 0.22 });
  let wave = 'SAW', det = 12, mix = 0.5, noise = 0, int = 0, ratio = 2.5, on = false, pwmT = 0;
  const syncCache = new Map(), pulseCache = new Map();
  const syncW = r => { const q = Math.round(r * 20) / 20; if (!syncCache.has(q)) syncCache.set(q, pwCycle(syncCycle(q), 128)); return syncCache.get(q); };
  const pulseW = d => { const q = Math.round(d * 50); if (!pulseCache.has(q)) pulseCache.set(q, pwCycle(cycle('pulse', 1024, q / 50), 128)); return pulseCache.get(q); };
  const typ = { SAW: 'sawtooth', SQR: 'square', TRI: 'triangle', SIN: 'sine' };
  let duty = 0.5;
  const apply = () => {
    const ext = wave === 'SYNC' || wave === 'RING';
    dt.wrap.hidden = ext; dr.wrap.hidden = !ext;
    if (!A.ctx) return;
    let o, ring = false;
    if (typ[wave]) o = [{ w: typ[wave], lv: 1 - mix, det: -det / 2 }, { w: typ[wave], lv: mix, det: det / 2, semi: int }];
    else if (wave === 'PWM') o = [{ w: pulseW(duty), lv: 1 - mix, det: -det / 2 }, { w: pulseW(duty), lv: mix, det: det / 2, semi: int }];
    else if (wave === 'SYNC') o = [{ w: 'sawtooth', lv: 1 - mix }, { w: syncW(ratio), lv: mix, semi: int }];
    else if (wave === 'RING') { o = [{ w: 'sawtooth', lv: 1 }, { w: 'sine', lv: 1, semi: 12 * Math.log2(ratio) }]; ring = true; }
    else o = [{ w: 'sawtooth', lv: 0.6 }, { w: 'sawtooth', lv: 0.6, det: det, semi: int }, { w: 'sawtooth', lv: 0.6, det: -det }];
    const needRebuild = ring !== syn.p.ring || o.length !== syn.p.osc.length;
    if (needRebuild && on) syn.noteOff(57);
    syn.set({ osc: o, ring, noise: noise * 0.6 });
    if (needRebuild && on) syn.noteOn(57);
    rd.innerHTML = typ[wave] || wave === 'PWM' || wave === 'SAW3'
      ? '<span><i>Batido a La3 (220 Hz)</i><b>' + dec(220 * (Math.pow(2, det / 2400) - Math.pow(2, -det / 2400)) * (wave === 'SAW3' ? 2 : 1), 2) + ' veces por segundo</b></span><span><i>Oscilador 2</i><b>' + (int ? (int > 0 ? '+' : '') + int + ' semitonos' : 'misma nota') + '</b></span>'
      : '<span><i>Relación</i><b>× ' + dec(ratio, 2) + '</b></span><span><i>' + (wave === 'SYNC' ? 'El esclavo se reinicia' : 'Aparecen') + '</i><b>' + (wave === 'SYNC' ? 'en cada ciclo del maestro' : 'suma y resta de frecuencias') + '</b></span>';
  };
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'osc-play', text: 'Sonar', on: v => { on = v; A.ensure(); apply(); if (v) syn.noteOn(57); else syn.noteOff(57); } });
  UI.seg(row, { id: 'osc-w', label: 'WAVE', value: wave, wide: true, opts: AWAVES.map(w => [w, w]), on: v => { wave = v; apply(); } });
  const dt = UI.knob(row, { id: 'osc-det', label: 'DETUNE', min: 0, max: 50, step: 0.5, value: det, fmt: v => dec(v, 1) + ' cents', on: v => { det = v; apply(); } });
  const dr = UI.knob(row, { id: 'osc-ratio', label: 'DETUNE · relación', min: 1, max: 8.9, step: 0.05, value: ratio, fmt: v => '× ' + dec(v, 2), on: v => { ratio = v; apply(); } });
  UI.knob(row, { id: 'osc-mix', label: 'MIX', min: 0, max: 1, value: mix, fmt: v => v < 0.05 ? 'solo osc 1' : v > 0.95 ? 'solo osc 2' : Math.round((1 - v) * 100) + ' / ' + Math.round(v * 100), on: v => { mix = v; apply(); } });
  UI.knob(row, { id: 'osc-int', label: 'INT', min: -24, max: 24, step: 1, value: int, fmt: v => (v > 0 ? '+' : '') + v + ' st', on: v => { int = v; apply(); } });
  UI.knob(row, { id: 'osc-noise', label: 'NOISE', min: 0, max: 1, value: noise, fmt: fPct, on: v => { noise = v; apply(); } });
  const rd = UI.read(root);
  const origOn = syn.noteOn.bind(syn);
  syn.noteOn = (m, v) => { const r = origOn(m, v); apply(); return r; };
  apply();
  let ph = 0, lt = 0;
  const drawSl = live(sl.cv, (g, w, h) => {
    grid(g, w, h, 8, 4);
    const now = performance.now() / 1000, dtm = Math.min(0.05, now - (lt || now)); lt = now;
    const beat = typ[wave] || wave === 'PWM' || wave === 'SAW3' ? 220 * (Math.pow(2, det / 2400) - Math.pow(2, -det / 2400)) : 0;
    if (!RM) ph += dtm * Math.min(beat, 6) * 0.5;
    const shape = typ[wave] ? typ[wave] : wave === 'PWM' ? 'pulse' : 'sawtooth';
    const r2 = Math.pow(2, int / 12) * (wave === 'SYNC' ? 1 : 1);
    const N = 600, a = [], b = [], s = [];
    for (let i = 0; i <= N; i++) {
      const x = i / N * 3;
      const v1 = sampleW(shape, x, duty);
      let v2 = wave === 'SYNC' ? (2 * ((x % 1) * ratio % 1) - 1) : wave === 'RING' ? Math.sin(2 * Math.PI * x * ratio) : sampleW(shape, x * r2 + ph, duty);
      const out = wave === 'RING' ? v1 * v2 : (1 - mix) * v1 + mix * v2;
      a.push([i / N * w, h * 0.2 - v1 * h * 0.11]); b.push([i / N * w, h * 0.45 - v2 * h * 0.11]); s.push([i / N * w, h * 0.76 - out * h * 0.16]);
    }
    path(g, a, 'rgba(160,140,255,0.85)', 1.4); path(g, b, 'rgba(34,211,238,0.85)', 1.4); path(g, s, heat(0.74), 2);
    txt(g, 'osc 1', 6, 10, 'left', SC.vio, 10); txt(g, wave === 'RING' ? 'seno × ' + dec(ratio, 2) : wave === 'SYNC' ? 'osc 2 (esclavo)' : 'osc 2', 6, h * 0.33, 'left', '#22d3ee', 10);
    txt(g, wave === 'RING' ? 'producto' : 'mezcla', 6, h * 0.58, 'left', SC.fg, 10);
  });
  const drawSc = live(sc.cv, (g, w, h) => scope(g, w, h, { ms: 14 }));
  const drawSp = live(sp.cv, (g, w, h) => spectrum(g, w, h, { lin: true, fmax: 5000, marks: [1000, 2000, 3000, 4000] }));
  return {
    inst: syn, name: 'Dos osciladores',
    draw: () => {
      if (wave === 'PWM' && A.ctx) { pwmT += 1 / 60; const d = 0.5 + 0.38 * Math.sin(pwmT * 2 * Math.PI * 0.6); if (Math.abs(d - duty) > 0.02) { duty = d; apply(); } }
      drawSl(); drawSc(); drawSp();
    },
    hide: () => { if (on) play.set(false, true); }
  };
});
function sampleW(kind, x, duty) {
  const p = ((x % 1) + 1) % 1;
  if (kind === 'sine') return Math.sin(2 * Math.PI * p);
  if (kind === 'triangle') return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
  if (kind === 'square') return p < 0.5 ? 1 : -1;
  if (kind === 'pulse') return p < (duty || 0.5) ? 1 : -1;
  return p < 0.5 ? 2 * p : 2 * p - 2;
}
F.sampleW = sampleW;

/* ======================================================= 8 · el filtro */
Labs.def('filtro', root => {
  UI.head(root, 'Esculpe con el filtro', 'Pulsa <b>Sonar</b> y arrastra sobre el espectro: a los lados mueves el corte (CUT), arriba y abajo la resonancia (RES). La curva blanca es lo que deja pasar el filtro; las barras de colores, lo que realmente suena.');
  const sc = UI.screen(root, 250);
  sc.box.classList.add('edit');
  sc.cv.setAttribute('aria-label', 'Espectro con la curva del filtro. Arrastra para mover corte y resonancia');
  const syn = new Synth({ osc: [{ w: 'sawtooth' }], ae: { a: 0.01, d: 0.3, s: 0.9, r: 0.3 }, gain: 0.3 });
  let src = 'saw', type = 'lowpass', cut = 900, res = 0.3, drive = 0, on = false;
  let chain = null, ref = null;
  const build = () => {
    if (chain || !A.ensure()) return;
    const ctx = A.ctx;
    chain = { in: ctx.createGain(), ws: ctx.createWaveShaper(), pre: ctx.createGain(), bq: ctx.createBiquadFilter(), dl: ctx.createDelay(1), fb: ctx.createGain(), cin: ctx.createGain(), out: ctx.createGain(), dry: ctx.createGain(), wet: ctx.createGain() };
    const c = chain;
    c.ws.curve = F.distCurve('soft'); c.ws.oversample = '2x';
    c.in.connect(c.dry); c.in.connect(c.pre); c.pre.connect(c.ws); c.ws.connect(c.wet);
    c.dry.connect(c.bq); c.wet.connect(c.bq); c.dry.connect(c.cin); c.wet.connect(c.cin);
    c.cin.connect(c.dl); c.dl.connect(c.fb); c.fb.connect(c.dl); c.dl.connect(c.out); c.cin.connect(c.out);
    c.bq.connect(c.out); c.out.connect(A.bus);
    syn.route(c.in);
    ref = ctx.createBiquadFilter();
  };
  const fr = new Float32Array(240), mag = new Float32Array(240), phs = new Float32Array(240);
  for (let i = 0; i < 240; i++) fr[i] = 30 * Math.pow(16000 / 30, i / 239);
  const apply = (init) => {
    const comb = type === 'comb', cf = clamp(cut, 40, 330);
    rd.innerHTML = '<span><i>Tipo</i><b>' + ({ lowpass: 'LP · paso bajo', highpass: 'HP · paso alto', bandpass: 'BP · paso banda', notch: 'Notch · banda eliminada', comb: 'COMB · peine' })[type] + '</b></span><span><i>CUT</i><b>' + fHz(comb ? cf : cut) + '</b></span><span><i>RES</i><b>' + fPct(res) + '</b></span>';
    if (cutK) cutK.set(cut, false);
    if (resK) resK.set(res, false);
    if (!init) build();
    if (!chain) return;
    const c = chain, t = A.t;
    const q = type === 'lowpass' || type === 'highpass' ? res * 26 : 0.4 + res * 22;
    c.bq.type = comb ? 'allpass' : type; ref.type = comb ? 'allpass' : type;
    c.bq.frequency.setTargetAtTime(cut, t, 0.01); ref.frequency.value = cut;
    c.bq.Q.setTargetAtTime(q, t, 0.01); ref.Q.value = q;
    c.bq.gain.value = 0;
    c.out.gain.value = 1;
    c.bq.disconnect(); if (!comb) c.bq.connect(c.out);
    c.cin.disconnect(); if (comb) { c.cin.connect(c.dl); }
    c.dl.delayTime.setTargetAtTime(1 / cf, t, 0.01); c.fb.gain.setTargetAtTime(comb ? 0.5 + res * 0.47 : 0, t, 0.01);
    c.dl.disconnect(); c.dl.connect(c.fb); if (comb) c.dl.connect(c.out);
    c.dry.gain.setTargetAtTime(drive > 0.01 ? 0 : 1, t, 0.01); c.wet.gain.setTargetAtTime(drive > 0.01 ? 0.7 / (1 + drive) : 0, t, 0.01); c.pre.gain.setTargetAtTime(1 + drive * 9, t, 0.01);
    syn.set({ osc: [{ w: src === 'sqr' ? 'square' : 'sawtooth', lv: src === 'noise' ? 0 : 1 }], noise: src === 'noise' ? 0.8 : 0 });
  };
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'flt-play', text: 'Sonar', on: v => { on = v; apply(); if (v) syn.noteOn(45); else syn.noteOff(45); } });
  UI.seg(row, { id: 'flt-src', label: 'Fuente', value: src, opts: [['saw', 'Sierra'], ['sqr', 'Cuadrada'], ['noise', 'Ruido']], on: v => { src = v; apply(); } });
  UI.seg(row, { id: 'flt-type', label: 'TYPE', value: type, wide: true, opts: [['lowpass', 'LP'], ['highpass', 'HP'], ['bandpass', 'BP'], ['notch', 'Notch'], ['comb', 'COMB']], on: v => { type = v; apply(); } });
  const cutK = UI.knob(row, { id: 'flt-cut', label: 'CUT', min: 40, max: 16000, log: true, value: cut, fmt: fHz, on: v => { cut = v; apply(); } });
  const resK = UI.knob(row, { id: 'flt-res', label: 'RES', min: 0, max: 1, value: res, fmt: fPct, on: v => { res = v; apply(); } });
  UI.knob(row, { id: 'flt-drv', label: 'DRIVE', min: 0, max: 1, value: drive, fmt: fPct, on: v => { drive = v; apply(); } });
  const rd = UI.read(root);
  let drag = false;
  const at = e => { const r = sc.cv.getBoundingClientRect(); cut = 30 * Math.pow(16000 / 30, clamp((e.clientX - r.left) / r.width, 0, 1)); res = clamp(1 - (e.clientY - r.top) / (r.height - 16), 0, 1); apply(); };
  sc.cv.style.touchAction = 'none';
  sc.cv.addEventListener('pointerdown', e => { drag = true; sc.cv.setPointerCapture(e.pointerId); if (!on) play.set(true, true); at(e); });
  sc.cv.addEventListener('pointermove', e => { if (drag) at(e); });
  sc.cv.addEventListener('pointerup', () => { drag = false; });
  const draw = live(sc.cv, (g, w, h) => {
    spectrum(g, w, h, { fmin: 30, fmax: 16000, msg: 'Pulsa Sonar y arrastra aquí' });
    if (!ref) return;
    const base = h - 16, pts = [];
    if (type === 'comb') {
      const cf = clamp(cut, 40, 360), gfb = 0.5 + res * 0.47;
      for (let i = 0; i < 240; i++) { const wv = 2 * Math.PI * fr[i] / cf, re = 1 - gfb * Math.cos(wv), im = gfb * Math.sin(wv); mag[i] = (1 - gfb) / Math.sqrt(re * re + im * im); }
    } else ref.getFrequencyResponse(fr, mag, phs);
    for (let i = 0; i < 240; i++) { const db = 20 * Math.log10(Math.max(1e-5, mag[i])); pts.push([i / 239 * w, base * 0.42 - db * base * 0.022]); }
    g.save(); g.beginPath(); g.rect(0, 0, w, base); g.clip();
    path(g, pts, 'rgba(245,242,250,0.95)', 2); g.restore();
    const cx = Math.log((type === 'comb' ? clamp(cut, 40, 360) : cut) / 30) / Math.log(16000 / 30) * w;
    g.fillStyle = SC.vio; g.beginPath(); g.arc(cx, (1 - res) * (base - 10) + 5, 6, 0, Math.PI * 2); g.fill();
    txt(g, '0 dB', 6, base * 0.42 - 8, 'left', SC.dim, 9);
  });
  apply(true);
  const origOn = syn.noteOn.bind(syn);
  syn.noteOn = (m, v) => { if (!chain) apply(); return origOn(m, v); };
  return { inst: syn, name: 'Sierra con filtro', draw, hide: () => { if (on) play.set(false, true); } };
});

/* ======================================================= 9 · envolventes */
const EPRE = {
  piano: ['Piano', { a: 0.005, d: 1.4, s: 0, r: 0.5 }, 0.8],
  organo: ['Órgano', { a: 0.004, d: 0.05, s: 1, r: 0.03 }, 0],
  pad: ['Pad', { a: 1.2, d: 1, s: 0.8, r: 2 }, 0.6],
  pluck: ['Pluck', { a: 0.002, d: 0.25, s: 0, r: 0.15 }, 2.5],
  bajo: ['Bajo «pew»', { a: 0.003, d: 0.35, s: 0.4, r: 0.12 }, 3.5],
  cuerda: ['Cuerda frotada', { a: 0.35, d: 0.4, s: 0.85, r: 0.6 }, 0.4]
};
Labs.def('envolvente', root => {
  UI.head(root, 'Dibuja el tiempo', 'Ajusta ATK, DEC, SUS y REL o elige un ejemplo, y toca el teclado. El punto naranja recorre la envolvente de la última nota. FILTRO decide cuánto abre la misma envolvente el filtro.');
  const sc = UI.screen(root, 210);
  sc.cv.setAttribute('aria-label', 'Gráfica de la envolvente ADSR con la posición de la nota actual');
  const syn = new Synth({ osc: [{ w: 'sawtooth' }], f: { cut: 700, q: 3, env: 0.8, kt: 0.4 }, ae: { a: 0.005, d: 1.4, s: 0, r: 0.5 }, fe: { a: 0.005, d: 1.4, s: 0, r: 0.5 }, gain: 0.3 });
  const E = Object.assign({}, syn.p.ae);
  let famt = 0.8;
  const apply = () => { syn.set({ ae: Object.assign({}, E), fe: Object.assign({}, E), f: { env: famt } }); };
  const row = UI.row(root);
  const ks = {};
  ks.a = UI.knob(row, { id: 'env-a', label: 'ATK', min: 0.002, max: 3, log: true, value: E.a, fmt: fS, on: v => { E.a = v; apply(); } });
  ks.d = UI.knob(row, { id: 'env-d', label: 'DEC', min: 0.02, max: 4, log: true, value: E.d, fmt: fS, on: v => { E.d = v; apply(); } });
  ks.s = UI.knob(row, { id: 'env-s', label: 'SUS', min: 0, max: 1, value: E.s, fmt: fPct, on: v => { E.s = v; apply(); } });
  ks.r = UI.knob(row, { id: 'env-r', label: 'REL', min: 0.02, max: 5, log: true, value: E.r, fmt: fS, on: v => { E.r = v; apply(); } });
  const fk = UI.knob(row, { id: 'env-f', label: 'ENV → FILTRO', min: 0, max: 4, value: famt, fmt: v => dec(v, 1) + ' oct', on: v => { famt = v; apply(); } });
  const row2 = UI.row(root, 'ctrls-1');
  Object.keys(EPRE).forEach(k => UI.btn(row2, { text: EPRE[k][0], on: () => { Object.assign(E, EPRE[k][1]); famt = EPRE[k][2]; ['a', 'd', 's', 'r'].forEach(x => ks[x].set(E[x], false)); fk.set(famt, false); apply(); } }));
  const pl = new Player();
  const rep = UI.tog(row2, { id: 'env-rep', text: 'Repetir nota', cls: 'tg-s', on: v => { if (v) pl.start((i, t) => syn.play(48, 0.85, t, 0.9), 2.2, 1); else pl.stop(); } });
  const draw = live(sc.cv, (g, w, h) => {
    grid(g, w, h, 8, 4);
    const pad = 14, H = h - 40, y0 = h - 24;
    const sw = 0.7, tot = E.a + E.d + sw + E.r, X = s => pad + (w - 2 * pad) * (s / tot);
    const pts = [];
    const steps = 140;
    for (let i = 0; i <= steps; i++) { const s = E.a * i / steps; pts.push([X(s), y0 - H * (s / E.a)]); }
    for (let i = 0; i <= steps; i++) { const s = E.d * i / steps; pts.push([X(E.a + s), y0 - H * (E.s + (1 - E.s) * Math.exp(-4 * s / E.d))]); }
    pts.push([X(E.a + E.d + sw), y0 - H * E.s]);
    const sl = E.s + (1 - E.s) * Math.exp(-4);
    for (let i = 0; i <= steps; i++) { const s = E.r * i / steps; pts.push([X(E.a + E.d + sw + s), y0 - H * sl * Math.exp(-5 * s / E.r)]); }
    g.fillStyle = 'rgba(160,140,255,0.12)'; g.beginPath(); g.moveTo(pts[0][0], y0); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(pts[pts.length - 1][0], y0); g.closePath(); g.fill();
    path(g, pts, heat(0.7), 2.2);
    const lab = [['A', E.a / 2], ['D', E.a + E.d / 2], ['S', E.a + E.d + sw / 2], ['R', E.a + E.d + sw + E.r / 2]];
    lab.forEach(([s, x]) => txt(g, s, X(x), h - 10, 'center', SC.fg, 12));
    txt(g, 'la tecla se suelta aquí', X(E.a + E.d + sw), 12, 'center', SC.dim, 10);
    g.strokeStyle = SC.axis; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(E.a + E.d + sw) + 0.5, 20); g.lineTo(X(E.a + E.d + sw) + 0.5, y0); g.stroke(); g.setLineDash([]);
    let v = null; for (const q of syn.vs) if (!v || q.t0 > v.t0) v = q;
    if (v && A.ctx) {
      const t = A.t, stg = v.ae.stage(t); if (!stg) return;
      let sx;
      if (stg.st === 'A') sx = stg.x;
      else if (stg.st === 'DS') sx = E.a + Math.min(stg.x, E.d + sw * 0.98);
      else { if (stg.x > E.r * 1.2) return; sx = E.a + E.d + sw + Math.min(stg.x, E.r); }
      const pk = (1 - syn.p.vel) + syn.p.vel * v.vel, val = v.ae.val(t) / (pk || 1);
      g.fillStyle = SC.ora; g.shadowColor = SC.ora; g.shadowBlur = 12; g.beginPath(); g.arc(X(sx), y0 - H * clamp(val, 0, 1), 6, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    }
  });
  return { inst: syn, name: 'Sierra con envolvente', draw, hide: () => { if (rep.get()) rep.set(false, true); } };
});

/* ======================================================= 10 · LFO y modulación */
const ROUTES = [
  ['vel', 'VEL', 'CUT', 'Velocidad → filtro: las notas fuertes suenan más brillantes.'],
  ['key', 'KEY', 'CUT', 'Tecla → filtro (keytracking): las notas agudas abren el filtro para que no suenen apagadas.'],
  ['rand', 'RAND', 'PAN', 'Azar → paneo: cada nota cae en un lugar distinto del estéreo.'],
  ['env', 'ENV', 'PITCH', 'Envolvente → tono: cada nota cae de altura, como un tom electrónico.'],
  ['m1', 'M1', 'CUT · RES · VIB', 'Una macro mueve varias cosas a la vez con una sola perilla.']
];
Labs.def('modulacion', root => {
  UI.head(root, 'La mano invisible', 'Un LFO es una perilla que gira sola. Elige su forma y velocidad y mándalo al tono, al filtro o al volumen. Las agujas muestran cuánto mueve cada destino ahora mismo.');
  const sc = UI.screen(root, 200);
  sc.cv.setAttribute('aria-label', 'Forma del LFO y tres agujas: tono, filtro y volumen');
  const syn = new Synth({ osc: [{ w: 'sawtooth' }, { w: 'sawtooth', det: 8 }], f: { cut: 1100, q: 6 }, ae: { a: 0.02, d: 0.3, s: 0.9, r: 0.4 }, lfo: { rate: 2, w: 'sine', pitch: 0, cut: 1.2, amp: 0 }, gain: 0.22 });
  const L = syn.p.lfo;
  let on = false;
  const row = UI.row(root);
  const play = UI.tog(row, { id: 'mod-play', text: 'Sonar', on: v => { on = v; if (v) syn.noteOn(50); else syn.noteOff(50); } });
  UI.knob(row, { id: 'mod-rate', label: 'RATE', min: 0.1, max: 20, log: true, value: L.rate, fmt: v => dec(v, v < 1 ? 2 : 1) + ' Hz', on: v => syn.set({ lfo: { rate: v } }) });
  UI.seg(row, { id: 'mod-wave', label: 'WAVE', value: 'sine', wide: true, opts: [['sine', 'SIN'], ['triangle', 'TRI'], ['sawtooth', 'SAW'], ['square', 'SQR'], ['sh', 'S&H']], on: v => syn.set({ lfo: { w: v } }) });
  UI.knob(row, { id: 'mod-p', label: 'DEST · PITCH', min: 0, max: 100, step: 1, value: 0, fmt: v => v + ' cents', on: v => syn.set({ lfo: { pitch: v } }) });
  UI.knob(row, { id: 'mod-c', label: 'DEST · FILTER', min: 0, max: 3, value: 1.2, fmt: v => dec(v, 1) + ' oct', on: v => syn.set({ lfo: { cut: v } }) });
  UI.knob(row, { id: 'mod-a', label: 'DEST · AMP', min: 0, max: 1, value: 0, fmt: fPct, on: v => syn.set({ lfo: { amp: v } }) });
  const hist = [];
  const draw = live(sc.cv, (g, w, h) => {
    grid(g, w, h, 8, 4);
    const t = A.ctx ? A.t : performance.now() / 1000;
    const lw = w * 0.56;
    if (syn.ok) { const v = syn.lfoValue(t); hist.push(v); if (hist.length > 240) hist.shift(); }
    const pts = hist.map((v, i) => [lw * i / 240, h / 2 - v * h * 0.36]);
    if (pts.length > 1) path(g, pts, heat(0.75), 2);
    const cur = hist.length ? hist[hist.length - 1] : 0;
    g.fillStyle = SC.ora; g.beginPath(); g.arc(lw * (hist.length - 1) / 240, h / 2 - cur * h * 0.36, 5, 0, Math.PI * 2); g.fill();
    txt(g, syn.ok ? 'el LFO, en tiempo real' : 'pulsa Sonar', 8, 12, 'left', SC.dim, 10);
    const gauges = [['PITCH', cur * L.pitch / 100], ['FILTER', cur * L.cut / 3], ['AMP', -Math.abs(cur) * L.amp]];
    gauges.forEach(([n, v], i) => {
      const cx = lw + 20 + (w - lw - 20) * (i + 0.5) / 3, cy = h * 0.58, r = Math.min(34, (w - lw) / 7);
      g.strokeStyle = SC.axis; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
      const a = Math.PI * 1.5 + clamp(v, -1, 1) * Math.PI * 0.75;
      g.strokeStyle = heat(0.5 + Math.abs(v) * 0.45); g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r, Math.PI * 1.5, a, v < 0); g.stroke();
      g.strokeStyle = SC.fg; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); g.stroke();
      txt(g, n, cx, cy + r + 14, 'center', SC.fg, 10);
    });
  });
  /* rutas de ejemplo de la matriz */
  el('h4', 'lab-sub', root, 'Rutas de la matriz: fuente → destino');
  const mx = el('div', 'mx', root);
  const ex = new Synth({ osc: [{ w: 'sawtooth' }], f: { cut: 600, q: 5 }, ae: { a: 0.005, d: 0.35, s: 0.3, r: 0.25 }, gain: 0.26 });
  const pl = new Player();
  const mxText = UI.note(root, 'Pulsa una ruta para escucharla.');
  ROUTES.forEach(([k, s, d, txt2]) => {
    const b = el('button', 'mx-r', mx, '<b>' + s + '</b><svg viewBox="0 0 40 10" aria-hidden="true"><path d="M0 5h34m-5-4 5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><b>' + d + '</b>'); b.type = 'button';
    b.addEventListener('click', () => {
      A.ensure(); [...mx.children].forEach(c => c.setAttribute('aria-pressed', c === b ? 'true' : 'false'));
      mxText.innerHTML = txt2;
      ex.set({ f: { cut: 600, q: 5, env: 0, kt: 0, vel: 0 }, vel: 0.3, rpan: 0, pe: { amt: 0 }, lfo: { pitch: 0, cut: 0 }, spread: 0, uni: 1 });
      let notes, vels = null;
      if (k === 'vel') { ex.set({ f: { env: 3, vel: 1 }, fe: { a: 0.003, d: 0.3, s: 0, r: 0.2 }, vel: 0.6 }); notes = [48, 48, 48, 48, 48, 48, 48, 48]; vels = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1, 0.2]; }
      else if (k === 'key') { notes = [36, 43, 48, 55, 60, 67, 72, 79, 36, 43, 48, 55, 60, 67, 72, 79]; }
      else if (k === 'rand') { ex.set({ rpan: 1, f: { cut: 2400 } }); notes = [60, 64, 67, 72, 67, 64, 60, 55]; }
      else if (k === 'env') { ex.set({ pe: { amt: 14, d: 0.25 }, f: { cut: 2000 } }); notes = [45, 45, 52, 45, 45, 50, 43, 45]; }
      else { notes = [48, 55, 60, 63, 48, 55, 60, 63, 48, 55, 60, 63, 48, 55, 60, 63]; }
      ex.p.uni = k === 'm1' ? 3 : 1;
      pl.start((i, t, sd) => {
        if (k === 'key') ex.set({ f: { kt: i < 8 ? 0 : 1 } });
        if (k === 'm1') { const m = i / 15; ex.set({ f: { cut: 300 + 4000 * m, q: 8 - 6 * m }, spread: 30 * m, lfo: { pitch: 18 * m, rate: 5 } }); }
        ex.play(notes[i], vels ? vels[i] : 0.8, t, sd * 0.85);
      }, 0.24, notes.length, false);
      pl.onEnd = () => [...mx.children].forEach(c => c.setAttribute('aria-pressed', 'false'));
      if (k === 'key') mxText.innerHTML = txt2 + ' Primero suena sin keytracking (las agudas se apagan), después con él.';
    });
  });
  return { inst: syn, name: 'LFO en acción', draw, hide: () => { if (on) play.set(false, true); pl.stop(); } };
});

/* ======================================================= 11 · voces, mono y glide */
Labs.def('voces', root => {
  UI.head(root, 'Cuántas notas y cómo se unen', 'Elige el modo y toca varias notas a la vez, o pulsa <b>Frase</b>. Las celdas son las voces que se están usando; el rastro muestra la altura de cada nota en el tiempo, con el deslizamiento del GLIDE.');
  const sc = UI.screen(root, 210);
  sc.cv.setAttribute('aria-label', 'Voces activas y altura de las notas en el tiempo');
  const syn = new Synth({ osc: [{ w: 'sawtooth' }], f: { cut: 2200, q: 2, kt: 0.5 }, ae: { a: 0.01, d: 0.4, s: 0.7, r: 0.3 }, gain: 0.24, poly: 8 });
  let mode = 'poly';
  const row = UI.row(root);
  UI.seg(row, { id: 'voc-mode', label: 'VOICE', value: 'poly', wide: true, opts: [['poly', 'POLY'], ['mono', 'MONO'], ['legato', 'LEG'], ['uni', 'UNI']], on: v => { syn.allOff(); mode = v; syn.set({ mode: v === 'uni' ? 'mono' : v, uni: v === 'uni' ? uk.get() : 1, spread: v === 'uni' ? sk.get() : 0 }); } });
  UI.knob(row, { id: 'voc-glide', label: 'GLIDE', min: 0, max: 1, value: 0, fmt: v => v < 0.005 ? 'sin glide' : fS(v), on: v => syn.set({ glide: v }) });
  UI.seg(row, { id: 'voc-prio', label: 'PRIO', value: 'last', opts: [['last', 'LAST'], ['low', 'LOW'], ['high', 'HIGH']], on: v => syn.set({ prio: v }) });
  const uk = UI.knob(row, { id: 'voc-uni', label: 'Voces en UNI', min: 1, max: 7, step: 1, value: 5, fmt: v => String(v), on: v => { if (mode === 'uni') syn.set({ uni: v }); } });
  const sk = UI.knob(row, { id: 'voc-det', label: 'DETUNE (UNI)', min: 0, max: 60, step: 1, value: 25, fmt: v => v + ' cents', on: v => { if (mode === 'uni') syn.set({ spread: v }); } });
  const phrase = [[0, 57, 0.9], [0.75, 60, 0.9], [1.5, 64, 0.9], [2.25, 62, 1.6], [3.75, 59, 0.6], [4.25, 57, 1.5]];
  UI.btn(row, { id: 'voc-phr', text: 'Frase', icon: 'play', on: () => {
    phrase.forEach(([s, m, d]) => {
      setTimeout(() => { syn.noteOn(m, 0.8); trace.push({ m, t: A.t, on: true }); }, s * 500);
      setTimeout(() => { syn.noteOff(m); trace.push({ m, t: A.t, on: false }); }, (s + d) * 500 + 60);
    });
  } });
  const trace = [];
  Dock.listen((m, down) => { if (Router_cur() === 'voces') trace.push({ m, t: A.t, on: down }); });
  const draw = live(sc.cv, (g, w, h) => {
    grid(g, w, h, 8, 4);
    const t = A.t, act = syn.ok ? syn.active() : [];
    const cells = 8, cw = Math.min(30, (w * 0.3) / cells);
    txt(g, 'voces en uso', 10, 12, 'left', SC.dim, 10);
    const used = mode === 'uni' ? Math.min(8, act.length * syn.p.uni) : act.length;
    for (let i = 0; i < cells; i++) { g.fillStyle = i < used ? heat(0.55 + i * 0.05) : 'rgba(237,233,246,0.08)'; g.fillRect(10 + i * (cw + 4), 24, cw, 18); }
    txt(g, mode === 'poly' ? 'POLY: una voz por nota' : mode === 'uni' ? 'UNI: varias voces desafinadas en una sola nota' : mode === 'mono' ? 'MONO: una voz; cada tecla la reinicia' : 'LEG: una voz; ligado no reinicia', 10 + cells * (cw + 4) + 8, 33, 'left', SC.fg, 11);
    const span = 5, X = tt => w - 10 - (t - tt) / span * (w - 20), Y = m => h - 18 - clamp((m - 45) / 40, 0, 1) * (h - 70);
    while (trace.length && t - trace[0].t > span + 3) trace.shift();
    if (mode === 'poly') {
      const open = {};
      trace.forEach(e => { if (e.on) open[e.m] = e.t; else if (open[e.m] != null) { path(g, [[X(open[e.m]), Y(e.m)], [X(e.t), Y(e.m)]], heat(0.7), 5); delete open[e.m]; } });
      Object.keys(open).forEach(m => path(g, [[X(open[m]), Y(+m)], [X(t), Y(+m)]], heat(0.85), 5));
    } else {
      const tau = Math.max(0.001, syn.p.glide / 3), held = [];
      let cur = null, tgt = null, tc = 0, segStart = null;
      const pts = [];
      const step = 1 / 120;
      let ei = 0;
      for (let tt = t - span; tt <= t; tt += step) {
        while (ei < trace.length && trace[ei].t <= tt) {
          const e = trace[ei++];
          if (e.on) { const i2 = held.indexOf(e.m); if (i2 >= 0) held.splice(i2, 1); held.push(e.m); } else { const i2 = held.indexOf(e.m); if (i2 >= 0) held.splice(i2, 1); }
          const pr = syn.p.prio, nt = held.length ? (pr === 'low' ? Math.min(...held) : pr === 'high' ? Math.max(...held) : held[held.length - 1]) : null;
          if (nt == null) { if (pts.length) { path(g, pts.slice(), heat(0.8), 3); pts.length = 0; } tgt = null; }
          else if (tgt == null) { cur = cur == null || syn.p.glide <= 0 ? nt : cur; tgt = nt; tc = e.t; segStart = tt; }
          else if (nt !== tgt) { tgt = nt; tc = e.t; }
        }
        if (tgt != null) { cur = tgt + (cur - tgt) * Math.exp(-step / tau); pts.push([X(tt), Y(cur)]); }
      }
      if (pts.length) path(g, pts, heat(0.8), 3);
      void tc; void segStart;
    }
    txt(g, '← últimos 5 segundos', w - 10, h - 8, 'right', SC.dim, 10);
  });
  return { inst: syn, name: 'Voces y glide', draw };
});
})();
