const http = require('http');
const fs = require('fs');
const path = require('path');
const { fetchAll } = require('./feeds');
const { scoreItems } = require('./scoring');
const { handleArticle, handleImage } = require('./gemini');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const cache = new Map();
const TTL = 5 * 60 * 1000;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

async function search(q) {
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const { items, errors, failedAll } = await fetchAll(q);
  if (failedAll) throw new Error('Nenhum feed respondeu: ' + errors.join(' | '));
  const data = { query: q, ...scoreItems(items.slice(0, 80), q), fetchedAt: new Date().toISOString() };
  cache.set(key, { at: Date.now(), data });
  return data;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/search') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    if (q.length < 2) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Digite ao menos duas letras.' })); }
    try { res.end(JSON.stringify(await search(q))); }
    catch (e) { res.statusCode = 502; res.end(JSON.stringify({ error: 'Não consegui consultar as fontes agora.', detail: e.message })); }
    return;
  }
  if (url.pathname === '/api/article' || url.pathname === '/api/image') {
    const handler = url.pathname === '/api/article' ? handleArticle : handleImage;
    const r = await handler(Object.fromEntries(url.searchParams));
    for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
    res.statusCode = r.status;
    return res.end(r.body);
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Não encontrado'); }
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(buf);
  });
});

if (require.main === module) server.listen(PORT, () => console.log(`Confere em http://localhost:${PORT}`));
module.exports = { server };
