const $ = id => document.getElementById(id);
const TIER = { A: 'Referência', B: 'Portal', C: 'Fora da lista', D: 'Sátira / duvidosa' };
const SECTIONS = [
  { id: 'brasil', q: 'Brasil' },
  { id: 'mundo', q: 'mundo internacional' },
  { id: 'politica', q: 'política' },
  { id: 'economia', q: 'economia' },
  { id: 'esporte', q: 'esporte' },
  { id: 'cultura', q: 'cultura' },
  { id: 'ciencia', q: 'ciência' }
];
let current = null;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('today').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function ago(iso) {
  if (!iso) return 'sem data';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return `há ${Math.max(m, 1)} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  const d = Math.round(m / 1440);
  if (d < 31) return `há ${d} dia${d > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}
const clock = iso => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

/* Pega as melhores matérias por nota e reordena da mais nova para a mais antiga. */
function pick(items, n) {
  const seen = new Set();
  const good = items.filter(i => i.tier !== 'D' && !i.denies && i.date).filter(i => {
    const k = i.title.toLowerCase().slice(0, 48);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  return good.slice(0, n * 2).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, n);
}

const byline = i => `<div class="meta"><b>${esc(i.source || i.host || 'Fonte desconhecida')}</b> · <span class="t">${ago(i.date)}</span></div>`;
const art = i => 'article.html?' + new URLSearchParams({ t: i.title, s: i.source || i.host || '', l: i.link || '', d: i.date || '' });
const link = i => `<span class="hl"><a href="${esc(art(i))}">${esc(i.title)}</a></span>`;
const story = (i, big) => `<article class="story${big ? ' big' : ''}">${link(i)}${byline(i)}</article>`;
const skel = n => Array.from({ length: n }, () => '<div class="skel"></div>').join('');
const none = '<p class="empty">Sem matérias agora. Tente recarregar em alguns minutos.</p>';

function paint(id, items) {
  if (id === 'brasil') {
    const [lead, ...rest] = items;
    $('lead').innerHTML = lead ? `${byline(lead)}<h2 class="hl"><a href="${esc(art(lead))}">${esc(lead.title)}</a></h2>` : none;
    $('subs').innerHTML = rest.slice(0, 2).map(i => `<article class="sub">${byline(i)}<h3 class="hl"><a href="${esc(art(i))}">${esc(i.title)}</a></h3></article>`).join('');
    $('latest').innerHTML = rest.slice(2, 10).map(i => `<li><span class="when">${clock(i.date)}</span><div>${link(i)}<div class="meta">${esc(i.source || i.host)}</div></div></li>`).join('');
  } else if (id === 'esporte') {
    $('s-esporte').innerHTML = items.slice(0, 5).map((i, k) => `<li><span class="n">${String(k + 1).padStart(2, '0')}</span><div>${link(i)}${byline(i)}</div></li>`).join('') || `<li>${none}</li>`;
  } else if (id === 'mundo') {
    $('s-mundo').innerHTML = items.slice(0, 8).map(i => story(i)).join('') || none;
  } else {
    $('s-' + id).innerHTML = items.slice(0, 5).map((i, k) => story(i, k === 0)).join('') || none;
  }
}

async function loadFront() {
  ['lead', 'latest', 's-politica', 's-economia', 's-esporte', 's-mundo', 's-cultura', 's-ciencia'].forEach(id => { $(id).innerHTML = skel(3); });
  await Promise.all(SECTIONS.map(async s => {
    try {
      const r = await fetch('/api/search?q=' + encodeURIComponent(s.q));
      if (!r.ok) throw new Error();
      const data = await r.json();
      paint(s.id, pick(data.items, s.id === 'brasil' ? 10 : 8));
    } catch {
      paint(s.id, []);
    }
  }));
}

/* busca */
function paintResults(q, items) {
  $('results-h').innerHTML = `Resultados para <span class="q">${esc(q)}</span>`;
  $('results-list').innerHTML = items.length ? items.map(i => `<li>
      <span class="when">${ago(i.date)}</span>
      <div>${link(i)}<div class="meta"><b>${esc(i.source || i.host || 'Fonte desconhecida')}</b></div></div>
    </li>`).join('') : '<li class="empty">Nada encontrado para essa busca. Tente outras palavras.</li>';
}

async function runSearch(q) {
  q = q.trim();
  if (q.length < 2) return;
  $('sq').value = q;
  history.replaceState(null, '', '?busca=' + encodeURIComponent(q));
  $('results').hidden = false;
  $('results-h').innerHTML = `Buscando <span class="q">${esc(q)}</span>`;
  $('results-list').innerHTML = skel(4);
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const r = await fetch('/api/search?q=' + encodeURIComponent(q));
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erro');
    paintResults(q, pick(data.items, 20));
  } catch (e) {
    $('results-h').textContent = 'Busca indisponível';
    $('results-list').innerHTML = `<li class="empty">${esc(e.message)}</li>`;
  }
}

$('search').addEventListener('submit', e => { e.preventDefault(); runSearch($('sq').value); });
$('clear').addEventListener('click', () => {
  $('results').hidden = true; $('sq').value = '';
  history.replaceState(null, '', location.pathname);
});

/* conferir */
function setStatus(html, err) {
  const s = $('status');
  s.className = 'status' + (err ? ' err' : '');
  s.innerHTML = html;
  s.hidden = !html;
}

function render() {
  if (!current) return;
  const { summary: s, items } = current;
  const hide = $('hideUnknown').checked;
  const shown = items.filter(i => !(hide && i.tier === 'C'));

  $('verdict').className = 'verdict ' + s.level;
  $('verdict').innerHTML = `
    <div class="num">${s.claim}<small>de 100, cobertura</small></div>
    <div class="txt">
      <h3>${esc(s.label)}</h3>
      <p>${esc(s.note)}</p>
      <div class="facts">
        <span><b>${s.relevant}</b> matérias sobre o tema</span>
        <span><b>${s.sourcesA}</b> de referência</span>
        <span><b>${s.sourcesAB}</b> fontes conhecidas</span>
        <span><b>${s.denials}</b> com termo de boato</span>
      </div>
    </div>`;

  $('count').textContent = `${shown.length} manchete${shown.length === 1 ? '' : 's'}, da mais à menos confiável`;
  $('list').innerHTML = shown.length ? shown.map(i => {
    const cls = i.score >= 70 ? 'hi' : i.score >= 40 ? 'md' : 'lo';
    return `<li class="row">
      <div class="score ${cls}" title="Pontuação da matéria">${i.score}</div>
      <div>
        <h3><a href="${esc(art(i))}">${esc(i.title)}</a></h3>
        <div class="rmeta">
          <span class="src">${esc(i.source || i.host || 'Fonte desconhecida')}</span>
          <span class="badge ${i.tier}">${TIER[i.tier]}</span>
          <span>${ago(i.date)}</span>
          ${i.denies ? '<span class="flag">Fala em boato ou desmentido</span>' : ''}
          ${i.match < 0.67 ? '<span>Manchete foge do tema</span>' : ''}
        </div>
        <div class="parts">
          <span>fonte <b>${i.parts.fonte}</b>/60</span>
          <span>aderência <b>${i.parts.aderencia}</b>/20</span>
          <span>recência <b>${i.parts.recencia}</b>/10</span>
          <span>corroboração <b>${i.parts.corroboracao}</b>/10</span>
        </div>
      </div>
    </li>`;
  }).join('') : '<li class="empty">Nada para mostrar com esse filtro.</li>';
}

async function run(q) {
  q = q.trim();
  if (q.length < 2) return;
  $('q').value = q;
  history.replaceState(null, '', '?q=' + encodeURIComponent(q) + '#conferir');
  $('out').hidden = true;
  setStatus('Consultando as fontes...');
  try {
    const r = await fetch('/api/search?q=' + encodeURIComponent(q));
    const data = await r.json();
    if (!r.ok) throw Object.assign(new Error(data.error || 'Erro'), { detail: data.detail });
    current = data;
    setStatus('');
    $('out').hidden = false;
    render();
  } catch (e) {
    setStatus(`${esc(e.message)}${e.detail ? `<span class="detail">${esc(e.detail)}</span>` : ''}`, true);
  }
}

$('form').addEventListener('submit', e => { e.preventDefault(); run($('q').value); });
$('hideUnknown').addEventListener('change', render);
document.querySelectorAll('.try a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); run(a.dataset.q); }));

loadFront();
const params = new URLSearchParams(location.search);
if (params.get('busca')) runSearch(params.get('busca'));
else if (params.get('q')) run(params.get('q'));
