const { fetchAll } = require('../feeds');
const { scoreItems } = require('../scoring');

module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (q.length < 2) return res.status(400).json({ error: 'Digite ao menos duas letras.' });
  try {
    const { items, errors, failedAll } = await fetchAll(q);
    if (failedAll) throw new Error('Nenhum feed respondeu: ' + errors.join(' | '));
    res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ query: q, ...scoreItems(items.slice(0, 80), q), fetchedAt: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ error: 'Não consegui consultar as fontes agora.', detail: e.message });
  }
};
