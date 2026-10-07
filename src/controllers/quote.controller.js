const quoteService = require('../services/quote.service');

/* POST /api/quote */
async function create(req, res) {
  await quoteService.submitQuote(req.body || {});
  res.json({ ok: true });
}

module.exports = { create };
