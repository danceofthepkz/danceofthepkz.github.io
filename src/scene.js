// Pixel-art canvas scene, moved from website-prototype-reference.html.
// Drawing logic is unchanged; only start()/stop() were added so the page can pause it.

export class Site {
  constructor(props) {
    this.props = props;
    this.state = {};
  }

  setState(next) {
    Object.assign(this.state, next);
    this.applyMode();
  }

  applyMode() {
    const v = this.renderVals();
    const root = document.querySelector('[data-root]');
    if (root) root.setAttribute('data-mode', v.mode);
    const btn = document.getElementById('theme-toggle');
    if (btn) { btn.setAttribute('aria-label', v.toggleLabel); btn.setAttribute('title', v.toggleLabel); }
    document.querySelectorAll('[data-when]').forEach((el) => {
      el.style.display = el.getAttribute('data-when') === v.mode ? 'contents' : 'none';
    });
  }

  modeNow() {
    if (this.state && this.state.mode) return this.state.mode;
    const th = this.props && this.props.theme;
    if (th === 'day' || th === 'night') return th;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'day';
    } catch (e) {}
    return 'night';
  }

  renderVals() {
    const mode = this.modeNow();
    const day = mode === 'day';
    return {
      mode: mode,
      isDay: day,
      isNight: !day,
      nightScrim: day ? '0' : '1',
      dayScrim: day ? '1' : '0',
      toggleLabel: day ? 'Switch to night' : 'Switch to day',
      toggle: () => this.setState({ mode: day ? 'night' : 'day' })
    };
  }

  componentDidMount() {
    this.canvas = document.querySelector('canvas[data-scene]');
    this.root = document.querySelector('[data-root]');
    if (!this.canvas || !this.canvas.getContext) return;
    this.ctx = this.canvas.getContext('2d');
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.reduce = !!(mq && mq.matches);
    if (mq && mq.addEventListener) mq.addEventListener('change', (e) => { this.reduce = e.matches; });
    this.time = 0;
    this.d = this.modeNow() === 'day' ? 1 : 0;
    this.comp = { x: null, y: null, face: 1, moving: false, kind: null };
    this.onResize = () => this.layout();
    window.addEventListener('resize', this.onResize);
    this.layout();
    this.start();
  }

  start() {
    if (this.raf || !this.ctx) return;
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  componentWillUnmount() {
    this.stop();
    if (this.onResize) window.removeEventListener('resize', this.onResize);
  }

  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  mixc(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  css(c) {
    return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  }

  ridge(rand, n, base, amp, k1, k2) {
    const p1 = [], p2 = [];
    for (let i = 0; i <= Math.ceil(n / k1) + 2; i++) p1.push(rand());
    for (let i = 0; i <= Math.ceil(n / k2) + 2; i++) p2.push(rand());
    const sm = (t) => t * t * (3 - 2 * t);
    const out = new Array(n);
    for (let x = 0; x < n; x++) {
      const xq = x - (x % 2);
      const a = xq / k1, i = Math.floor(a), f = sm(a - i);
      const b = xq / k2, j = Math.floor(b), g = sm(b - j);
      const v = (p1[i] * (1 - f) + p1[i + 1] * f) * 0.72 + (p2[j] * (1 - g) + p2[j + 1] * g) * 0.28;
      out[x] = Math.round(base + v * amp);
    }
    return out;
  }

  buildRock(R, halfTop, halfBot, h, floating, footHalf) {
    const rows = [];
    let jl = 0, jr = 0, hold = 0;
    const ledgeAt = floating ? -1 : Math.floor(h * (0.3 + R() * 0.3));
    const ledgeSide = R() < 0.5 ? -1 : 1;
    for (let y = 0; y < h; y++) {
      const t = y / Math.max(1, h - 1);
      const half = floating ? halfTop * Math.pow(1 - t, 0.8) : halfTop + (halfBot - halfTop) * t * t;
      if (hold <= 0) {
        jl = Math.round((R() - 0.5) * 3);
        jr = Math.round((R() - 0.5) * 3);
        hold = 3 + Math.floor(R() * 4);
      }
      hold--;
      let xl, xr;
      if (y < 4) {
        const ins = y === 0 ? 2 : (y === 1 ? 1 : 0);
        xl = -halfTop + ins; xr = halfTop - ins;
      } else {
        xl = -Math.round(half) + jl; xr = Math.round(half) + jr;
        if (y >= ledgeAt && y < ledgeAt + 3) { if (ledgeSide < 0) xl -= 4; else xr += 4; }
        if (y === ledgeAt + 3) { if (ledgeSide < 0) xl -= 2; else xr += 2; }
      }
      if (xr - xl < 1) break;
      rows.push([xl, xr]);
    }
    const rims = [];
    for (let y = 0; y < rows.length; y++) {
      const r = rows[y];
      if (y === 0) { rims.push([r[0], 0, r[1] - r[0] + 1]); continue; }
      const q = rows[y - 1];
      if (r[0] < q[0]) rims.push([r[0], y, q[0] - r[0]]);
      if (r[1] > q[1]) rims.push([q[1] + 1, y, r[1] - q[1]]);
    }
    const blobs = [];
    for (let y = 5; y < rows.length - 3; y += 6) {
      const r = rows[y];
      for (let x = r[0] + 3 + Math.floor(R() * 4); x < r[1] - 5; x += 6 + Math.floor(R() * 4)) {
        if (R() < 0.75) blobs.push([x, y + Math.floor(R() * 3)]);
      }
    }
    const grass = [];
    const r0 = rows[0];
    for (let x = r0[0]; x <= r0[1]; x++) {
      if (Math.abs(x) <= footHalf) continue;
      if (R() < 0.7) grass.push([x, -1 - (R() < 0.5 ? 1 : 0), R() < 0.5 ? 1 : 2]);
    }
    if (rows.length > 6) {
      grass.push([rows[2][0], 2, 2 + Math.floor(R() * 3)]);
      grass.push([rows[2][1], 2, 1 + Math.floor(R() * 3)]);
    }
    const drips = [];
    if (floating) {
      const last = rows.length;
      for (let k = 0; k < 3; k++) {
        const y = Math.floor(last * (0.45 + R() * 0.4));
        const r = rows[Math.min(last - 1, y)];
        const x = r[0] + 1 + Math.floor(R() * Math.max(1, r[1] - r[0] - 2));
        drips.push([x, y, 2 + Math.floor(R() * 4)]);
      }
    }
    return { rows: rows, rims: rims, blobs: blobs, grass: grass, drips: drips };
  }

  disc(x, y, r, style) {
    const ctx = this.ctx;
    ctx.fillStyle = style;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(x - w, y + dy, w * 2 + 1, 1);
    }
  }

  sprite(rows, x, y, face, pal) {
    const ctx = this.ctx, w = rows[0].length;
    const X = Math.round(x), Y = Math.round(y);
    for (let r = 0; r < rows.length; r++) {
      for (let i = 0; i < w; i++) {
        const ch = rows[r][i];
        if (ch === '.') continue;
        const col = pal[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(X + (face > 0 ? i : w - 1 - i), Y + r, 1, 1);
      }
    }
  }

  layout() {
    if (!this.canvas) return;
    const W = window.innerWidth || 1280, H = window.innerHeight || 800;
    const s = Math.max(2, Math.round(W / 380));
    const lw = Math.ceil(W / s), lh = Math.ceil(H / s);
    this.lw = lw; this.lh = lh;
    // Wide screens: the canvas has k-times finer pixels. Everything is drawn through a k-scale
    // transform (so the sky/clouds/hills look unchanged) except the landmarks, which use the fine grid.
    const narrow = W <= 768;
    const k = narrow ? 1 : 2;
    this.k = k;
    this.canvas.width = lw * k; this.canvas.height = lh * k;
    this.ctx.imageSmoothingEnabled = false;
    const base = Math.min(lh, lw * 0.62);
    this.base = base;
    this.horizon = Math.round(lh - base * 0.36);
    const R = this.rng(20271);

    const H4 = (a, b, c, d) => [this.hex(a), this.hex(b), this.hex(c), this.hex(d)];
    this.P = {
      far: H4('#5A4266', '#1F1932', '#B4A3C4', '#A9B6D0'),
      farRim: H4('#8E6274', '#2C2445', '#E2CCD6', '#D5DEEC'),
      rock: H4('#2E2541', '#191426', '#7A6B92', '#7A7C9E'),
      rockDark: H4('#241D34', '#120E1C', '#66597F', '#66688A'),
      rockLight: H4('#43355A', '#251E37', '#988AB0', '#9A9CBA'),
      rim: H4('#E0A87A', '#6F5C92', '#FFE4C8', '#F6F4FF'),
      grass: H4('#7E8C6C', '#2E3A36', '#8DAA7C', '#93B784'),
      ground: H4('#1A1528', '#0C0A15', '#5E5176', '#5C5B7C'),
      cloudLight: H4('#E2A98A', '#3C3356', '#FFF4EA', '#FFFFFF'),
      cloud: H4('#A17189', '#2A2342', '#F1D9DD', '#E9EDF6'),
      cloudShadow: H4('#735270', '#211B34', '#CDB4C8', '#C3CBE0')
    };
    this.mats = {
      pearl: { a: this.hex('#8F87AC'), b: this.hex('#D27A9C') },
      parrish: { a: this.hex('#B4ADC2'), b: this.hex('#58516F'), c: this.hex('#3A3450'), d: this.hex('#E6E0EC') },
      scope: { a: this.hex('#9089AD'), b: this.hex('#F3F1F6') }
    };

    this.far = this.ridge(R, lw, base * 0.24, base * 0.18, 56, 16);
    this.fg = this.ridge(R, lw, base * 0.06, base * 0.07, 40, 10);

    // Landmarks are drawn at ~60% of the original prototype size and sit low in the bottom-right corner.
    // u = landmark unit in fine pixels. Phones keep the original size and placement;
    // wide screens get smaller landmarks low in the bottom-right corner, at 2x detail.
    const u = narrow ? Math.max(0.6, (base / 225) * 0.85) : Math.max(0.45, (base / 225) * 0.85 * 0.6) * k;
    this.u = u;
    const specs = narrow ? [
      { f: 0.62, type: 'pearl', top: 0.3, bot: 7, float: false },
      { f: 0.785, type: 'parrish', top: 0.24, bot: 9, float: false },
      { f: 0.945, type: 'scope', top: 0.52, bot: 0, float: true }
    ] : [
      { f: 0.72, type: 'pearl', top: 0.22, bot: 5, float: false },
      { f: 0.865, type: 'parrish', top: 0.18, bot: 6, float: false },
      { f: 0.958, type: 'scope', top: 0.4, bot: 0, float: true }
    ];
    this.marks = specs.map((sp) => {
      const ang = sp.type === 'scope' ? this.scopeAngle() : 0;
      const lm = this.buildLandmark(sp.type, u, ang);
      let fx0 = 1e9, fx1 = -1e9;
      for (const r of lm.runs) if (r[1] <= 1) { fx0 = Math.min(fx0, r[0]); fx1 = Math.max(fx1, r[0] + r[2] - 1); }
      const footHalf = Math.max(-fx0, fx1);
      const halfTop = footHalf + 3;
      const depth = (sp.float ? Math.max(14, Math.round(base * 0.13)) : Math.round(base * sp.top) + 4) * k;
      const rock = this.buildRock(R, halfTop, halfTop + Math.round(sp.bot * u), depth, sp.float, footHalf);
      return { type: sp.type, ang: ang, cx: Math.round(lw * k * sp.f), lm: lm, rock: rock, float: sp.float, topY: Math.round((lh - base * sp.top) * k) };
    });

    this.clouds = [];
    const nc = Math.max(4, Math.round(lw / 48));
    for (let i = 0; i < nc; i++) {
      const L = Math.round(24 + R() * 70);
      const rows = 2 + Math.floor(R() * 3);
      const rs = [];
      let span = 0;
      for (let r = 0; r < rows; r++) {
        const shrink = (r === 0 ? 0.55 : (r === rows - 1 ? 0.7 : 1)) * (0.75 + R() * 0.25);
        const len = Math.max(6, Math.round(L * shrink));
        const off = Math.round((L - len) * R());
        rs.push({ off: off, len: len });
        span = Math.max(span, off + len);
      }
      const y = Math.round(lh - base * (0.5 + R() * 0.46));
      this.clouds.push({ x: R() * (lw + 120) - 60, y: Math.max(2, Math.min(this.horizon - rows * 2 - 4, y)), rs: rs, span: span, v: 0.4 + R() * 1.1 });
    }

    this.stars = [];
    const ns = Math.min(150, Math.round(lw * lh / 360));
    for (let i = 0; i < ns; i++) {
      this.stars.push({ x: Math.floor(R() * lw), y: Math.floor(R() * Math.max(4, this.horizon - 8)), sp: 0.6 + R() * 2, ph: R() * 6.28, b: 0.4 + R() * 0.6, big: R() < 0.06 });
    }

    this.flock = [];
    const fy = Math.round(lh - base * (0.78 + R() * 0.12));
    for (let i = 0; i < 6; i++) {
      this.flock.push({ dx: i * 5 + Math.round(R() * 3), dy: (i % 2) * 3 + Math.round(R() * 2), ph: R() * 6.28 });
    }
    this.flockX = lw * 0.7; this.flockY = Math.max(6, fy);

    this.streaks = [];
    const nk = Math.max(6, Math.round(lw / 16));
    for (let i = 0; i < nk; i++) {
      this.streaks.push({ x: R() * lw, y: Math.floor(R() * lh), len: 4 + Math.floor(R() * 14), v: 5 + R() * 9, a: (0.06 + R() * 0.12).toFixed(3) });
    }

    this.motes = [];
    for (let i = 0; i < 14; i++) {
      this.motes.push({ x: R() * lw, y: lh - base * (0.1 + R() * 0.45), sx: 0.2 + R() * 0.5, sy: 0.3 + R() * 0.6, ph: R() * 6.28 });
    }

    this.skyKey = '';
    if (this.comp) this.comp.x = null;
  }

  ease(x) {
    const k = Math.min(1, Math.max(0, x));
    return k * k * (3 - 2 * k);
  }

  scopeAngle() {
    const e = this.ease(this.d || 0);
    return Math.round((-0.45 + 0.9 * e) * 20) / 20;
  }

  buildLandmark(type, u, ang) {
    const px = new Map();
    const lights = [], glints = [];
    let mat = 'a';
    const put = (x, y) => { const X = Math.round(x), Y = Math.round(y); px.set(X + ',' + Y, [X, Y, mat]); };
    const rect = (x0, y0, x1, y1) => {
      const a = Math.round(x0 * u), b = Math.round(x1 * u), c = Math.round(y0 * u), d = Math.round(y1 * u);
      for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) put(x, y);
    };
    const ball = (cx, cy, r) => {
      const RR = r * u, X = cx * u, Y = cy * u;
      for (let y = Math.floor(Y - RR); y <= Math.ceil(Y + RR); y++) {
        for (let x = Math.floor(X - RR); x <= Math.ceil(X + RR); x++) {
          if ((x - X) * (x - X) + (y - Y) * (y - Y) <= RR * RR + 0.3) put(x, y);
        }
      }
    };
    const seg = (x0, y0, x1, y1, th) => {
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * u) + 1;
      for (let i = 0; i <= n; i++) {
        const tt = i / n;
        const x = (x0 + (x1 - x0) * tt) * u, y = (y0 + (y1 - y0) * tt) * u;
        for (let k = 0; k < th; k++) put(x + k, y);
      }
    };
    const light = (x, y, c, blink) => lights.push([Math.round(x * u), Math.round(y * u), c, blink || 0]);
    const glint = (x, y) => glints.push([Math.round(x * u), Math.round(y * u)]);

    if (type === 'pearl') {
      seg(-11, 0, -4, 16, 2);
      seg(10, 0, 3, 16, 2);
      rect(-5, 0, -4, 66);
      rect(4, 0, 5, 66);
      rect(-1, 0, 1, 66);
      mat = 'b';
      ball(0, 24, 6.4);
      ball(0, 40, 1.7);
      ball(0, 47, 1.7);
      ball(0, 54, 1.7);
      ball(0, 70, 5.6);
      mat = 'a';
      rect(-1, 75, 1, 88);
      mat = 'b';
      ball(0, 90, 2.3);
      mat = 'a';
      rect(-1, 92, 1, 100);
      rect(0, 101, 0, 121);
      for (let x = -5; x <= 5; x += 2) light(x, 24, 'pink');
      for (let x = -3; x <= 3; x += 2) light(x, 20, 'pink');
      for (let x = -4; x <= 4; x += 2) light(x, 70, 'pink');
      light(0, 40, 'pink');
      light(0, 47, 'pink');
      light(0, 54, 'pink');
      light(0, 90, 'pink');
      light(0, 121, 'red', 1);
      glint(3, 27);
      glint(2.5, 72.5);
    } else if (type === 'parrish') {
      // Parrish Hall (Swarthmore): long Second Empire stone building — mansard roofs with
      // dormers, two end pavilions, a central pavilion with a portico, clock and cupola.
      // Units: x from the centre line, y up from the ground.
      const sym = (x0, y0, x1, y1) => { rect(x0, y0, x1, y1); rect(-x1, y0, -x0, y1); };
      const symPut = (x, y) => { put(x * u, y * u); put(-x * u, y * u); };
      const win = (x, y0, y1) => { mat = 'c'; rect(x, y0, x, y1); };
      const floors = [[2, 4], [8, 10], [14, 16]];
      // main wings
      mat = 'a'; rect(-31, 0, 31, 20);
      for (const [y0, y1] of floors) for (let x = 11; x <= 29; x += 3) { win(x, y0, y1); win(-x, y0, y1); }
      mat = 'd'; rect(-31, 6, 31, 6); rect(-32, 21, 32, 21);
      mat = 'b';
      [0, 0, 1, 1, 2, 3].forEach((ins, i) => rect(-31 + ins, 22 + i, 31 - ins, 22 + i));
      for (const x of [14, 20, 26]) {
        mat = 'a'; sym(x - 1, 22, x + 1, 25); symPut(x, 26);
        mat = 'c'; sym(x, 23, x, 24);
      }
      mat = 'd'; rect(-28, 28, 28, 28);
      mat = 'a'; sym(17, 28, 18, 31);
      // end pavilions
      mat = 'a'; sym(31, 0, 40, 23);
      for (const [y0, y1] of floors.concat([[19, 21]])) for (const x of [33, 36, 39]) { win(x, y0, y1); win(-x, y0, y1); }
      mat = 'd'; sym(30, 24, 41, 24);
      mat = 'b';
      [0, 0, 1, 1, 2, 2, 3, 4].forEach((ins, i) => sym(31 + ins, 25 + i, 40 - ins, 25 + i));
      mat = 'a'; sym(34, 26, 37, 29); symPut(35, 30); symPut(36, 30);
      mat = 'c'; sym(35, 27, 36, 28);
      mat = 'd'; sym(35, 33, 36, 33); symPut(32, 33); symPut(39, 33); symPut(32, 34); symPut(39, 34);
      // central pavilion + portico
      mat = 'a'; rect(-8, 0, 8, 26);
      for (const [y0, y1] of floors.concat([[20, 22]])) { win(-6, y0, y1); win(6, y0, y1); }
      mat = 'c'; rect(-2, 0, 2, 5); rect(-1, 6, 1, 6);
      mat = 'd'; rect(-4, 0, -4, 7); rect(4, 0, 4, 7); rect(-5, 8, 5, 8); rect(-9, 27, 9, 27);
      mat = 'b';
      [0, 0, 0, 1, 1, 2, 2, 3, 4, 5].forEach((ins, i) => rect(-8 + ins, 28 + i, 8 - ins, 28 + i));
      mat = 'd'; ball(0, 32, 1.6);
      // cupola: dome first, drum drawn over its lower half
      mat = 'b'; ball(0, 44, 2.6);
      mat = 'a'; rect(-2, 39, 2, 43);
      mat = 'c'; rect(-1, 40, -1, 42); rect(1, 40, 1, 42);
      mat = 'd'; rect(-3, 38, 3, 38); rect(0, 47, 0, 51);
      mat = 'a';
      // lit windows at night (deterministic subset)
      for (const [y0] of floors) {
        for (let x = 11; x <= 29; x += 3) {
          if (((x * 7 + y0 * 13) % 5 + 5) % 5 < 2) light(x, y0 + 1, 'warm');
          if (((x * 11 + y0 * 5) % 5 + 5) % 5 < 2) light(-x, y0 + 1, 'warm');
        }
        for (const x of [33, 36, 39]) if ((x + y0) % 3 === 0) { light(x, y0 + 1, 'warm'); light(-x, y0 + 2, 'warm'); }
      }
      light(0, 32, 'clock');
    } else {
      seg(-7, 0, -2, 12, 2);
      seg(6, 0, 1, 12, 2);
      rect(-2, 0, 2, 15);
      rect(-1, 15, 1, 19);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const tf = (dx, dy) => [dx * ca - dy * sa, 20 + dx * sa + dy * ca];
      mat = 'b';
      for (let s = -1; s <= 1.0001; s += 0.03) {
        const bottom = s * s * 7;
        for (let d = bottom; d <= 7; d += 0.5) {
          const q = tf(s * 15, d);
          put(q[0] * u, q[1] * u);
        }
      }
      mat = 'a';
      const fp = tf(0, 15), lp = tf(-15, 7), rp = tf(15, 7), vp = tf(0, 7);
      seg(lp[0], lp[1], fp[0], fp[1], 1);
      seg(rp[0], rp[1], fp[0], fp[1], 1);
      seg(vp[0], vp[1], fp[0], fp[1], 1);
      light(fp[0], fp[1] + 1, 'red', 1);
      const gp = tf(6, 6);
      glint(gp[0], gp[1]);
    }

    const pts = Array.from(px.values());
    const rows = new Map();
    for (const p of pts) {
      if (!rows.has(p[1])) rows.set(p[1], []);
      rows.get(p[1]).push(p);
    }
    const runs = [], rimL = [], rimR = [];
    rows.forEach((ps, y) => {
      ps.sort((a, b) => a[0] - b[0]);
      let s = ps[0][0], prev = ps[0][0], m = ps[0][2], segStart = ps[0][0];
      for (let i = 1; i <= ps.length; i++) {
        const q = ps[i];
        if (q && q[0] === prev + 1 && q[2] === m) { prev = q[0]; continue; }
        runs.push([s, y, prev - s + 1, m]);
        if (!(q && q[0] === prev + 1)) {
          rimL.push([segStart, y]);
          rimR.push([prev, y]);
          if (q) segStart = q[0];
        }
        if (q) { s = q[0]; prev = q[0]; m = q[2]; }
      }
    });
    const topByX = new Map();
    for (const p of pts) {
      const cur = topByX.get(p[0]);
      if (cur === undefined || p[1] > cur) topByX.set(p[0], p[1]);
    }
    const rimT = [];
    topByX.forEach((y, x) => rimT.push([x, y]));
    return { runs: runs, rimL: rimL, rimR: rimR, rimT: rimT, lights: lights, glints: glints, u: u };
  }

  buildSky(t, dd) {
    const lw = this.lw, lh = this.lh;
    if (!this.sky) this.sky = document.createElement('canvas');
    this.sky.width = lw; this.sky.height = lh;
    const sctx = this.sky.getContext('2d');
    const img = sctx.createImageData(lw, lh);
    const d = img.data;
    const dusk = ['#1E1A33', '#33294B', '#54405F', '#87596A', '#C38E6A'];
    const night = ['#0D0B18', '#151229', '#1E1934', '#272040', '#33294A'];
    const dawn = ['#8C88B5', '#AFA2C7', '#D3B9CB', '#EDC9BD', '#F8D8B6'];
    const morn = ['#8FAFDB', '#AAC3E6', '#C6D6EE', '#DDE4F1', '#EEEAEA'];
    const stops = dusk.map((h, i) => this.mixc(this.mixc(this.hex(h), this.hex(night[i]), t), this.mixc(this.hex(dawn[i]), this.hex(morn[i]), t), dd));
    const glow = this.mixc(this.mixc(this.hex('#EDB98C'), this.hex('#3B3156'), t), this.mixc(this.hex('#FFE6C4'), this.hex('#FFF7EA'), t), dd);
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const hz = Math.max(1, this.horizon);
    const gx = lw * (0.3 + 0.5 * dd), gr = Math.max(40, lw * 0.42);
    const gs = (1 - t * 0.9) * (1 - dd) + (1 - t * 0.6) * 0.75 * dd;
    for (let y = 0; y < lh; y++) {
      const f = Math.min(1, Math.max(0, y / hz)) * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(f));
      const fr = f - i;
      for (let x = 0; x < lw; x++) {
        const th = (B[(x & 3) + ((y & 3) << 2)] + 0.5) / 16;
        let c = fr > th ? stops[i + 1] : stops[i];
        const dx = x - gx, dy = (y - hz) * 2.2;
        const g = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / gr) * gs;
        if (g > 0) {
          const q = g * 3, qi = Math.floor(q);
          const lv = qi + ((q - qi) > th ? 1 : 0);
          if (lv > 0) c = this.mixc(c, glow, (lv / 3) * 0.55);
        }
        const p = (y * lw + x) * 4;
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);
  }

  frame(dt) {
    const ctx = this.ctx;
    if (!ctx || !this.lw) return;
    if (!this.reduce) this.time += dt;
    const lw = this.lw, lh = this.lh, base = this.base, P = this.P;

    const target = this.modeNow() === 'day' ? 1 : 0;
    if (this.reduce) this.d = target;
    else if (this.d < target) this.d = Math.min(target, this.d + dt / 1.6);
    else if (this.d > target) this.d = Math.max(target, this.d - dt / 1.6);
    const dd = this.ease(this.d);
    const nd = 1 - dd;

    let p = 0;
    if (this.root) {
      const r = this.root.getBoundingClientRect();
      const tot = r.height - window.innerHeight;
      p = tot > 0 ? Math.min(1, Math.max(0, -r.top / tot)) : 0;
    }
    const t = this.ease((p - 0.06) / 0.86);
    const key = Math.round(t * 40) + '|' + Math.round(dd * 24);
    if (key !== this.skyKey) { this.buildSky(Math.round(t * 40) / 40, Math.round(dd * 24) / 24); this.skyKey = key; }
    const mixP = (name) => this.mixc(this.mixc(P[name][0], P[name][1], t), this.mixc(P[name][2], P[name][3], t), dd);
    const col = (name) => this.css(mixP(name));
    const la = this.ease((t - 0.45) / 0.45) * nd;

    const k = this.k || 1;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.drawImage(this.sky, 0, 0);

    if (t > 0.02 && nd > 0.01) {
      for (const st of this.stars) {
        const a = nd * t * st.b * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * st.sp + st.ph)));
        if (st.big && t > 0.5) {
          ctx.fillStyle = 'rgba(238,230,255,' + (a * 0.35).toFixed(3) + ')';
          ctx.fillRect(st.x - 1, st.y, 3, 1);
          ctx.fillRect(st.x, st.y - 1, 1, 3);
        }
        ctx.fillStyle = 'rgba(238,230,255,' + a.toFixed(3) + ')';
        ctx.fillRect(st.x, st.y, 1, 1);
      }
    }

    if (dd > 0.001) {
      const sx = Math.round(lw * 0.8);
      const rise = 6 + base * (0.1 + 0.3 * t);
      const sy = Math.round(this.horizon + 10 - (rise + 10) * dd);
      this.disc(sx, sy, 16, 'rgba(255,240,214,' + (0.1 * dd).toFixed(3) + ')');
      this.disc(sx, sy, 10, 'rgba(255,240,214,' + (0.18 * dd).toFixed(3) + ')');
      this.disc(sx, sy, 6, 'rgba(255,246,228,' + (0.95 * dd).toFixed(3) + ')');
    }

    const cL = col('cloudLight'), cB = col('cloud'), cS = col('cloudShadow');
    for (const c of this.clouds) {
      if (!this.reduce) {
        c.x -= c.v * dt;
        if (c.x + c.span < -2) c.x = lw + 2;
      }
      for (let i = 0; i < c.rs.length; i++) {
        const r = c.rs[i];
        ctx.fillStyle = i === 0 ? cL : (i === c.rs.length - 1 ? cS : cB);
        ctx.fillRect(Math.round(c.x + r.off), c.y + i * 2, r.len, 2);
      }
    }

    if (dd > 0.05) {
      if (!this.reduce) {
        this.flockX -= 3 * dt;
        if (this.flockX < -40) this.flockX = lw + 20;
      }
      ctx.fillStyle = 'rgba(88,78,112,' + (0.75 * dd).toFixed(3) + ')';
      for (const b of this.flock) {
        const x = Math.round(this.flockX + b.dx), y = Math.round(this.flockY + b.dy);
        const up = Math.sin(this.time * 5 + b.ph) > 0;
        ctx.fillRect(x - 1, y + (up ? 0 : 1), 1, 1);
        ctx.fillRect(x, y + 1, 1, 1);
        ctx.fillRect(x + 1, y + (up ? 0 : 1), 1, 1);
      }
    }

    const oF = -p * base * 0.04;
    const farC = col('far'), farR = col('farRim');
    for (let x = 0; x < lw; x++) {
      const y = Math.round(lh - this.far[x] + oF);
      ctx.fillStyle = farC;
      ctx.fillRect(x, y, 1, lh - y);
      ctx.fillStyle = farR;
      ctx.fillRect(x, y, 1, 1);
    }

    const oP = -p * base * 0.1;
    const body = col('rock'), rim = col('rim'), tex = col('rockDark'), lite = col('rockLight'), grass = col('grass');
    const rockN = this.mixc(P.rock[0], P.rock[1], t);
    const rightLit = dd > 0.5;
    const sang = this.scopeAngle();

    // Landmarks + their rocks are drawn on the fine grid (k x the scene's pixels).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Keep a little material detail visible at dusk/night instead of a flat silhouette.
    const md = 0.28 + 0.72 * dd;
    for (const m of this.marks) {
      if (m.type === 'scope' && m.ang !== sang) { m.ang = sang; m.lm = this.buildLandmark('scope', this.u, sang); }
      const K = m.rock, L = m.lm, cx = m.cx;
      const bob = m.float && !this.reduce ? Math.round(Math.sin(this.time * 0.6) * 1.2) * k : 0;
      const top = Math.round(m.topY + oP * k) + bob;
      const n = K.rows.length, last = K.rows[n - 1];
      const tail = m.float ? 0 : Math.max(0, lh * k - (top + n));
      const litX = (r) => rightLit ? r[1] : r[0];
      const litIn = rightLit ? -1 : 1;
      const shX = (r) => rightLit ? r[0] : r[1] - 1;

      ctx.fillStyle = body;
      for (let y = 0; y < n; y++) ctx.fillRect(cx + K.rows[y][0], top + y, K.rows[y][1] - K.rows[y][0] + 1, 1);
      if (tail) ctx.fillRect(cx + last[0], top + n, last[1] - last[0] + 1, tail);

      ctx.fillStyle = tex;
      for (let y = 2; y < n; y++) ctx.fillRect(cx + shX(K.rows[y]), top + y, 2, 1);
      if (tail) ctx.fillRect(cx + shX(last), top + n, 2, tail);
      if (m.float) ctx.fillRect(cx + K.rows[n - 1][0], top + n - 1, K.rows[n - 1][1] - K.rows[n - 1][0] + 1, 1);
      for (const b of K.blobs) {
        const X = cx + b[0], Y = top + b[1];
        ctx.fillStyle = lite;
        ctx.fillRect(X + 1, Y - 1, 2, 1);
        ctx.fillStyle = tex;
        ctx.fillRect(X + 1, Y, 2, 1);
        ctx.fillRect(X, Y + 1, 4, 1);
        ctx.fillRect(X + 1, Y + 2, 2, 1);
      }
      for (const dr of K.drips) ctx.fillRect(cx + dr[0], top + dr[1], 1, dr[2]);

      const litRows = Math.round(n * 0.6);
      ctx.fillStyle = lite;
      for (let y = 1; y < litRows; y++) ctx.fillRect(cx + litX(K.rows[y]) + litIn, top + y, 1, 1);
      ctx.fillStyle = rim;
      ctx.globalAlpha = 0.55;
      for (let y = 1; y < litRows; y++) ctx.fillRect(cx + litX(K.rows[y]), top + y, 1, 1);
      ctx.globalAlpha = 1;
      for (const r of K.rims) ctx.fillRect(cx + r[0], top + r[1], r[2], 1);

      ctx.fillStyle = grass;
      for (const g of K.grass) ctx.fillRect(cx + g[0], top + g[1], 1, g[2]);

      const gy = top - 1;
      const M = this.mats[m.type];
      const mc = {};
      for (const key in M) mc[key] = this.css(this.mixc(rockN, M[key], md));
      for (const r of L.runs) {
        ctx.fillStyle = mc[r[3]] || mc.a;
        ctx.fillRect(cx + r[0], gy - r[1], r[2], 1);
      }
      ctx.fillStyle = rim;
      for (const q of L.rimT) ctx.fillRect(cx + q[0], gy - q[1], 1, 1);
      ctx.globalAlpha = 0.45;
      for (const q of (rightLit ? L.rimR : L.rimL)) ctx.fillRect(cx + q[0], gy - q[1], 1, 1);
      ctx.globalAlpha = 1;

      if (la > 0.002) {
        for (const g of L.lights) {
          let a = la;
          if (g[3]) a *= Math.sin(this.time * 2.6) > 0.3 ? 1 : 0.12;
          const X = cx + g[0], Y = gy - g[1];
          if (g[2] === 'clock') {
            const r = Math.max(1, Math.round(2 * L.u));
            this.disc(X, Y, r + 3, 'rgba(255,214,150,' + (a * 0.12).toFixed(3) + ')');
            this.disc(X, Y, r, 'rgba(255,224,170,' + (a * 0.85).toFixed(3) + ')');
            continue;
          }
          const rgb = g[2] === 'pink' ? '255,150,205' : (g[2] === 'red' ? '255,96,84' : '255,210,140');
          if (g[2] !== 'warm') {
            ctx.fillStyle = 'rgba(' + rgb + ',' + (a * 0.18).toFixed(3) + ')';
            ctx.fillRect(X - 1, Y - 1, 3, 3);
          }
          ctx.fillStyle = 'rgba(' + rgb + ',' + (a * 0.9).toFixed(3) + ')';
          ctx.fillRect(X, Y, 1, 1);
        }
      }

      if (dd > 0.05) {
        for (let i = 0; i < L.glints.length; i++) {
          const g = L.glints[i];
          const tw = 0.55 + 0.45 * Math.sin(this.time * 1.8 + i * 2.1 + p * 6);
          const a = dd * tw;
          const X = cx + g[0], Y = gy - g[1];
          ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.5).toFixed(3) + ')';
          ctx.fillRect(X - 1, Y, 3, 1);
          ctx.fillRect(X, Y - 1, 1, 3);
          ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
          ctx.fillRect(X, Y, 1, 1);
        }
      }
    }

    ctx.setTransform(k, 0, 0, k, 0, 0);

    const oG = -p * base * 0.12;
    ctx.fillStyle = col('ground');
    for (let x = 0; x < lw; x++) {
      const y = Math.round(lh - this.fg[x] + oG);
      ctx.fillRect(x, y, 1, lh - y + Math.ceil(-oG) + 2);
    }

    if (t > 0.25 && nd > 0.01) {
      const ma = (t - 0.25) / 0.75 * nd;
      for (const mo of this.motes) {
        const x = Math.round(mo.x + Math.sin(this.time * mo.sx + mo.ph) * 6);
        const y = Math.round(mo.y + Math.cos(this.time * mo.sy + mo.ph) * 4 + oG * 0.5);
        const a = ma * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 2 + mo.ph)));
        ctx.fillStyle = 'rgba(255,216,160,' + a.toFixed(3) + ')';
        ctx.fillRect(x, y, 1, 1);
      }
    }

    if (!this.reduce) {
      for (const s of this.streaks) {
        s.x -= s.v * dt;
        if (s.x + s.len < 0) { s.x = lw + Math.random() * 40; s.y = Math.floor(Math.random() * lh); }
        ctx.fillStyle = 'rgba(244,238,248,' + s.a + ')';
        ctx.fillRect(Math.round(s.x), s.y, s.len, 1);
      }
    }

    this.drawCompanion(dt, p, oG, dd);
  }

  drawCompanion(dt, p, oG, dd) {
    const ctx = this.ctx, lw = this.lw, lh = this.lh;
    const kind = (this.props && this.props.companion) || 'light';
    const c = this.comp;
    const sx = lw / (window.innerWidth || 1), sy = lh / (window.innerHeight || 1);
    if (c.kind !== kind) { c.kind = kind; c.x = null; }
    const nd = 1 - dd;

    if (kind === 'traveler') {
      const pEl = document.querySelector('[data-paper]');
      const pR = pEl ? Math.max(0, pEl.getBoundingClientRect().right) * lw / (window.innerWidth || 1) : 0;
      const x0w = Math.min(lw - 12, pR + 200 * lw / (window.innerWidth || 1));
      const tx = x0w + (lw - 8 - x0w) * p;
      if (c.x === null) c.x = tx;
      const dx = tx - c.x, sp = 16 * dt;
      c.moving = Math.abs(dx) > 0.6;
      if (this.reduce) c.x = tx; else c.x += Math.max(-sp, Math.min(sp, dx));
      if (Math.abs(dx) > 0.6) c.face = dx > 0 ? 1 : -1;
      const gx = Math.max(0, Math.min(lw - 1, Math.round(c.x)));
      const gy = Math.round(lh - this.fg[gx] + oG);
      const walk = c.moving && !this.reduce && Math.floor(this.time / 0.18) % 2 === 1;
      const top = [
        '..hhh..',
        '.hhhhh.',
        '.hhffh.',
        '.hhhhh.',
        '.ccccc.',
        'cccccc.',
        '.ccccca',
        '.cccc.L'
      ];
      const legs = walk ? ['..cc...', '..c.c..'] : ['.c..c..', '.c..c..'];
      const rows = top.concat(legs);
      const x0 = Math.round(c.x) - 3, y0 = gy - rows.length;
      if (dd > 0.05) {
        ctx.fillStyle = 'rgba(40,30,60,' + (0.28 * dd).toFixed(3) + ')';
        ctx.fillRect(x0 - (c.face > 0 ? 3 : 0), gy, 9, 1);
      }
      const lx = c.face > 0 ? x0 + 6 : x0;
      const ly = y0 + 7;
      if (nd > 0.02) {
        const pulse = 0.85 + 0.15 * Math.sin(this.time * 3.1);
        this.disc(lx, ly, 6, 'rgba(255,212,138,' + (0.05 * pulse * nd).toFixed(3) + ')');
        this.disc(lx, ly, 3, 'rgba(255,212,138,' + (0.12 * pulse * nd).toFixed(3) + ')');
      }
      this.sprite(rows, x0, y0, c.face, { h: '#7B6A98', f: '#EBD6C4', c: '#5E4F7A', a: '#8F7FA6', L: dd > 0.5 ? '#B8A98A' : '#FFD48A' });
      return;
    }

    const vw = window.innerWidth || 1280, vh = window.innerHeight || 800, mid = vh * 0.4;
    const paperEl = document.querySelector('[data-paper]');
    const pr = paperEl ? paperEl.getBoundingClientRect() : { left: vw * 0.1, right: vw * 0.5, top: -1, bottom: vh };
    const els = document.querySelectorAll('[data-anchor]');
    let best = null, bd = 1e9;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const d = Math.abs(r.top - mid);
      if (d < bd) { bd = d; best = r; }
    });
    const ay = best ? best.top : mid;
    const gutterX = Math.min(vw - 30, pr.right + 200);
    let tx, ty, perched = false;
    if (kind === 'bird') { tx = gutterX * sx; ty = Math.max(30, Math.min(vh - 60, ay + 30)) * sy; }
    else { tx = gutterX * sx; ty = Math.max(30, Math.min(vh - 60, ay + 24)) * sy; }
    c.perched = perched;
    if (c.x === null) { c.x = tx; c.y = ty; }
    const kk = this.reduce ? 1 : Math.min(1, dt * 2.4);
    const dx = tx - c.x, dy = ty - c.y;
    c.x += dx * kk; c.y += dy * kk;
    c.moving = Math.abs(dx) + Math.abs(dy) > 1.2;
    if (Math.abs(dx) > 0.8) c.face = dx > 0 ? 1 : -1;

    if (kind === 'bird') {
      const flap = (c.moving || !c.perched) && !this.reduce;
      const f = Math.floor(this.time / (c.moving ? 0.11 : 0.28)) % 2;
      const perched = ['....bb.', '...bbbo', '.bbbbb.', 'bbbbb..', '.bbbb..', '..l.l..'];
      const up = ['bb.....bb', '.bb...bb.', '..bbbbbo.', '...bbb...'];
      const down = ['.........', '..bbbbbo.', '.bb.b.bb.', 'bb.....bb'];
      const rows = flap ? (f ? up : down) : perched;
      const x0 = Math.round(c.x - rows[0].length / 2);
      const y0 = Math.round(c.y) - rows.length;
      const bc = this.css(this.mixc(this.hex('#D7CBE2'), this.hex('#5E5476'), dd));
      this.sprite(rows, x0, y0, c.face, { b: bc, o: '#E9A86F', l: '#8F7FA6' });
      return;
    }

    const wx = this.reduce ? 0 : Math.sin(this.time * 0.8) * 2.4 + Math.sin(this.time * 1.7) * 0.8;
    const wy = this.reduce ? 0 : Math.sin(this.time * 1.1 + 1) * 1.8;
    const x = Math.round(c.x + wx), y = Math.round(c.y + wy);
    if (nd > 0.01) {
      const pulse = (0.8 + 0.2 * Math.sin(this.time * 2.3)) * nd;
      this.disc(x, y, 8, 'rgba(255,214,150,' + (0.035 * pulse).toFixed(3) + ')');
      this.disc(x, y, 5, 'rgba(255,214,150,' + (0.07 * pulse).toFixed(3) + ')');
      this.disc(x, y, 3, 'rgba(255,214,150,' + (0.14 * pulse).toFixed(3) + ')');
      ctx.fillStyle = 'rgba(255,216,154,' + (0.75 * pulse).toFixed(3) + ')';
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = 'rgba(255,243,214,' + nd.toFixed(3) + ')';
      ctx.fillRect(x, y, 1, 1);
    }
    if (dd > 0.01) {
      const a = dd.toFixed(3);
      ctx.fillStyle = 'rgba(150,138,176,' + a + ')';
      ctx.fillRect(x, y + 2, 1, 3);
      ctx.fillStyle = 'rgba(255,255,255,' + (dd * 0.55).toFixed(3) + ')';
      ctx.fillRect(x - 2, y - 1, 1, 1);
      ctx.fillRect(x + 2, y - 1, 1, 1);
      ctx.fillRect(x - 1, y - 2, 1, 1);
      ctx.fillRect(x + 1, y - 2, 1, 1);
      ctx.fillRect(x, y - 3, 1, 1);
      ctx.fillRect(x - 2, y + 1, 1, 1);
      ctx.fillRect(x + 2, y + 1, 1, 1);
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = 'rgba(220,210,232,' + a + ')';
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
