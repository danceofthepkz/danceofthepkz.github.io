// Generates the pixel-art favicon set in src/assets/ from the 16x16 grid below.
// `node scripts/make-icons.mjs`
import { writeFileSync, mkdirSync } from 'node:fs';
import { encodePNG, upscale } from './png.mjs';

const OUT = new URL('../src/assets/', import.meta.url).pathname;

// The tower from the scene as a dusk silhouette. '.' = sky (colour depends on the row).
const GRID = [
  '.......r........',
  '.......a........',
  '.......a........',
  '.......a........',
  '......bpb.......',
  '......bbb.......',
  '.......a........',
  '......a.a.......',
  '.....bbbbb......',
  '....bbbbbpb.....',
  '....bbbbbbb.....',
  '.....bbbbb......',
  '.....a.a.a......',
  '....a..a..a.....',
  'gggggggggggggggg',
  'RRRRRRRRRRRRRRRR'
];
const SKY = ['#33294B', '#33294B', '#33294B', '#33294B', '#54405F', '#54405F', '#54405F', '#87596A', '#87596A', '#87596A', '#C38E6A', '#C38E6A', '#EDB98C', '#EDB98C', '#EDB98C', '#EDB98C'];
const PAL = { a: '#241D34', b: '#2E2541', p: '#FF96CD', r: '#FF6054', g: '#E0A87A', R: '#191426' };

const N = GRID.length;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const colorAt = (x, y) => PAL[GRID[y][x]] || SKY[y];

// SVG: one rect per horizontal run of equal colour.
let rects = '';
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N;) {
    const c = colorAt(x, y);
    let e = x + 1;
    while (e < N && colorAt(e, y) === c) e++;
    rects += `<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${c}"/>`;
    x = e;
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">${rects}</svg>\n`;

const px = new Uint8Array(N * N * 4);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const [r, g, b] = hex(colorAt(x, y));
  px.set([r, g, b, 255], (y * N + x) * 4);
}

// apple-touch-icon: 180px = 11x scale (176) + 2px border of night sky.
const big = upscale(N, N, px, 11);
const touch = new Uint8Array(180 * 180 * 4);
const [br, bg, bb] = hex('#1E1A33');
for (let i = 0; i < 180 * 180; i++) touch.set([br, bg, bb, 255], i * 4);
for (let y = 0; y < 176; y++) touch.set(big.subarray(y * 176 * 4, (y + 1) * 176 * 4), ((y + 2) * 180 + 2) * 4);

mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + 'favicon.svg', svg);
writeFileSync(OUT + 'favicon-32.png', encodePNG(32, 32, upscale(N, N, px, 2)));
writeFileSync(OUT + 'apple-touch-icon.png', encodePNG(180, 180, touch));
console.log('Wrote favicon.svg, favicon-32.png, apple-touch-icon.png');
