// Busca em feeds RSS públicos e transforma em uma lista única.
const decode = s => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, '').trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function parseGoogle(xml) {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const srcTag = b.match(/<source\s+url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i);
    let title = tag(b, 'title');
    const source = srcTag ? decode(srcTag[2]) : '';
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    const pub = tag(b, 'pubDate');
    out.push({
      title,
      link: tag(b, 'link'),
      source,
      host: srcTag ? hostOf(decode(srcTag[1])) : '',
      date: pub ? new Date(pub).toISOString() : null,
      via: 'google'
    });
  }
  return out;
}

function parseBing(xml) {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    let link = tag(b, 'link');
    try {
      const u = new URL(link);
      if (u.searchParams.get('url')) link = u.searchParams.get('url');
    } catch { /* mantém o link original */ }
    const pub = tag(b, 'pubDate');
    out.push({
      title: tag(b, 'title'),
      link,
      source: tag(b, 'News:Source') || hostOf(link),
      host: hostOf(link),
      date: pub ? new Date(pub).toISOString() : null,
      via: 'bing'
    });
  }
  return out;
}

async function get(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; Confere/1.0)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

async function fetchAll(query) {
  const q = encodeURIComponent(query);
  const jobs = [
    get(`https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`).then(parseGoogle),
    get(`https://www.bing.com/news/search?q=${q}&format=rss&setlang=pt-BR&cc=BR`).then(parseBing)
  ];
  const res = await Promise.allSettled(jobs);
  const errors = res.filter(r => r.status === 'rejected').map(r => String(r.reason && r.reason.message || r.reason));
  const items = res.filter(r => r.status === 'fulfilled').flatMap(r => r.value);

  // Remove duplicatas por título normalizado + host.
  const seen = new Set();
  const unique = items.filter(i => {
    if (!i.title) return false;
    const clean = i.source && i.title.endsWith(' - ' + i.source) ? i.title.slice(0, -(i.source.length + 3)) : i.title;
    const k = clean.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { items: unique, errors, failedAll: res.every(r => r.status === 'rejected') };
}

module.exports = { fetchAll, parseGoogle, parseBing };
