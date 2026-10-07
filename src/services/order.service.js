/* Orders for the tracking page. There is no order store yet, so every lookup finds nothing.
   When orders are saved, look the ID up here and return
   { id, status, pickup, delivery, eta, steps: [{ label, time, done }] }. */
async function findOrder(orderId) {
  return null;
}

module.exports = { findOrder };
