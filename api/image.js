const { handleImage } = require('../gemini');

module.exports = async (req, res) => {
  const r = await handleImage(req.query || {});
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  res.statusCode = r.status;
  res.end(r.body);
};
