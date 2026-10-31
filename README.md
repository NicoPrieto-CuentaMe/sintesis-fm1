# Síntesis con tu FM-1

Curso interactivo e ilustrado de síntesis de sonido, del aire que vibra a la FM de seis operadores, pensado para el
M-VAVE FM-1 con el firmware JIANT FM.

Cada lección explica una idea con ilustraciones, la deja escuchar y ver en un laboratorio (osciloscopio y espectro con
la paleta térmica de JIANT, sonido sintetizado en el navegador con Web Audio, sin muestras) y la lleva al aparato: qué
botón, qué página y qué perilla, con el panel dibujado y una réplica de la pantalla.

**Abrir el curso:** https://nicoprieto-cuentame.github.io/sintesis-fm1/

## Lecciones

| #  | Lección                     | Laboratorio                                   | En el FM-1                     |
| -- | --------------------------- | --------------------------------------------- | ------------------------------ |
| 1  | Tu FM-1 con JIANT           | panel interactivo con las capas de teclas     | pistas, motores, seis reglas   |
| 2  | ¿Qué es el sonido?          | aire que vibra y osciloscopio                 | MASTER, MIXER, SPEAKER EQ      |
| 3  | Altura: de hercios a notas  | escalera de frecuencias e intervalos          | OCT, TUNE, PITCH, INT          |
| 4  | Timbre: los armónicos       | mesa de 16 armónicos                          | motor ADD, SCOPE               |
| 5  | Las formas de onda          | seis ondas con su espectro, PWM, ruidos       | WAVE, MORPH, NOISE             |
| 6  | El plano de cualquier sinte | arma la cadena bloque a bloque                | EDIT, ENV, LFO, FX             |
| 7  | Osciladores                 | dos osciladores: DETUNE, INT, SYNC, RING      | motor ANALOG                   |
| 8  | El filtro                   | espectro con la curva del filtro              | EDIT · TONE · FILTER           |
| 9  | Envolventes ADSR            | la envolvente con su punto en marcha          | ENV · ENV, ENV DEST            |
| 10 | LFO y modulación            | LFO con agujas y rutas de la matriz           | LFO, MOD, MSEQ, macros         |
| 11 | Voces, mono y glide         | voces en uso y rastro del glide               | EDIT · TONE · VOICE            |
| 12 | Síntesis FM                 | bandas laterales en vivo y algoritmos         | motor FM6                      |
| 13 | Distorsión de fase          | la fase doblada y su onda                     | motor PHASE                    |
| 14 | Aditiva                     | órgano de 9 drawbars y espectros que decaen   | motores WHEEL y ADD            |
| 15 | Modelado físico             | cuerda Karplus-Strong vista por dentro        | motores STRING y ANIMAL        |
| 16 | La voz y sus formantes      | carta de vocales del español                  | motor VOICE, letras en español |
| 17 | Bits, chips y ruido         | bits y muestreo, bytebeat                     | motores LOFI y NOISE           |
| 18 | Percusión                   | ocho pads y secuenciador de 16 pasos          | motor DRUM-X                   |
| 19 | Efectos y espacio           | distorsión, chorus, delay y reverb            | sección FX                     |
| 20 | Secuenciar y arpegiar       | secuenciador con escalas, locks y arpegiador  | SEQ, SCL, ARP                  |
| 21 | Diseño de sonido: recetas   | diez recetas para escuchar                    | presets y pasos de cada una    |
| 22 | Entrena tu oído             | juego de «¿qué cambió?»                       | los dados de JIANT             |
| 23 | Glosario y chuleta          |                                               | dónde está cada cosa           |

## Cómo se usa

- El botón **Activar sonido** de arriba enciende el audio; el navegador no deja sonar nada antes de un clic.
- Abajo están las 27 teclas del FM-1 (de F3 a G5). Se tocan con el ratón, con el dedo o con el teclado del ordenador,
  con el mismo mapa que el emulador de JIANT: `Z`…`/` las blancas, `S D F H J L ; '` las negras, `Q`…`O` las más
  agudas y `[` `]` para cambiar de octava.
- Mejor con auriculares: los altavoces pequeños casi no reproducen graves.
- El avance y las casillas marcadas se guardan en el navegador.

## Cómo está hecho

HTML, CSS y JavaScript sin dependencias ni paso de compilación; se sirve tal cual desde GitHub Pages.

- `js/core.js`: audio, envolventes, sintetizador sustractivo, efectos, osciloscopio y espectro, teclado, panel del
  FM-1, navegación y avance.
- `js/engines.js`: los motores de los laboratorios: FM de dos operadores, distorsión de fase, órgano de drawbars,
  aditiva, cuerda Karplus-Strong, formantes, chip y bytebeat, y batería.
- `js/labs-a.js` y `js/labs-b.js`: los laboratorios de cada lección.

Los sonidos del navegador son aproximaciones hechas con los mismos principios, no el sonido exacto del FM-1.

## Créditos

- El curso sigue **JIANT FM V10** (30 de octubre de 2026), el firmware libre de Juan Jiant para el M-VAVE FM-1
  (GPL-3.0), derivado de [Felucca](https://github.com/hugelton/Felucca) de Hügelton Instruments. Referencia:
  [manual en español](https://github.com/juanjiant-bit/JIANT/blob/main/docs/MANUAL.es.md),
  [manual interactivo](https://juanjiant-bit.github.io/JIANT/manual/) y
  [emulador](https://juanjiant-bit.github.io/JIANT/emu/).
- El dibujo del panel sigue las proporciones del manual interactivo de JIANT.
- Este curso no está afiliado a M-VAVE ni al proyecto JIANT. M-VAVE y FM-1 son marcas de sus dueños.
