// Renders the real scene (src/scene.js) headlessly into src/assets/og-image.png (1600x840).
// A tiny fake 2D canvas implements just the calls the scene uses.
// `node scripts/make-og.mjs [night|day]`
import { writeFileSync } from 'node:fs';
import { encodePNG, upscale } from './png.mjs';

const W = +(process.env.W || 1600), H = +(process.env.H || 840);
const OUT = process.env.OUT || new URL('../src/assets/og-image.png', import.meta.url).pathname;

function parseColor(s) {
  if (s[0] === '#') return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
  const v = s.match(/[\d.]+/g).map(Number);
  return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
}

class FakeCanvas {
  constructor() { this.width = 0; this.height = 0; this.buf = null; }
  getContext() { return new FakeCtx(this); }
  ensure() {
    if (!this.buf || this.buf.length !== this.width * this.height * 4) this.buf = new Uint8ClampedArray(this.width * this.height * 4);
    return this.buf;
  }
}

class FakeCtx {
  constructor(canvas) { this.canvas = canvas; this.globalAlpha = 1; this._c = [0, 0, 0, 1]; this.imageSmoothingEnabled = false; this.k = 1; }
  setTransform(a) { this.k = a; }
  set fillStyle(s) { this._c = parseColor(s); }
  get fillStyle() { return this._c; }
  fillRect(x, y, w, h) {
    const cv = this.canvas, buf = cv.ensure();
    const [r, g, b, a0] = this._c, a = a0 * this.globalAlpha;
    const k = this.k;
    const x0 = Math.max(0, Math.round(x * k)), y0 = Math.max(0, Math.round(y * k));
    const x1 = Math.min(cv.width, Math.round((x + w) * k)), y1 = Math.min(cv.height, Math.round((y + h) * k));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * cv.width + xx) * 4;
      buf[i] = r * a + buf[i] * (1 - a);
      buf[i + 1] = g * a + buf[i + 1] * (1 - a);
      buf[i + 2] = b * a + buf[i + 2] * (1 - a);
      buf[i + 3] = 255;
    }
  }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  putImageData(img) { this.canvas.ensure().set(img.data); }
  drawImage(src) {
    const dst = this.canvas, d = dst.ensure(), sb = src.ensure(), k = this.k;
    for (let y = 0; y < dst.height; y++) for (let x = 0; x < dst.width; x++) {
      const si = (Math.min(src.height - 1, Math.floor(y / k)) * src.width + Math.min(src.width - 1, Math.floor(x / k))) * 4;
      const di = (y * dst.width + x) * 4;
      d[di] = sb[si]; d[di + 1] = sb[si + 1]; d[di + 2] = sb[si + 2]; d[di + 3] = 255;
    }
  }
}

const sceneCanvas = new FakeCanvas();
globalThis.window = {
  innerWidth: W, innerHeight: H,
  matchMedia: () => ({ matches: false }),
  addEventListener() {}, removeEventListener() {}
};
globalThis.document = {
  createElement: () => new FakeCanvas(),
  querySelector: (sel) => (sel.startsWith('canvas') ? sceneCanvas : null),
  querySelectorAll: () => []
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const { Site } = await import('../src/scene.js');
const theme = process.argv[2] === 'day' ? 'day' : 'night';
const site = new Site({ theme, companion: 'light' });
site.componentDidMount();
site.reduce = true; // deterministic: no drifting clouds or streaks
site.frame(0.016);

const lw = sceneCanvas.width, lh = sceneCanvas.height;
const k = Math.max(1, Math.round(W / lw));
writeFileSync(OUT, encodePNG(lw * k, lh * k, upscale(lw, lh, sceneCanvas.buf, k)));
console.log(`Wrote ${OUT.split('/').pop()} (${theme}, ${lw * k}x${lh * k})`);
