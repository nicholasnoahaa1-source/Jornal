const assert = require('assert');
const { parseGoogle } = require('../feeds');
const { scoreItems } = require('../scoring');
const xml = require('./fixture');

const items = parseGoogle(xml);
assert.strictEqual(items.length, 8);
assert.strictEqual(items[0].host, 'g1.globo.com');
assert.ok(!items[0].title.endsWith(' - g1'), 'sufixo da fonte removido');

const { items: s, summary } = scoreItems(items, 'Neymar morreu');
const by = h => s.find(i => i.host.includes(h));
assert.ok(by('sensacionalista').score <= 15, 'sátira fica baixa');
assert.ok(by('noticiasdiaja').score < by('folha').score, 'fonte desconhecida pontua menos');
assert.ok(by('lance').score <= 35, 'manchete fora do tema é limitada');
assert.strictEqual(summary.level, 'denied', 'boato detectado');
assert.ok(s.every(i => i.score >= 0 && i.score <= 100));

const empty = scoreItems([], 'xyz').summary;
assert.strictEqual(empty.level, 'none');
console.log('ok', summary.label);

// Gemini: funções puras e fluxo com fetch simulado
process.env.GEMINI_API_KEY = 'chave-de-teste';
const g = require('../gemini');
assert.throws(() => g.cleanQuery({ title: 'curto' }), /curta/);
assert.throws(() => g.cleanQuery({ title: 'Manchete longa o bastante', link: 'javascript:alert(1)' }), /Link/);
assert.deepStrictEqual(g.extractJson('```json\n{"a":1}\n```'), { a: 1 });
assert.strictEqual(g.normalizeArticle({ titulo: 'T', corpo: ['p'], veredito: 'inventado' }).veredito, 'nao_verificado');
assert.throws(() => g.normalizeArticle({ titulo: 'T', corpo: [] }));

const fakeJson = {
  titulo: 'Título próprio', linhaFina: 'Fina', corpo: ['Um.', 'Dois.'], veredito: 'parcial',
  resumoVeredito: 'r', motivos: ['m'], alertas: [], leituraDaMateria: 'leu parte', imagem: 'Prédio do congresso ao entardecer', legendaImagem: 'l'
};
const fakeFetch = async () => ({
  ok: true,
  json: async () => ({ candidates: [{
    content: { parts: [{ text: JSON.stringify(fakeJson) }] },
    groundingMetadata: { groundingChunks: [{ web: { uri: 'https://a.com/x', title: 'a.com' } }, { web: { uri: 'https://a.com/x', title: 'dup' } }] }
  }] })
});
(async () => {
  const r = await g.handleArticle({ title: 'Manchete de teste longa', source: 'G1', link: 'https://g1.globo.com/x' }, fakeFetch);
  const body = JSON.parse(r.body);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(body.sources.length, 2, 'origem + uma fonte, sem duplicar');
  assert.ok(body.imageUrl.includes('sig='));
  const u = new URL(body.imageUrl, 'http://x');
  const bad = await g.handleImage({ p: u.searchParams.get('p'), sig: 'x'.repeat(32) }, fakeFetch);
  assert.strictEqual(bad.status, 403, 'assinatura errada é recusada');
  const imgFetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }] }) });
  const ok = await g.handleImage({ p: u.searchParams.get('p'), sig: u.searchParams.get('sig') }, imgFetch);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.headers['content-type'], 'image/png');
  delete process.env.GEMINI_API_KEY;
  const none = await g.handleArticle({ title: 'Manchete de teste longa' }, fakeFetch);
  assert.strictEqual(none.status, 503);
  console.log('ok gemini');
})().catch(e => { console.error(e); process.exit(1); });
