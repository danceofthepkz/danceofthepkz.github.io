// Sky lab: a small pixel-sky playground at the bottom of the home page.
// Loaded only when the visitor opens it (see main.js). Four models share one renderer:
// the site's own palette, single-scattering atmosphere, domain-warped clouds, and an aurora.

const W = 192, H = 108;
const HORIZON = Math.round(H * 0.72);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DEG = Math.PI / 180;

export const SIZE = { W, H };
export const MODES = [
  { id: 'palette', label: 'This site', note: 'The hand-tuned dusk → night and dawn → morning palettes the main page uses, chosen here by the sun height.' },
  { id: 'scatter', label: 'Atmosphere', note: 'Single scattering: air scatters blue about 5.5× more than red (Rayleigh, λ⁻⁴), haze adds a bright halo around the sun (Mie), and the light’s path through the air grows as the sun sinks.' },
  { id: 'clouds', label: 'Warped clouds', note: 'Fractal noise fed back into its own coordinates (domain warping), lit by the same atmosphere model.' },
  { id: 'aurora', label: 'Aurora', note: 'Curtains from a sum of sines, wrinkled by noise, green at the base fading to violet. Here the slider sets the activity.' }
];

// ---------- noise ----------
function hash(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j;
  const u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  return hash(i, j) * (1 - u) * (1 - v) + hash(i + 1, j) * u * (1 - v) + hash(i, j + 1) * (1 - u) * v + hash(i + 1, j + 1) * u * v;
}
function fbm(x, y) {
  let s = 0, a = 0.5;
  for (let o = 0; o < 4; o++) { s += a * vnoise(x, y); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; a *= 0.5; }
  return s;
}

// ---------- colour helpers ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// The main page's palettes (see buildSky in scene.js).
const PAL = {
  dusk: ['#1E1A33', '#33294B', '#54405F', '#87596A', '#C38E6A'].map(hex),
  night: ['#0D0B18', '#151229', '#1E1934', '#272040', '#33294A'].map(hex),
  dawn: ['#8C88B5', '#AFA2C7', '#D3B9CB', '#EDC9BD', '#F8D8B6'].map(hex),
  morn: ['#8FAFDB', '#AAC3E6', '#C6D6EE', '#DDE4F1', '#EEEAEA'].map(hex)
};
function paletteStops(sun) {
  // below -5° walk the evening palettes toward night, above it the morning ones toward late morning
  if (sun < -5) { const t = Math.min(1, (-5 - sun) / 13); return PAL.dusk.map((c, i) => mix(c, PAL.night[i], t)); }
  if (sun < 2) return PAL.dusk.map((c, i) => mix(c, PAL.dawn[i], (sun + 5) / 7));
  const t = Math.min(1, (sun - 2) / 40);
  return PAL.dawn.map((c, i) => mix(c, PAL.morn[i], t));
}

// ---------- atmosphere ----------
const BETA = [0.2, 0.45, 1.0], OZONE = [0.042, 0.1, 0.004];
const airmass = (a) => 1 / (Math.sin(Math.max(a, 0)) + 0.1);
function makeScatter(sunDeg, sunX) {
  const e = sunDeg * DEG, below = Math.max(0, -sunDeg);
  const ms = airmass(Math.max(e, 0)) + below * 0.9;
  const sunI = clamp01((sunDeg + 17) / 19) ** 2;
  // ozone (absorbs orange) dominates once the sun is down: the blue hour
  const ext = [0, 1, 2].map((c) => (BETA[c] * 0.9 + 0.05 + OZONE[c] * (1 + below * 2.5)) * ms * 0.42);
  const expo = 2.6 + 6 * Math.min(1, below / 9) - (e > 0 ? 1.1 * Math.min(1, sunDeg / 35) : 0);
  const floor = mix([0.08, 0.06, 0.15], [0.025, 0.02, 0.06], Math.min(1, below / 14));
  const grade = [1.0, 0.93, 1.06]; // nudge away from green toward the site's violet
  return (x, y, out) => {
    const a = Math.max(0.3 * DEG, (HORIZON - y) / HORIZON * 60 * DEG), mv = airmass(a);
    const dx = (x / W - sunX) * 80 * DEG;
    const cosG = Math.sin(a) * Math.sin(e) + Math.cos(a) * Math.cos(e) * Math.cos(dx);
    const pR = 0.75 * (1 + cosG * cosG), g = 0.78, pM = (1 - g * g) / Math.pow(1 + g * g - 2 * g * cosG, 1.5) * 0.06;
    // light that reaches the upper sky has crossed less air than light skimming the horizon
    const path = 1 - 0.72 * Math.sin(a);
    for (let c = 0; c < 3; c++) {
      const L = ((1 - Math.exp(-BETA[c] * mv * 0.55)) * pR + (1 - Math.exp(-0.09 * mv)) * pM) * Math.exp(-ext[c] * path) * sunI * expo;
      const v = Math.min(1, (1 - Math.exp(-L)) * grade[c]);
      out[c] = v + floor[c] * (1 - v);
    }
  };
}

// static hills so every model shares the same foreground
const HILLS = new Int16Array(W);
for (let x = 0; x < W; x++) HILLS[x] = Math.round(HORIZON + 3 + 4 * Math.sin(x * 0.045 + 1) + 2 * Math.sin(x * 0.13) + 8 * (fbm(x * 0.05, 3) - 0.5));

// Fills D (RGBA, W x H) for the given state. Pure: also used for offline previews.
export function renderSky(D, { mode, sun, sunX, levels, dither, t }) {
  const m = MODES[mode].id, out = [0, 0, 0];
  const stops = m === 'palette' ? paletteStops(sun) : null;
  const scatter = m === 'scatter' || m === 'clouds' ? makeScatter(sun, sunX) : null;
  let sunCol = null;
  if (scatter) { scatter(sunX * W, HORIZON - Math.max(2, sun / 60 * HORIZON), out); sunCol = out.map((v) => Math.min(1, v * 1.25 + 0.08)); }
  const night = m === 'aurora' ? 1 : clamp01((-sun - 4) / 10);
  const dusk = m === 'aurora' ? 1 : clamp01((3 - sun) / 9); // hills turn to silhouettes as the sun goes down
  const hillCol = mix(mix([0.69, 0.64, 0.78], [0.3, 0.25, 0.38], clamp01((8 - sun) / 10)), [0.07, 0.06, 0.11], dusk);
  const sunY = HORIZON - sun / 60 * HORIZON;
  const q = levels - 1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (m === 'palette') {
        const f = Math.min(1, y / HORIZON) * 4, i = Math.min(3, Math.floor(f));
        const c = mix(stops[i], stops[i + 1], f - i);
        out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
      } else if (m === 'scatter' || m === 'clouds') {
        scatter(x, Math.min(y, HORIZON), out);
        if (m === 'clouds' && y < HORIZON) {
          const u = x / W * 3 + t * 0.05, v = y / H * 1.8;
          const qx = fbm(u, v), qy = fbm(u + 5.2, v + 1.3);
          const rx = fbm(u + 3 * qx + 1.7 + t * 0.03, v + 3 * qy + 9.2), n = fbm(u + 3 * rx, v + 3 * qy);
          const dens = clamp01((n - 0.47) * 3.4), lit = Math.min(1, rx * 1.35);
          const shadeTint = [0.07, 0.05, 0.11];
          for (let c = 0; c < 3; c++) {
            const shade = out[c] * 0.5 + shadeTint[c];
            const light = sunCol[c] * 0.8 + 0.2;
            out[c] = out[c] * (1 - dens) + (shade + (light - shade) * lit) * dens;
          }
        }
      } else {
        const v = y / H, act = Math.max(0.15, (sun + 20) / 80), cx = x / W * 6.28;
        out[0] = 0.02; out[1] = 0.03 + 0.04 * v; out[2] = 0.09 + 0.06 * v;
        const band = 0.34 + 0.08 * Math.sin(cx * 1.3 + t * 0.6) + 0.05 * Math.sin(cx * 3.1 - t * 0.9) + 0.06 * (fbm(x / W * 4 + t * 0.1, 1.3) - 0.5);
        const dist = v - band;
        if (dist > -0.02) {
          let I = Math.exp(-dist * 7) * (dist < 0 ? Math.max(0, 1 + dist * 60) : 1);
          I *= (0.55 + 0.45 * Math.sin(cx * 9 + fbm(x * 0.05, t * 0.3) * 8 + t * 1.4) ** 2) * act;
          const k = clamp01(dist * 2.2);
          out[0] += I * (0.25 + 0.5 * k); out[1] += I * (1 - 0.65 * k); out[2] += I * (0.55 + 0.35 * k);
        }
      }
      // stars once the sky is dark enough
      if (m !== 'palette' && night > 0 && y < HORIZON - 4) {
        const s = hash(x * 1.3, y * 0.7);
        if (s > 0.988) { const tw = night * (0.45 + 0.25 * Math.sin(t * 3 + s * 60)); out[0] += tw; out[1] += tw; out[2] += tw * 1.1; }
      }
      // sun disc
      if (m !== 'aurora' && sun > -1.5) { const dx = x - sunX * W, dy = y - sunY; if (dx * dx + dy * dy < 16) { out[0] = 1; out[1] = 0.96; out[2] = 0.86; } }
      if (y >= HILLS[x]) { out[0] = hillCol[0]; out[1] = hillCol[1]; out[2] = hillCol[2]; }

      const th = dither ? (BAYER[(x & 3) + ((y & 3) << 2)] + 0.5) / 16 : 0.5, p = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const s = clamp01(out[c]) * q, f = Math.floor(s);
        D[p + c] = Math.round(Math.min(q, f + (s - f > th ? 1 : 0)) / q * 255);
      }
      D[p + 3] = 255;
    }
  }
}

// ---------- the lab UI ----------
export function mountSkyLab(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const img = ctx.createImageData(W, H);
  const note = root.querySelector('[data-note]');
  const sunIn = root.querySelector('[name="sun"]'), sunOut = root.querySelector('[data-sun-out]');
  const lvIn = root.querySelector('[name="levels"]'), lvOut = root.querySelector('[data-levels-out]');
  const dithIn = root.querySelector('[name="dither"]');
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  const state = { mode: 0, sun: Number(sunIn.value), sunX: 0.62, levels: Number(lvIn.value), dither: dithIn.checked, t: 0 };
  let last = 0, raf = 0, onScreen = true;
  const render = () => { renderSky(img.data, state); ctx.putImageData(img, 0, 0); };

  const animated = () => (MODES[state.mode].id === 'clouds' || MODES[state.mode].id === 'aurora') && !(mq && mq.matches);
  const running = () => onScreen && !document.hidden && root.open;
  function loop(now) {
    raf = 0;
    if (!running()) return;
    if (now - last > 33) { state.t += Math.min(0.05, (now - last) / 1000); last = now; render(); }
    if (animated()) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && animated() && running()) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function update() {
    sunOut.textContent = `${Math.round(state.sun)}°`;
    lvOut.textContent = String(state.levels);
    note.textContent = MODES[state.mode].note;
    canvas.setAttribute('aria-label', `Pixel sky, ${MODES[state.mode].label.toLowerCase()} model, sun at ${Math.round(state.sun)} degrees`);
    render();
    kick();
  }

  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    state.mode = Number(b.dataset.mode);
    root.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    update();
  }));
  sunIn.addEventListener('input', () => { state.sun = Number(sunIn.value); update(); });
  lvIn.addEventListener('input', () => { state.levels = Number(lvIn.value); update(); });
  dithIn.addEventListener('change', () => { state.dither = dithIn.checked; update(); });

  // drag across the sky to move the sun
  let dragging = false;
  const fromPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    state.sunX = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width));
    const yy = (e.clientY - r.top) / r.height * H;
    state.sun = Math.round(Math.min(60, Math.max(-20, (HORIZON - yy) / HORIZON * 60)));
    sunIn.value = String(state.sun);
    update();
  };
  canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); fromPointer(e); });
  canvas.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { onScreen = entries[0].isIntersecting; kick(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', kick);
  root.addEventListener('toggle', kick);
  if (mq && mq.addEventListener) mq.addEventListener('change', kick);

  update();
}
