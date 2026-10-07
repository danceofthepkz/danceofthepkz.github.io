// Local preview: rebuilds on every page load, serves dist/ at http://localhost:8000
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { build } from './build.mjs';

const OUT = new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 8000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain' };

build();
createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  if (path === '/index.html') { try { build({ quiet: true }); } catch (e) { console.error(e.message); } }
  const file = normalize(join(OUT, path));
  if (!file.startsWith(OUT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}/`));
