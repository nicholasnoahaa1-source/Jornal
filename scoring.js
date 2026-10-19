// Pontuação por regras. Nenhum modelo de linguagem, só contagem e pesos fixos.
const { classify, normalizeHost } = require('./sources');

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'e', 'em', 'no', 'na',
  'nos', 'nas', 'um', 'uma', 'para', 'por', 'com', 'que', 'se', 'foi', 'ser', 'sobre', 'the', 'of', 'and']);

const DENIAL = ['falso', 'falsa', 'fake', 'boato', 'desmente', 'desmentiu', 'desmentido', 'nega ',
  'negou', 'não morreu', 'nao morreu', 'montagem', 'golpe', 'checagem', 'é #fake', 'hoax', 'false', 'debunk'];

const REL = 0.67; // fração mínima dos termos da busca na manchete
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function terms(query) {
  return strip(query).split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP.has(t));
}

function titleMatch(title, qTerms) {
  if (!qTerms.length) return 1;
  const t = strip(title);
  const hit = qTerms.filter(q => t.includes(q)).length;
  return hit / qTerms.length;
}

function recencyPoints(dateIso, now) {
  if (!dateIso) return 0;
  const days = (now - new Date(dateIso).getTime()) / 864e5;
  if (days < 0) return 10;
  if (days <= 2) return 10;
  if (days <= 7) return 8;
  if (days <= 30) return 5;
  if (days <= 180) return 2;
  return 0;
}

function scoreItems(items, query, now = Date.now()) {
  const qTerms = terms(query);
  const enriched = items.map(it => {
    const host = normalizeHost(it.host);
    const cls = classify(host);
    const match = titleMatch(it.title, qTerms);
    const t = strip(it.title);
    const denies = DENIAL.some(w => t.includes(w));
    return { ...it, host, tier: cls.tier, satire: cls.satire, match, denies };
  });

  // Quantas fontes distintas e não satíricas tratam do mesmo assunto.
  const goodHosts = new Set(enriched.filter(e => e.match >= REL && !e.satire && e.tier !== 'D').map(e => e.host));
  const corroboration = goodHosts.size;
  const corrPoints = Math.min(10, corroboration * 2);

  const scored = enriched.map(e => {
    const sourcePts = Math.round(e.tier === 'D' ? classify(e.host).base * 0.5 : classify(e.host).base * 0.6);
    const matchPts = Math.round(e.match * 20);
    const recPts = recencyPoints(e.date, now);
    let score = sourcePts + matchPts + recPts + corrPoints;
    if (e.satire) score = Math.min(score, 15);
    if (e.match < 0.34) score = Math.min(score, 35);
    else if (e.match < REL) score = Math.min(score, 55);
    score = Math.max(0, Math.min(100, score));
    return { ...e, score, parts: { fonte: sourcePts, aderencia: matchPts, recencia: recPts, corroboracao: corrPoints } };
  });

  scored.sort((a, b) => b.score - a.score || new Date(b.date || 0) - new Date(a.date || 0));
  return { items: scored, summary: summarize(scored, corroboration) };
}

function summarize(items, corroboration) {
  const relevant = items.filter(i => i.match >= REL);
  const tierAB = new Set(relevant.filter(i => i.tier === 'A' || i.tier === 'B').map(i => i.host));
  const tierA = new Set(relevant.filter(i => i.tier === 'A').map(i => i.host));
  const denials = relevant.filter(i => i.denies);
  const satire = relevant.filter(i => i.satire);

  let level, label, note, claim;
  if (!relevant.length) {
    level = 'none'; claim = 0;
    label = 'Sem cobertura encontrada';
    note = 'Nenhum veículo publicou algo que bata com os termos buscados. Pode ser boato, pode ser assunto novo demais.';
  } else if (denials.length && denials.length >= Math.ceil(relevant.length / 3)) {
    level = 'denied'; claim = 12;
    label = 'Há indícios de boato ou desmentido';
    note = `${denials.length} de ${relevant.length} manchetes falam em falso, boato ou desmentido. Leia essas antes de compartilhar.`;
  } else if (tierA.size >= 2 && tierAB.size >= 3) {
    level = 'high'; claim = Math.min(95, 70 + tierAB.size * 3);
    label = 'Coberto por várias fontes sólidas';
    note = `${tierA.size} veículos de referência e ${tierAB.size} fontes ao todo tratam do assunto. A busca mostra cobertura, leia as matérias para confirmar o que cada uma afirma.`;
  } else if (tierAB.size >= 1) {
    level = 'mid'; claim = 45 + tierAB.size * 8;
    label = 'Cobertura parcial';
    note = `Só ${tierAB.size} fonte${tierAB.size > 1 ? 's' : ''} conhecida${tierAB.size > 1 ? 's' : ''} no assunto. Espere por confirmação de outros veículos.`;
  } else {
    level = 'low'; claim = 20;
    label = 'Apenas fontes desconhecidas';
    note = 'O assunto aparece só em sites que não estão na nossa lista de fontes. Desconfie até um veículo de referência confirmar.';
  }
  if (satire.length && level !== 'none') note += ' Parte dos resultados vem de sites de humor.';
  return { level, label, note, claim, total: items.length, relevant: relevant.length,
    sourcesAB: tierAB.size, sourcesA: tierA.size, denials: denials.length };
}

module.exports = { scoreItems, terms };
