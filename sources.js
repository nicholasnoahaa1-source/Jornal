// Lista editorial de fontes. Edite à vontade: o placar usa só isso, sem IA.
// tier A: imprensa de referência e agências. B: grandes portais e veículos
// especializados. D: sátira ou fonte sabidamente pouco confiável.
// Domínio fora da lista fica neutro (tier C).
const TIERS = {
  A: [
    'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'agenciabrasil.ebc.com.br',
    'g1.globo.com', 'oglobo.globo.com', 'folha.uol.com.br', 'estadao.com.br',
    'nytimes.com', 'theguardian.com', 'elpais.com', 'valor.globo.com',
    'cnnbrasil.com.br', 'nexojornal.com.br', 'gazetadopovo.com.br', 'correiobraziliense.com.br',
    'aosfatos.org', 'lupa.news', 'efe.com', 'afp.com', 'dw.com', 'france24.com',
    'ge.globo.com', 'espn.com.br', 'cbf.com.br', 'fifa.com'
  ],
  B: [
    'uol.com.br', 'noticias.uol.com.br', 'terra.com.br', 'metropoles.com', 'band.uol.com.br',
    'veja.abril.com.br', 'istoe.com.br', 'exame.com', 'infomoney.com.br', 'r7.com',
    'record.r7.com', 'sbt.com.br', 'cnnportugal.iol.pt', 'publico.pt', 'observador.pt',
    'lance.com.br', 'gazetaesportiva.com', 'trivela.com.br', 'jovempan.com.br',
    'brasildefato.com.br', 'cartacapital.com.br', 'poder360.com.br', 'msn.com',
    'yahoo.com', 'br.noticias.yahoo.com', 'marca.com', 'as.com', 'goal.com', 'ig.com.br',
    'otempo.com.br', 'em.com.br', 'zerohora.com.br', 'gauchazh.clicrbs.com.br', 'nsctotal.com.br',
    'diariodepernambuco.com.br', 'folhape.com.br', 'opovo.com.br', 'correio24horas.com.br'
  ],
  D: [
    'sensacionalista.com.br', 'sensacionalista.folha.uol.com.br', 'theonion.com',
    'piaui.folha.uol.com.br', 'huffpostbrasil.com', 'diariodobrasil.org',
    'folhapolitica.org', 'tribunadainternet.com.br', 'jornaldacidadeonline.com.br'
  ]
};

const SATIRE = new Set(['sensacionalista.com.br', 'sensacionalista.folha.uol.com.br', 'theonion.com']);

const BASE = { A: 100, B: 75, C: 45, D: 10 };

function normalizeHost(host) {
  return String(host || '').toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
}

function matchHost(host, list) {
  return list.some(d => host === d || host.endsWith('.' + d));
}

function classify(host) {
  host = normalizeHost(host);
  if (!host) return { tier: 'C', base: BASE.C, satire: false };
  for (const tier of ['D', 'A', 'B']) {
    if (matchHost(host, TIERS[tier])) {
      return { tier, base: BASE[tier], satire: [...SATIRE].some(s => host === s || host.endsWith('.' + s)) };
    }
  }
  return { tier: 'C', base: BASE.C, satire: false };
}

module.exports = { classify, normalizeHost, TIERS };
