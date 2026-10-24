const quoteService = require('../services/quote.service');
const { PATTERNS, text } = require('../utils/input');
const HttpError = require('../utils/http-error');

/* POST /api/quote — { ok, orderId } and, for "Pay now", the payment to open. */
async function create(req, res) {
  const result = await quoteService.submitQuote(req.body || {});
  res.json({ ok: true, ...result });
}

/* GET /api/payment-status?paymentId= — { ok, status } where status is 'paid' once the customer has paid. */
async function paymentStatus(req, res) {
  const paymentId = text(req.query.paymentId, 40);
  if (!PATTERNS.paymentId.test(paymentId)) throw new HttpError(400, 'Invalid payment.');
  res.json({ ok: true, status: await quoteService.checkPayment(paymentId) });
}

module.exports = { create, paymentStatus };
