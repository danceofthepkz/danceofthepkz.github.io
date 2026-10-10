// Renders content/site.json into dist/index.html and copies static files.
// Zero dependencies: `node scripts/build.mjs` (add --strict to fail on TODOs).
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');
const STATIC = ['styles.css', 'scene.js', 'main.js', 'skylab.js', 'fonts', 'assets'];

// ---------- text helpers ----------
const TODO_RE = /\[TODO:[^\]]*\]/g;
const isTodo = (s) => typeof s === 'string' && /^\[TODO:[^\]]*\]$/.test(s.trim());

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Inline formatting allowed in any text field: [text](url), **bold**, *italic*, [TODO: ...]
function inline(s) {
  let h = esc(s);
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  h = h.replace(TODO_RE, (m) => `<mark class="todo">${m}</mark>`);
  return h;
}

function link({ label, href }) {
  if (!href || isTodo(href)) {
    return `<span class="todo-link" title="${esc(href || '[TODO: link]')}">${inline(label)} <mark class="todo">TODO</mark></span>`;
  }
  return `<a href="${esc(href)}">${inline(label)}</a>`;
}

const linkRow = (links) => (links && links.length)
  ? `<div class="link-row">${links.map(link).join('')}</div>`
  : '';

function thumb(kind, src, alt, placeholder) {
  // The profile photo is above the fold, so only figures load lazily.
  const lazy = kind === 'photo' ? '' : ' loading="lazy"';
  const inner = src ? `<img src="${esc(src)}" alt="${esc(alt || '')}"${lazy}>` : `<span>${placeholder}</span>`;
  return `<div class="thumb thumb--${kind}"${src && alt ? '' : ' aria-hidden="true"'}>${inner}</div>`;
}

// ---------- sections ----------
function renderProfile(p) {
  return `<header class="card" data-anchor="">
${thumb('photo', p.photo, p.photoAlt, 'photo')}
<div class="card-main">
<h1 class="name">${inline(p.name)}</h1>
${p.altName ? `<p class="name-alt" lang="zh-Hans">${inline(p.altName)}</p>` : ''}
<p class="affiliation">${inline(p.affiliation)}</p>
<p class="tagline">${inline(p.tagline)}</p>
${linkRow(p.links)}
</div>
</header>`;
}

function renderResearch(r) {
  const dirs = (r.directions || []).map((d) => `<div class="direction">
<h3>${inline(d.title)}</h3>
<p>${inline(d.text)}</p>
</div>`).join('\n');
  return `<section id="${esc(r.id)}" class="section" data-anchor="" aria-labelledby="${esc(r.id)}-h">
<h2 class="section-title" id="${esc(r.id)}-h">${inline(r.heading)}</h2>
<div class="prose">
${r.paragraphs.map((t) => `<p>${inline(t)}</p>`).join('\n')}
</div>
${dirs ? `<div class="directions">\n${dirs}\n</div>` : ''}
</section>`;
}

function renderPublications(pubs, me) {
  const author = (a) => (a === me ? `<b>${inline(a)}</b>` : inline(a));
  const items = pubs.items.map((it) => `<li class="pub">
${thumb('fig', it.image, it.imageAlt, 'fig.')}
<div class="pub-body">
<h3 class="pub-title">${inline(it.title)}</h3>
<p class="pub-authors">${(it.authors || []).map(author).join(', ')}</p>
${it.venue ? `<p class="pub-venue">${inline(it.venue)}</p>` : ''}
${it.description ? `<p class="pub-desc">${inline(it.description)}</p>` : ''}
${linkRow(it.links)}
</div>
</li>`).join('\n');
  return `<section id="${esc(pubs.id)}" class="section" data-anchor="" aria-labelledby="${esc(pubs.id)}-h">
<h2 class="section-title" id="${esc(pubs.id)}-h">${inline(pubs.heading)}</h2>
<ul class="pubs">
${items}
</ul>
</section>`;
}

function renderContact(c) {
  return `<section id="${esc(c.id)}" class="section contact" data-anchor="" aria-labelledby="${esc(c.id)}-h">
<h2 class="section-title" id="${esc(c.id)}-h">${inline(c.heading)}</h2>
${c.lines.map((l) => `<p${l.id ? ` id="${esc(l.id)}"` : ''}>${inline(l.text)}</p>`).join('\n')}
</section>`;
}

// ---------- TODO report ----------
function findTodos(node, path = '', out = []) {
  if (typeof node === 'string') {
    for (const m of node.match(TODO_RE) || []) out.push(`${path}: ${m}`);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) findTodos(v, Array.isArray(node) ? `${path}[${k}]` : (path ? `${path}.${k}` : k), out);
  }
  return out;
}

// ---------- build ----------
export function build({ strict = false, quiet = false } = {}) {
  const data = JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8'));
  const { site, profile } = data;

  const version = createHash('sha1')
    .update(readFileSync(join(SRC, 'styles.css')))
    .update(readFileSync(join(SRC, 'scene.js')))
    .update(readFileSync(join(SRC, 'main.js')))
    .update(readFileSync(join(SRC, 'skylab.js')))
    .digest('hex').slice(0, 8);

  const tpl = readFileSync(join(SRC, 'index.template.html'), 'utf8');

  // base: '' for the home page, '../' for pages one folder down (e.g. portfolio/).
  // Easter egg at the bottom of the home page; its script loads only when opened (main.js).
  const SKYLAB = `<details class="skylab" id="sky-lab">
<summary>Play with the sky</summary>
<div class="skylab-body">
<div class="skylab-modes" role="group" aria-label="Sky model">
<button type="button" data-mode="0" aria-pressed="true">This site</button>
<button type="button" data-mode="1" aria-pressed="false">Atmosphere</button>
<button type="button" data-mode="2" aria-pressed="false">Warped clouds</button>
<button type="button" data-mode="3" aria-pressed="false">Aurora</button>
</div>
<canvas class="skylab-canvas" role="img" aria-label="Pixel sky"></canvas>
<p class="skylab-note" data-note aria-live="polite"></p>
<div class="skylab-controls">
<label>Sun height <input type="range" name="sun" min="-20" max="60" step="1" value="4"> <output data-sun-out>4°</output></label>
<label>Colour levels <input type="range" name="levels" min="2" max="12" step="1" value="8"> <output data-levels-out>8</output></label>
<label><input type="checkbox" name="dither" checked> Dither</label>
</div>
<p class="skylab-hint">Drag across the sky to move the sun.</p>
</div>
</details>`;

  function renderPage({ base = '', path = '', title = site.title, body, extra = '' }) {
    // Relative links in shared parts (nav) must point back up from subpages.
    const href = (h) => (base && !/^([a-z]+:|\/)/i.test(h) ? base + h : h);
    const slots = {
      base,
      title: esc(title),
      siteTitle: esc(site.title),
      description: esc(site.description),
      url: esc(site.url),
      canonical: esc(site.url + path),
      name: esc(profile.name),
      version,
      nav: data.nav.map((n) => `<a href="${esc(href(n.href))}"${path && n.href === path ? ' aria-current="page"' : ''}>${inline(n.label)}</a>`).join('\n'),
      body,
      extra,
      lastUpdated: inline(site.lastUpdated),
      footerNote: inline(site.footerNote)
    };
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
      if (!(k in slots)) throw new Error(`Unknown template slot ${m}`);
      return slots[k];
    });
  }

  const home = renderPage({
    body: [
      renderProfile(profile),
      renderResearch(data.research),
      renderPublications(data.publications, profile.me),
      renderContact(data.contact)
    ].join('\n\n'),
    extra: SKYLAB
  });

  const pages = (data.pages || []).map((pg) => ({
    dir: pg.path,
    html: renderPage({
      base: '../',
      path: pg.path + '/',
      title: `${pg.heading} · ${site.title}`,
      body: `<section id="${esc(pg.path)}" class="section page-solo" data-anchor="" aria-labelledby="${esc(pg.path)}-h">
<h2 class="section-title" id="${esc(pg.path)}-h">${inline(pg.heading)}</h2>
<div class="prose">
${pg.paragraphs.map((t) => `<p>${inline(t)}</p>`).join('\n')}
</div>
</section>`
    })
  }));

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const f of STATIC) if (existsSync(join(SRC, f))) cpSync(join(SRC, f), join(OUT, f), { recursive: true });
  writeFileSync(join(OUT, 'index.html'), home);
  for (const pg of pages) {
    mkdirSync(join(OUT, pg.dir), { recursive: true });
    writeFileSync(join(OUT, pg.dir, 'index.html'), pg.html);
  }
  writeFileSync(join(OUT, '.nojekyll'), '');

  const todos = findTodos(data);
  if (!quiet) {
    console.log(`Built dist/ (${todos.length} TODO${todos.length === 1 ? '' : 's'} left)`);
    for (const t of todos) console.log('  - ' + t);
  }
  if (strict && todos.length) {
    console.error('Strict mode: fill in the TODOs above before deploying.');
    process.exit(1);
  }
  return todos;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  build({ strict: process.argv.includes('--strict') || process.env.STRICT_TODOS === '1' });
}
