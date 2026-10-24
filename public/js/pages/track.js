/* Track order page: looks an order up by ID and shows its status, progress steps,
   parcel details, estimated delivery and delivery partner. */
import backend from '../backend/index.js';
import { escapeHtml } from '../lib/html.js';
import { config } from '../lib/config.js';

const ORDER_ID = /^[A-Z0-9-]{4,30}$/;

const form = document.getElementById('trackForm');
const orderInput = document.getElementById('orderId');
const submitBtn = document.getElementById('trackSubmit');
const resultBox = document.getElementById('trackResult');

/* An icon from the page's icon set, as HTML. */
function icon(name) {
  const item = document.querySelector('#trackIcons').content.querySelector('[data-icon="' + name + '"] svg');
  return item ? item.outerHTML : '';
}

function showResult(html, isError) {
  resultBox.innerHTML = html;
  resultBox.classList.toggle('is-error', isError);
  resultBox.hidden = false;
  /* The hero only fills the screen until there's a result to show under it. */
  document.getElementById('trackPage').classList.remove('is-empty');
}

function showError(title, message) {
  showResult('<section class="track-card track-message"><span class="track-message-icon">' + icon('box') + '</span>' +
    '<div><h2>' + title + '</h2><p>' + message + '</p></div></section>', true);
}

/* A place may be a plain label or { label, lat, lng }. */
const placeLabel = (place) => (place && typeof place === 'object' ? place.label : place) || '';

/* The progress bar: done steps get a tick, the step in progress a truck, upcoming ones stay grey
   (the last one a house). A cancelled order ends on a red cross. */
function stepsHtml(order) {
  const steps = order.steps || [];
  const lastDone = steps.reduce((index, step, i) => (step.done ? i : index), -1);
  const finished = lastDone === steps.length - 1;
  return '<ol class="track-steps" style="--steps:' + steps.length + ';--progress:' + Math.max(lastDone, 0) + '">' + steps.map((step, i) => {
    let state = 'is-next';
    let mark = i === steps.length - 1 ? icon('home') : '';
    if (step.done) {
      const current = i === lastDone && !finished;
      state = current ? 'is-current' : 'is-done';
      mark = current ? icon('truck') : icon('tick');
      if (order.cancelled && i === lastDone) {
        state = 'is-cancelled';
        mark = icon('x');
      }
    }
    return '<li class="' + state + '"><span class="step-dot">' + mark + '</span>' +
      '<b>' + escapeHtml(step.label) + '</b><time>' + escapeHtml(step.time || '–') + '</time>' +
      '<p>' + escapeHtml(stepNote(step, order)) + '</p></li>';
  }).join('') + '</ol>';
}

/* What each step means, shown under it unless the order gives its own note. */
function stepNote(step, order) {
  if (step.note) return step.note;
  const label = step.label.toLowerCase();
  if (label.startsWith('booking')) return 'Your parcel has been booked successfully.';
  if (label.startsWith('picked')) return step.done ? 'Parcel collected from the pickup location.' : 'Our partner will collect your parcel.';
  if (label.startsWith('in transit')) return step.done ? 'Your parcel is on the way to the destination.' : 'Will be updated once it’s on the way.';
  if (label.startsWith('out for')) return step.done ? 'The partner is heading to the delivery location.' : 'Will be updated when it’s nearby.';
  if (label.startsWith('delivered')) return step.done ? 'Delivered to the delivery contact.' : 'Will be updated once delivered.';
  if (label.startsWith('cancel')) return order.statusNote || 'This booking was cancelled.';
  return '';
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

/* Parcel details with an icon per row. */
function detailsCard(order) {
  const parcel = order.parcel || {};
  const rows = [
    ['box', 'Parcel type', parcel.type],
    ['tag', 'Weight', parcel.weight],
    ['summary', 'Dimensions', parcel.dimensions],
    ['truck', 'Vehicle type', parcel.vehicle],
    ['pin', 'Pickup location', placeLabel(order.pickup)],
    ['pin', 'Delivery location', placeLabel(order.delivery)]
  ].filter(([, , value]) => value);
  return '<div class="track-panel"><h3><span class="panel-icon">' + icon('box') + '</span>Parcel details</h3>' +
    '<ul class="track-details">' + rows.map(([name, label, value]) => (
      '<li><span class="detail-icon">' + icon(name) + '</span><span>' + label + '</span><b>' + escapeHtml(value) + '</b></li>'
    )).join('') + '</ul></div>';
}

/* Estimated delivery: the time, how long that is, and a note on what's happening. */
function etaCard(order, tone) {
  if (!order.eta) return '';
  const delivered = tone === 'is-delivered';
  const info = order.update || (delivered
    ? 'Your parcel has been delivered. Thank you for choosing Ajobzio.'
    : 'Your parcel is on its way. The estimated delivery time may vary due to traffic or other unforeseen factors.');
  return '<div class="track-panel"><h3><span class="panel-icon">' + icon('clock') + '</span>' + (delivered ? 'Delivered' : 'Estimated delivery') + '</h3>' +
    '<p class="eta-time">' + escapeHtml(order.eta) + '</p>' +
    (order.etaNote ? '<p class="eta-note">' + escapeHtml(order.etaNote) + '</p>' : '') +
    '<p class="eta-info">' + icon('clock') + '<span>' + escapeHtml(info) + '</span></p></div>';
}

/* Delivery partner with Call and WhatsApp. */
function partnerCard(partner) {
  if (!partner || !partner.name) return '';
  const digits = String(partner.phone || '').replace(/\D/g, '');
  const rating = partner.rating
    ? '<span class="partner-rating">' + icon('star') + ' ' + escapeHtml(String(partner.rating)) +
      (partner.deliveries ? ' <em>(' + escapeHtml(String(partner.deliveries)) + '+ deliveries)</em>' : '') + '</span>'
    : '';
  const actions = digits
    ? '<div class="partner-actions">' +
      '<a class="partner-btn is-call" href="tel:+' + digits + '"><span>' + icon('phone') + '</span>Call</a>' +
      '<a class="partner-btn is-wa" href="https://wa.me/' + digits + '" target="_blank" rel="noopener"><span>' + icon('whatsapp') + '</span>WhatsApp</a></div>'
    : '';
  return '<div class="track-panel"><h3><span class="panel-icon">' + icon('user') + '</span>Delivery partner</h3>' +
    '<div class="partner-row"><span class="partner-avatar">' + escapeHtml(initials(partner.name)) + '</span>' +
    '<div class="partner-info"><b>' + escapeHtml(partner.name) + '</b><small>Delivery partner</small>' + rating + '</div></div>' + actions + '</div>';
}

function renderOrder(order) {
  const steps = order.steps || [];
  const tone = order.cancelled ? 'is-cancelled' : steps.length && steps.every((step) => step.done) ? 'is-delivered' : 'is-active';
  const badgeIcon = tone === 'is-cancelled' ? icon('x') : tone === 'is-delivered' ? icon('tick') : icon('truck');
  showResult(
    '<section class="track-card">' +
      '<div class="track-top">' +
        '<span class="track-top-icon">' + icon('box') + '</span>' +
        '<div class="track-top-id"><small>Tracking ID</small><h2>' + escapeHtml(order.id) + '</h2>' +
          (order.bookedAt ? '<p>Booked on ' + escapeHtml(order.bookedAt) + '</p>' : '') + '</div>' +
        '<div class="track-badge ' + tone + '"><span class="badge-icon">' + badgeIcon + '</span><div><b>' + escapeHtml(order.status) + '</b>' +
          (order.statusNote ? '<small>' + escapeHtml(order.statusNote) + '</small>' : '') + '</div></div>' +
      '</div>' +
      stepsHtml(order) +
      '<div class="track-panels">' + detailsCard(order) + etaCard(order, tone) + partnerCard(tone === 'is-active' ? order.partner : null) + '</div>' +
      '<div class="track-help"><span class="track-help-icon">' + icon('headset') + '</span>' +
        '<div><b>Need help?</b><small>If you have any issues with your delivery, please contact our support team.</small></div>' +
        '<a href="/support">Contact support ' + icon('arrow') + '</a></div>' +
    '</section>',
    false
  );
}

async function trackOrder(id) {
  if (!ORDER_ID.test(id)) {
    showError('Check your tracking ID', 'Tracking IDs use letters, numbers and dashes, like AJB-10234.');
    return;
  }
  submitBtn.disabled = true;
  try {
    const result = await backend.trackOrder(id);
    if (result.ok && result.order) {
      renderOrder(result.order);
      history.replaceState(null, '', '?id=' + encodeURIComponent(id));
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      showError('We couldn’t find that parcel',
        escapeHtml(result.error || 'Check the ID and try again.') +
        ' Need help? Email <a href="mailto:' + escapeHtml(config.supportEmail || 'support@ajobzio.com') + '?subject=Order%20' + encodeURIComponent(id) + '">' +
        escapeHtml(config.supportEmail || 'support@ajobzio.com') + '</a> with your tracking ID.');
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
