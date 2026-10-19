const $ = id => document.getElementById(id);
const TIER = { A: 'Referência', B: 'Portal', C: 'Fora da lista', D: 'Sátira / duvidosa' };
let current = null;

$('today').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function ago(iso) {
  if (!iso) return 'sem data';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return `há ${Math.max(m, 1)} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  const d = Math.round(m / 1440);
  if (d < 31) return `há ${d} dia${d > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
        <h3><a href="${esc(i.link)}" target="_blank" rel="noopener noreferrer">${esc(i.title)}</a></h3>
        <div class="meta">
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
  history.replaceState(null, '', '?q=' + encodeURIComponent(q));
  $('out').hidden = true;
  setStatus('Consultando as fontes...');
  try {
    const r = await fetch('/api/search?q=' + encodeURIComponent(q));
    const data = await r.json();
    if (!r.ok) throw Object.assign(new Error(data.error || 'Erro'), { detail: data.detail });
    current = data;
    setStatus('');
    $('out').hidden = false;
    $('method').hidden = false;
    render();
    $('out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    setStatus(`${esc(e.message)}${e.detail ? `<span class="detail">${esc(e.detail)}</span>` : ''}`, true);
  }
}

$('form').addEventListener('submit', e => { e.preventDefault(); run($('q').value); });
$('hideUnknown').addEventListener('change', render);
document.querySelectorAll('.try a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); run(a.dataset.q); }));

const initial = new URLSearchParams(location.search).get('q');
if (initial) run(initial);
