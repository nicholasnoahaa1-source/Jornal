const { handleArticle } = require('../gemini');

module.exports = async (req, res) => {
  const r = await handleArticle(req.query || {});
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  res.statusCode = r.status;
  res.end(r.body);
};
