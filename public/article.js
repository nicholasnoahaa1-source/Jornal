const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p = new URLSearchParams(location.search);
const src = { title: p.get('t') || '', source: p.get('s') || '', link: p.get('l') || '', date: p.get('d') || '' };

$('today').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const VERDICT = {
  confiavel: { label: 'Confiável', cls: 'ok' },
  parcial: { label: 'Parcialmente confiável', cls: 'mid' },
  pouco_confiavel: { label: 'Pouco confiável', cls: 'bad' },
  nao_verificado: { label: 'Não foi possível verificar', cls: 'mid' }
};

const origin = src.link ? `<a href="${esc(src.link)}" target="_blank" rel="noopener noreferrer">Abrir a matéria original</a>` : '';

function waiting() {
  $('art').innerHTML = `
    <section class="wait">
      <p class="meta">Apurando</p>
      <h1>${esc(src.title)}</h1>
      <p class="wait-note">O Gemini está pesquisando o assunto, lendo a matéria e cruzando as fontes. Leva de 20 a 40 segundos.</p>
      <div class="skel"></div><div class="skel"></div><div class="skel"></div>
    </section>`;
}

function failed(msg) {
  $('art').innerHTML = `
    <section class="wait">
      <p class="meta">Não deu</p>
      <h1>${esc(src.title || 'Matéria indisponível')}</h1>
      <p class="wait-note">${esc(msg)}</p>
      <p class="again"><a href="" onclick="location.reload();return false">Tentar de novo</a> ${origin}</p>
    </section>`;
}

function render({ article: a, sources, imageUrl }) {
  const v = VERDICT[a.veredito];
  const list = items => items.map(i => `<li>${esc(i)}</li>`).join('');
  document.title = a.titulo + ', Confere';
  $('art').innerHTML = `
    <article class="piece">
      <div class="head">
        <p class="meta"><b>${esc(src.source || 'Fonte desconhecida')}</b><span>Apurada a partir da manchete: <em>${esc(src.title)}</em></span></p>
        <h1>${esc(a.titulo)}</h1>
        ${a.linhaFina ? `<p class="deck">${esc(a.linhaFina)}</p>` : ''}
      </div>
      <div class="text">
        ${imageUrl ? `<figure class="fig"><img src="${esc(imageUrl)}" alt="${esc(a.legendaImagem || 'Ilustração gerada por IA')}" onerror="this.closest('figure').hidden=true"><figcaption>${esc(a.legendaImagem || '')} <span>Ilustração gerada por IA.</span></figcaption></figure>` : ''}
        ${a.corpo.map(t => `<p>${esc(t)}</p>`).join('')}
        <p class="disclose">Esta matéria foi escrita por IA (Gemini) depois de pesquisar o assunto na web. Não é reportagem original e pode conter erros.</p>
      </div>
      <aside class="side">
        <section class="verdict-box ${v.cls}">
          <h2>Confiabilidade</h2>
          <p class="v">${v.label}</p><span class="rule"></span>
          <p>${esc(a.resumoVeredito)}</p>
          ${a.motivos.length ? `<h3>Por quê</h3><ul>${list(a.motivos)}</ul>` : ''}
          ${a.alertas.length ? `<h3 class="warn-h">Atenção</h3><ul class="warn-l">${list(a.alertas)}</ul>` : ''}
          ${a.leituraDaMateria ? `<p class="read">Leitura da matéria original: ${esc(a.leituraDaMateria)}.</p>` : ''}
        </section>
        <section class="sources">
          <h2>Fontes consultadas</h2>
          <ol>${sources.map(s => `<li><a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join('')}</ol>
          <p class="origin">${origin}</p>
        </section>
      </aside>
    </article>`;
}

async function load() {
  if (src.title.length < 8) return failed('Manchete ausente. Volte à capa e escolha uma matéria.');
  waiting();
  try {
    const qs = new URLSearchParams({ title: src.title, source: src.source, link: src.link, date: src.date });
    const r = await fetch('/api/article?' + qs);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Erro ao gerar a matéria.');
    render(data);
  } catch (e) {
    failed(e.message);
  }
}
load();
