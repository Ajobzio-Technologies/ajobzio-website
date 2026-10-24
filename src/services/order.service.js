/* Orders for the tracking page. There is no order store yet, so lookups use the dummy orders in
   public/data/sample-orders.json when that file exists (delete it to switch them off).
   When real orders are saved, look the ID up here and return
   { id, status, pickup, delivery, eta, steps: [{ label, time, done }] }. */
const fs = require('fs');
const path = require('path');

const SAMPLE_FILE = path.join(__dirname, '..', '..', 'public', 'data', 'sample-orders.json');

/* Read on each lookup so edits to the file show up without a restart. */
function sampleOrders() {
  try {
    return JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8')).orders || [];
  } catch (error) {
    return [];
  }
}

async function findOrder(orderId) {
  return sampleOrders().find((order) => order.id === orderId) || null;
}

module.exports = { findOrder };
