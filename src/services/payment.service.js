/* Ajobzio Payments: creates a payment for a quote and checks whether it has been paid.
   The payment page is hosted by the payments service; customers pay there by card, UPI or QR. */
const { payments } = require('../config/env');

const TIMEOUT_MS = 10000;

async function post(path, fields) {
  const response = await fetch(payments.baseUrl + path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Payments ' + response.status + ': ' + (result.error || 'request failed'));
  return result;
}

/* Resolves to { paymentId, paymentUrl }. amount and tax are rupees; the page charges amount + tax. */
async function createPayment({ orderId, email, phone, amount, tax }) {
  const result = await post('/v1/payment/create', {
    contextId: orderId,
    context: 'order',
    email,
    phone: phone.replace(/\D/g, '').slice(-10),
    amount: amount.toFixed(2),
    tax: tax.toFixed(2),
    currency: 'INR',
    paymentWay: 'api',
    tenantid: payments.tenantId
  });
  if (!result.paymentId || !result.paymentUrl) throw new Error('Payments: no payment link returned');
  /* The service links over http; the same page is served over https. */
  return { paymentId: result.paymentId, paymentUrl: result.paymentUrl.replace(/^http:\/\//, 'https://') };
}

/* 'paid', 'pending' or another status string from the payments service. */
async function paymentStatus(paymentId) {
  const result = await post('/pay.ap', { step: 'status', paymentId });
  return String(result.status || 'unknown');
}

module.exports = { createPayment, paymentStatus };
