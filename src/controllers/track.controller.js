const orderService = require('../services/order.service');
const { PATTERNS, text } = require('../utils/input');
const HttpError = require('../utils/http-error');

/* GET /api/track?orderId= */
async function show(req, res) {
  const orderId = text(req.query.orderId, 30).toUpperCase();
  if (!PATTERNS.orderId.test(orderId)) throw new HttpError(400, 'That order ID doesn\'t look right.');
  let order;
  try {
    order = await orderService.findOrder(orderId);
  } catch (error) {
    throw new HttpError(502, 'Tracking is unavailable right now.', { cause: error });
  }
  if (!order) throw new HttpError(404, 'There\'s no order with the ID ' + orderId + '.');
  res.json({ ok: true, order });
}

module.exports = { show };
