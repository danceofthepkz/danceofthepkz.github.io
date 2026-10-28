// Renders content/site.json into dist/ (home page, case-study pages, extra pages) and copies static files.
// Zero dependencies: `node scripts/build.mjs` (add --strict to fail on TODOs).
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');
const STATIC = ['styles.css', 'scene.js', 'main.js', 'skylab.js', 'assets'];

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

function thumb(kind, src, alt, placeholder, fit) {
  // The profile photo is above the fold, so only figures load lazily.
  const lazy = kind === 'photo' ? '' : ' loading="lazy"';
  const inner = src ? `<img src="${esc(src)}" alt="${esc(alt || '')}"${lazy}>` : `<span>${placeholder}</span>`;
  // fit "contain" shows the whole image (portrait or square figures) on a white mat instead of cropping.
  const cls = `thumb thumb--${kind}${src && fit === 'contain' ? ' thumb--contain' : ''}`;
  return `<div class="${cls}"${src && alt ? '' : ' aria-hidden="true"'}>${inner}</div>`;
}

// ---------- sections ----------
const paras = (list) => (list || []).map((t) => `<p>${inline(t)}</p>`).join('\n');
const authorList = (authors, me) => (authors || []).map((a) => (a === me ? `<b>${inline(a)}</b>` : inline(a))).join(', ');
const kindTags = (kinds) => (kinds || []).map((k) => `<span class="kind kind--${esc(k.toLowerCase())}">${inline(k)}</span>`).join('');

// Home hero: the pixel scene lives here only; the rest of the site is plain paper.
function renderHero(hero, p) {
  return `<section class="hero" aria-labelledby="hero-name">
<canvas class="scene" data-scene="" aria-hidden="true"></canvas>
<div class="wrap hero-inner">
<div class="hero-copy" data-paper="" data-anchor="">
${thumb('photo', p.photo, p.photoAlt, 'photo')}
${hero.kicker ? `<p class="kicker">${inline(hero.kicker)}</p>` : ''}
<h1 class="name" id="hero-name">${inline(p.name)}</h1>
${p.altName ? `<p class="name-alt" lang="zh-Hans">${inline(p.altName)}</p>` : ''}
<p class="affiliation">${inline(p.affiliation)}</p>
${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
${linkRow(p.links)}
</div>
</div>
</section>`;
}

function renderApproach(a, work) {
  const name = Object.fromEntries(work.items.map((w) => [w.slug, w.name]));
  const items = a.items.map((it, i) => `<div class="approach-item">
<p class="label">${String(i + 1).padStart(2, '0')} · ${inline(it.label)}</p>
<h3>${inline(it.title)}</h3>
<p>${inline(it.text)}</p>
<p class="approach-projects">${(it.projects || []).map((s) => `<a href="#work-${esc(s)}">${inline(name[s] || s)}</a>`).join('<span aria-hidden="true"> · </span>')}</p>
</div>`).join('\n');
  return `<section id="${esc(a.id)}" class="sec sec--approach" aria-label="Approach">
<div class="wrap approach">
${items}
</div>
</section>`;
}

function renderWork(work, me) {
  const cards = work.items.map((w) => {
    const page = w.detail ? `work/${w.slug}/` : null;
    return `<article class="work-card" id="work-${esc(w.slug)}">
${thumb('card', w.image, w.imageAlt, 'figure', w.imageFit)}
<div class="work-text">
<p class="work-meta"><span>${inline(w.meta)}</span>${kindTags(w.kinds)}</p>
<h3 class="work-name">${page ? `<a href="${page}">${inline(w.name)}</a>` : inline(w.name)}</h3>
<p class="work-tags">${inline(w.tags)}</p>
<p class="work-claim">${inline(w.claim)}</p>
<p class="work-authors">${authorList(w.authors, me)}</p>
${linkRow([...(page ? [{ label: 'Case study →', href: page }] : []), ...(w.links || [])])}
</div>
</article>`;
  }).join('\n');
  return `<section id="${esc(work.id)}" class="sec" aria-labelledby="${esc(work.id)}-h">
<div class="wrap">
<div class="sec-head"><h2 id="${esc(work.id)}-h">${inline(work.heading)}</h2>${work.aside ? `<p class="label">${inline(work.aside)}</p>` : ''}</div>
<div class="work-grid">
${cards}
</div>
</div>
</section>`;
}

function renderResearch(r) {
  const dirs = (r.directions || []).map((d) => `<div class="direction">
<h3>${inline(d.title)}</h3>
<p>${inline(d.text)}</p>
</div>`).join('\n');
  return `<section id="${esc(r.id)}" class="sec" aria-labelledby="${esc(r.id)}-h">
<div class="wrap split">
<h2 id="${esc(r.id)}-h">${inline(r.heading)}</h2>
<div>
<div class="prose">
${paras(r.paragraphs)}
</div>
${dirs ? `<div class="directions">\n${dirs}\n</div>` : ''}
</div>
</div>
</section>`;
}

function renderExperience(x) {
  return `<section id="${esc(x.id)}" class="sec" aria-labelledby="${esc(x.id)}-h">
<div class="wrap split">
<h2 id="${esc(x.id)}-h">${inline(x.heading)}</h2>
<ol class="exp">
${x.items.map((e) => `<li>
<p class="exp-dates label">${inline(e.dates || '')}</p>
<div>
<p class="exp-role">${inline(e.role)}${e.org ? `, ${e.href ? `<a href="${esc(e.href)}">${inline(e.org)}</a>` : inline(e.org)}` : ''}</p>
${e.location ? `<p class="exp-loc">${inline(e.location)}</p>` : ''}
${e.text ? `<p class="exp-text">${inline(e.text)}</p>` : ''}
</div>
</li>`).join('\n')}
</ol>
</div>
</section>`;
}

function renderCitations(items, me) {
  return `<ol class="cites">
${items.map((c) => `<li>
<p class="cite-title">${inline(c.title)}</p>
<p class="cite-authors">${authorList(c.authors, me)}</p>
<p class="cite-venue">${inline(c.venue)}</p>
${linkRow(c.links)}
</li>`).join('\n')}
</ol>`;
}

function renderPublications(pubs, me) {
  return `<section id="${esc(pubs.id)}" class="sec" aria-labelledby="${esc(pubs.id)}-h">
<div class="wrap split">
<h2 id="${esc(pubs.id)}-h">${inline(pubs.heading)}</h2>
<div>
${renderCitations(pubs.items, me)}
${pubs.working && pubs.working.length ? `<p class="label cites-sub">${inline(pubs.workingHeading || 'In progress')}</p>\n${renderCitations(pubs.working, me)}` : ''}
</div>
</div>
</section>`;
}

function renderContact(c) {
  return `<section id="${esc(c.id)}" class="sec" aria-labelledby="${esc(c.id)}-h">
<div class="wrap split">
<h2 id="${esc(c.id)}-h">${inline(c.heading)}</h2>
<div class="prose">
${c.lines.map((l) => `<p${l.id ? ` id="${esc(l.id)}"` : ''}>${inline(l.text)}</p>`).join('\n')}
</div>
</div>
</section>`;
}

// Case-study page for a work item with a `detail` block. `base` prefixes relative asset paths.
function renderCase(w, me, base) {
  const d = w.detail;
  const img = (src) => (src && !/^([a-z]+:|\/)/i.test(src) ? base + src : src);
  const fig = w.image ? `<figure class="case-fig">
<img src="${esc(img(w.image))}" alt="${esc(w.imageAlt || '')}">
${d.figureCaption ? `<figcaption>${inline(d.figureCaption)}</figcaption>` : ''}
</figure>` : '';
  const table = d.table ? `<div class="case-table"><table>
<caption>${inline(d.table.caption)}</caption>
<thead><tr>${d.table.head.map((h) => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead>
<tbody>${d.table.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`).join('')}</tbody>
</table></div>` : '';
  const secs = d.sections.map((sec, i) => `<section class="case-sec">
<h2>${inline(sec.heading)}</h2>
<div class="prose">
${paras(sec.paragraphs)}
${sec.heading === 'Approach' ? table : ''}
${sec.figure ? fig : ''}
</div>
</section>`).join('\n');
  return `<article class="case">
<header class="wrap case-head">
<p class="label"><a href="${base}#work">← All work</a></p>
<p class="work-meta"><span>${inline(w.meta)}</span>${kindTags(w.kinds)}</p>
<h1 class="case-title">${inline(w.title)}</h1>
<p class="case-lead">${inline(d.lead || w.claim)}</p>
<p class="work-authors">${authorList(w.authors, me)}</p>
${linkRow(w.links)}
</header>
<div class="wrap case-body">
${secs}
</div>
</article>`;
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

  function renderPage({ base = '', path = '', title = site.title, body, extra = '', mainClass = 'page-plain' }) {
    // Relative links in shared parts (nav) must point back up from subpages.
    const href = (h) => (base && !/^([a-z]+:|\/)/i.test(h) ? base + h : h);
    const slots = {
      base,
      home: base || './',
      brand: esc(profile.me),
      mainClass,
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
    mainClass: 'page-home',
    body: [
      renderHero(data.hero, profile),
      renderApproach(data.approach, data.work),
      renderWork(data.work, profile.me),
      renderResearch(data.research),
      ...(data.experience ? [renderExperience(data.experience)] : []),
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
      body: `<section class="sec sec--solo" aria-labelledby="${esc(pg.path)}-h">
<div class="wrap split">
<h1 class="solo-title" id="${esc(pg.path)}-h">${inline(pg.heading)}</h1>
<div class="prose">
${paras(pg.paragraphs)}
</div>
</div>
</section>`
    })
  }));
  for (const w of data.work.items.filter((x) => x.detail)) {
    pages.push({
      dir: `work/${w.slug}`,
      html: renderPage({ base: '../../', path: `work/${w.slug}/`, title: `${w.name} · ${site.title}`, body: renderCase(w, profile.me, '../../') })
    });
  }

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
