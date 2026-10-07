/* Track order page: looks an order up by ID and shows its status and steps. */
import backend from '../backend/index.js';
import { escapeHtml } from '../lib/html.js';

const ORDER_ID = /^[A-Z0-9-]{4,30}$/;

const form = document.getElementById('trackForm');
const orderInput = document.getElementById('orderId');
const submitBtn = document.getElementById('trackSubmit');
const resultBox = document.getElementById('trackResult');

function showResult(html, isError) {
  resultBox.innerHTML = html;
  resultBox.classList.toggle('is-error', isError);
  resultBox.hidden = false;
}

function showError(title, message) {
  showResult('<h2>' + title + '</h2><p>' + message + '</p>', true);
}

function renderOrder(order) {
  const steps = (order.steps || []).map((step) => (
    '<li class="' + (step.done ? 'done' : '') + '"><span>' + escapeHtml(step.label) + '</span>' +
    (step.time ? '<time>' + escapeHtml(step.time) + '</time>' : '<span></span>') + '</li>'
  )).join('');
  showResult(
    '<div class="track-head"><div><small>Order</small><h2>' + escapeHtml(order.id) + '</h2></div>' +
    '<span class="track-status">' + escapeHtml(order.status) + '</span></div>' +
    (order.pickup || order.delivery
      ? '<div class="track-route">' +
        (order.pickup ? '<span>From <b>' + escapeHtml(order.pickup) + '</b></span>' : '') +
        (order.delivery ? '<span>To <b>' + escapeHtml(order.delivery) + '</b></span>' : '') + '</div>'
      : '') +
    (order.eta ? '<p>Expected: <b>' + escapeHtml(order.eta) + '</b></p>' : '') +
    (steps ? '<ol class="track-steps">' + steps + '</ol>' : ''),
    false
  );
}

async function trackOrder(id) {
  if (!ORDER_ID.test(id)) {
    showError('Check your order ID', 'Order IDs use letters, numbers and dashes, like AJB-10234.');
    return;
  }
  submitBtn.disabled = true;
  try {
    const result = await backend.trackOrder(id);
    if (result.ok && result.order) {
      renderOrder(result.order);
      history.replaceState(null, '', '?id=' + encodeURIComponent(id));
    } else {
      showError('We couldn’t find that order',
        escapeHtml(result.error || 'Check the ID and try again.') +
        ' Need help? Email <a href="mailto:support@ajobzio.com?subject=Order%20' + encodeURIComponent(id) + '">support@ajobzio.com</a> with your order ID.');
    }
  } catch (error) {
    showError('Tracking is unavailable right now', 'Please try again in a moment.');
  } finally {
    submitBtn.disabled = false;
  }
}

orderInput.addEventListener('input', () => {
  orderInput.value = orderInput.value.toUpperCase().replace(/\s+/g, '');
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  trackOrder(orderInput.value.trim());
});

/* Links like /track?id=AJB-10234 open straight to that order. */
const linkedId = new URLSearchParams(location.search).get('id');
if (linkedId) {
  orderInput.value = linkedId.toUpperCase().trim();
  trackOrder(orderInput.value);
}
