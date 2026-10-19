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
