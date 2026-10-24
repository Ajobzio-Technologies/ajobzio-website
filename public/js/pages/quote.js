/* Quote confirmation page: shows the quote saved by the home page form, the driving route between
   pickup and delivery with its distance, the price estimate, and takes contact details to send it. */
import backend from '../backend/index.js';
import { config } from '../lib/config.js';
import { loadQuote, saveQuote, clearQuote, saveContact, loadContact, clearContact } from '../lib/quote-store.js';
import { createQuoteEditor } from '../home/quote-editor.js';

const PHONE = /^\+?[0-9\s-]{10,15}$/;
/* Google's calls never settle when the key is rejected, so give up after this long. */
const GOOGLE_TIMEOUT_MS = 10000;

const $ = (id) => document.getElementById(id);
/* The quote on show; replaced when the customer edits it on this page. */
let quote = loadQuote();

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) => setTimeout(() => reject(new Error('Google request timed out')), GOOGLE_TIMEOUT_MS))
  ]);
}

function durationText(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return minutes + ' min';
  return Math.floor(minutes / 60) + ' h ' + (minutes % 60) + ' min';
}

function kmText(km) {
  return (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km';
}

function hasCoords(point) {
  return typeof point.lat === 'number' && typeof point.lng === 'number';
}

/* Which icon each detail tile gets, by the row's label. */
const ROW_ICONS = [
  [/^Parcel type/, 'box'],
  [/^Vehicle/, 'truck'],
  [/^Weight/, 'tag'],
  [/^Total weight/, 'tag'],
  [/^Quantity/, 'hash'],
  [/^Box/, 'summary'],
  [/^Service/, 'wrench'],
  [/^Area|^Pickup|^Delivery/, 'pin'],
  [/^When|^Date/, 'clock']
];

function rowIcon(label) {
  const name = (ROW_ICONS.find(([pattern]) => pattern.test(label)) || [null, 'file'])[1];
  const icon = $('requestIcons').content.querySelector('[data-icon="' + name + '"] svg');
  return icon ? icon.cloneNode(true) : document.createElement('span');
}

function tile(label, value) {
  const item = document.createElement('li');
  const icon = document.createElement('span');
  icon.className = 'request-tile-icon';
  icon.append(rowIcon(label));
  const text = document.createElement('div');
  const name = document.createElement('small');
  name.textContent = label;
  const data = document.createElement('b');
  data.textContent = value;
  if (value === 'Not given') data.className = 'is-muted';
  text.append(name, data);
  item.append(icon, text);
  return item;
}

/* Box sizes as one short list; identical boxes collapse into a single line. */
function renderBoxSizes(boxes) {
  const wrap = $('boxSizes');
  wrap.hidden = !boxes.length;
  if (!boxes.length) return;
  const head = document.createElement('p');
  head.className = 'box-sizes-head';
  head.append('Box sizes ');
  const unit = document.createElement('small');
  unit.textContent = 'L × W × H, cm';
  head.append(unit);
  const list = document.createElement('ul');
  const same = boxes.length > 1 && boxes.every(([, size]) => size === boxes[0][1]);
  const lines = same ? [['All ' + boxes.length + ' boxes', boxes[0][1]]] : boxes;
  list.replaceChildren(...lines.map(([name, size]) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = name;
    const value = document.createElement('b');
    value.textContent = size;
    item.append(label, value);
    return item;
  }));
  wrap.replaceChildren(head, list);
}

/* The request as icon tiles. The route card already shows a parcel's pickup, delivery and vehicle,
   so those are left out here; box sizes get their own list under the tiles. */
function renderRows(rows) {
  const type = (rows.find(([label]) => label === 'Request') || [])[1] || 'Quote';
  const isParcel = Boolean(quote.route);
  if (!isParcel) {
    $('requestTitle').textContent = 'Service details';
    $('requestSub').textContent = type;
    $('requestIcon').replaceChildren(rowIcon('Service'));
    $('quoteRows').replaceChildren(...rows.filter(([label]) => label !== 'Request').map(([label, value]) => tile(label, value)));
    renderBoxSizes([]);
    return;
  }
  const boxes = [];
  const shown = [];
  rows.forEach(([label, data]) => {
    const box = /^Box (d+) (L×W×H cm)$/.exec(label);
    if (box) boxes.push(['Box ' + box[1], data]);
    else if (!['Request', 'Pickup', 'Delivery', 'Vehicle', 'Box sizes'].includes(label)) shown.push([label, data]);
  });
  $('requestTitle').textContent = 'Your parcel';
  $('requestSub').textContent = 'What we’re delivering';
  $('quoteRows').replaceChildren(...shown.map(([label, data]) => tile(label, data)));
  renderBoxSizes(boxes);
}

/* Distance and bill from the server, once known. Kept for the WhatsApp message. */
let trip = null;

function money(amount) {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function billLine(label, amount, kind) {
  const item = document.createElement('li');
  if (kind) item.className = kind;
  const name = document.createElement('span');
  name.textContent = label;
  const value = document.createElement('b');
  value.textContent = amount;
  item.append(name, value);
  return item;
}

/* Fills the billing summary from the server's trip: { km, approximate, bill }. Prices are worked
   out on the server, so the page only shows them. */
function renderBill({ km, approximate, bill }) {
  $('billDate').textContent = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  $('billTag').textContent = approximate ? 'Approximate' : 'Estimate';
  $('billTag').classList.toggle('is-approx', approximate);
  const approx = approximate ? '≈ ' : '';
  if (!bill) {
    $('billLines').replaceChildren(
      billLine('Vehicle', quote.vehicle ? quote.vehicle.name : '–', 'is-info'),
      billLine('Distance', approx + kmText(km), 'is-info')
    );
    $('estimateTotal').textContent = 'On request';
    return;
  }
  const lines = [
    billLine('Vehicle', quote.vehicle.name, 'is-info'),
    billLine('Distance', approx + kmText(km), 'is-info'),
    billLine('Base fare (first ' + bill.includedKm + ' km)', money(bill.baseFare)),
    billLine('Distance charge (' + bill.extraKm + ' km × ' + money(bill.perKm) + '/km)', money(bill.distanceCharge))
  ];
  if (bill.discount) lines.push(billLine('Discount (' + bill.discountPercent + '%)', '−' + money(bill.discount), 'is-discount'));
  lines.push(
    billLine('Subtotal', money(bill.subtotal), 'is-sub'),
    billLine('CGST @ ' + bill.gstPercent / 2 + '%', money(bill.cgst)),
    billLine('SGST @ ' + bill.gstPercent / 2 + '%', money(bill.sgst))
  );
  if (bill.roundOff) lines.push(billLine('Round off', (bill.roundOff > 0 ? '+' : '−') + money(Math.abs(bill.roundOff))));
  $('billLines').replaceChildren(...lines);
  $('billGst').textContent = 'Inclusive of ' + bill.gstPercent + '% GST';
  $('estimateTotal').textContent = approx + money(bill.total);
  trip = {
    distance: kmText(km) + (approximate ? ' (approx.)' : ' (driving)'),
    total: money(bill.total) + (approximate ? ' (approx.)' : '')
  };
}

function showStatus(text) {
  const status = $('routeStatus');
  status.textContent = text;
  status.hidden = !text;
}

/* Coordinates for a route point. Quotes saved before the form kept them only have the place ID, so look it up. */
async function withCoords(point) {
  if (hasCoords(point) || !point.placeId) return point;
  try {
    const result = await backend.verifyPlace(point.placeId, 'quote-' + Date.now());
    if (result.ok && result.location) return { ...point, ...result.location };
  } catch (error) {
    /* No coordinates: the team confirms the distance. */
  }
  return point;
}

/* The driving route from pickup to delivery, drawn by Google's Maps Embed API.
   Unlike the Maps JavaScript API, embedded maps are free and unlimited, so showing the route costs nothing. */
async function embedMap(from, to) {
  const key = await withTimeout(backend.mapsKey());
  /* A picked place by its ID, so the map labels it with the place's name; a customer's pin by its exact spot. */
  const point = (p) => (p.placeId && !p.pinned
    ? 'place_id:' + encodeURIComponent(p.placeId)
    : p.lat.toFixed(6) + ',' + p.lng.toFixed(6));
  const frame = document.createElement('iframe');
  frame.className = 'route-frame';
  frame.title = 'Route from pickup to delivery';
  frame.loading = 'lazy';
  frame.allowFullscreen = true;
  /* Sends this site's address to Google, which the key's website restriction checks. */
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.src = 'https://www.google.com/maps/embed/v1/directions?key=' + encodeURIComponent(key) +
    '&origin=' + point(from) + '&destination=' + point(to) + '&mode=driving&region=in&language=en';
  $('routeMap').replaceChildren(frame);
}

function routeUnknown(message) {
  showStatus(message);
  $('routeDistance').textContent = 'To be confirmed';
  $('routeTime').textContent = 'To be confirmed';
  $('estimateTotal').textContent = 'On request';
}

/* Draws the pins straight away, then asks the server for the route, distance and bill
   (an approximation when Google can't route it). */
/* Bumped on every showRoute, so an older run still waiting on Google can't overwrite a newer one. */
let routeRun = 0;

async function showRoute() {
  const run = ++routeRun;
  const { route } = quote;
  $('routeFrom').textContent = route.from.text;
  $('routeTo').textContent = route.to.text;
  $('routeVehicle').textContent = quote.vehicle ? quote.vehicle.name : '–';
  $('routeDistance').textContent = 'Calculating…';
  $('routeTime').textContent = 'Calculating…';
  $('estimateTotal').textContent = 'Calculating…';

  const [fromPoint, toPoint] = await Promise.all([withCoords(route.from), withCoords(route.to)]);
  if (run !== routeRun) return;
  routePoints = { from: fromPoint, to: toPoint };
  if (!hasCoords(fromPoint) || !hasCoords(toPoint)) {
    routeUnknown('We couldn’t work out the route right now. Our team will confirm the distance and price.');
    return;
  }
  const from = { lat: fromPoint.lat, lng: fromPoint.lng };
  const to = { lat: toPoint.lat, lng: toPoint.lng };

  const priced = backend.estimate(from, to, quote.vehicle && quote.vehicle.id).catch(() => ({ ok: false }));
  const map = await embedMap(fromPoint, toPoint).then(() => true, () => false);
  if (run !== routeRun) return;
  showStatus(map ? '' : 'The map couldn’t load, but here’s your estimate.');

  const result = await priced;
  if (run !== routeRun) return;
  if (!result.ok) {
    routeUnknown(map ? '' : 'We couldn’t work out the route right now. Our team will confirm the distance and price.');
    return;
  }
  $('routeDistance').textContent = (result.approximate ? '≈ ' : '') + kmText(result.km);
  $('routeTime').textContent = result.durationSeconds ? durationText(result.durationSeconds * 1000) : 'Confirmed on call';
  renderBill(result);
}

/* The rows for the WhatsApp message: the summary plus the server's distance and total when known.
   The email gets its price from the server itself. */
function outgoingRows() {
  const rows = quote.rows.slice();
  if (trip) {
    rows.push(['Distance', trip.distance]);
    rows.push(['Estimated total', trip.total]);
  }
  return rows;
}

/* Pickup and delivery with coordinates once looked up, for the map links in the WhatsApp message. */
let routePoints = null;

/* Google Maps links (the same kind the team email uses) that open in the Maps app. */
function mapsLatLng(point) {
  return point.lat.toFixed(6) + ',' + point.lng.toFixed(6);
}
function mapsPlaceLink(point) {
  const query = hasCoords(point) ? mapsLatLng(point) : point.text;
  /* A customer's pin is the exact spot, so it isn't swapped for the named place. */
  const place = point.placeId && !point.pinned ? '&query_place_id=' + encodeURIComponent(point.placeId) : '';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query) + place;
}
function mapsRouteLink(from, to) {
  const end = (point) => encodeURIComponent(hasCoords(point) ? mapsLatLng(point) : point.text);
  return 'https://www.google.com/maps/dir/?api=1&origin=' + end(from) + '&destination=' + end(to) + '&travelmode=driving';
}

/* Map lines for the WhatsApp message: pickup, drop-off and the driving route. */
function mapLines() {
  if (!quote.route) return [];
  const { from, to } = routePoints || quote.route;
  return [
    'Pickup location: ' + mapsPlaceLink(from),
    'Drop-off location: ' + mapsPlaceLink(to),
    'Route: ' + mapsRouteLink(from, to)
  ];
}

/* sender and receiver are { name, phone, email }; receiver is null for a local-service quote. */
function whatsappLink(sender, receiver) {
  const lines = ['Hi Ajobzio, I\'d like to confirm this quote.', ''];
  const person = (title, contact) => {
    if (!contact.name && !contact.phone) return;
    lines.push(title);
    if (contact.name) lines.push('Name: ' + contact.name);
    if (contact.phone) lines.push('Phone: ' + contact.phone);
    if (contact.email) lines.push('Email: ' + contact.email);
    lines.push('');
  };
  person(receiver ? 'Pickup contact' : 'Contact', sender);
  if (receiver) person('Delivery contact', receiver);
  outgoingRows().forEach(([label, value]) => lines.push(label + ': ' + value));
  const maps = mapLines();
  if (maps.length) lines.push('', ...maps);
  return 'https://wa.me/' + config.phone + '?text=' + encodeURIComponent(lines.join('\n'));
}

/* How often to ask whether an online payment has gone through, and for how long. */
const PAYMENT_POLL_MS = 5000;
const PAYMENT_POLL_LIMIT_MS = 30 * 60 * 1000;

function initContact() {
  const form = $('contactForm');
  const nameInput = $('contactName');
  const phoneInput = $('contactPhone');
  const emailInput = $('contactEmail');
  const status = $('contactStatus');
  const submitBtn = $('contactSubmit');
  const payChoice = $('payChoice');
  const payNowBtn = $('payNow');
  const payLaterBtn = $('payLater');
  /* Parcel quotes also take the delivery contact; local services have one contact. */
  let hasReceiver = false;
  const receiverInputs = { name: $('receiverName'), phone: $('receiverPhone'), email: $('receiverEmail') };
  const sameContact = $('sameContact');
  const rememberContact = $('rememberContact');

  /* A returning customer's details, remembered in this browser, fill the empty fields. */
  const remembered = loadContact();
  if (remembered) {
    if (!nameInput.value) nameInput.value = remembered.name || '';
    if (!phoneInput.value) phoneInput.value = remembered.phone || '';
    if (!emailInput.value) emailInput.value = remembered.email || '';
  }
  /* Kept up to date as they type (unless they untick "Remember my details"), so leaving
     mid-way doesn't lose them either. */
  function rememberDetails() {
    if (rememberContact.checked) saveContact(details());
    else clearContact();
  }
  [nameInput, phoneInput, emailInput].forEach((input) => input.addEventListener('input', rememberDetails));
  rememberContact.addEventListener('change', rememberDetails);

  /* Fits the contact section to the current quote. Typed details are kept. */
  function fitContacts() {
    hasReceiver = Boolean(quote && quote.route);
    $('receiverGroup').hidden = !hasReceiver;
    $('senderLegend').textContent = hasReceiver ? 'Pickup contact' : 'Your details';
    $('senderNote').textContent = hasReceiver ? 'We’ll call to confirm the booking' : 'We’ll call or WhatsApp to confirm the booking';
    $('contactSub').textContent = hasReceiver ? 'Who we should call at each end of the trip.' : 'How we can reach you.';
  }
  /* "Same as A" folds the delivery card down to its header. */
  sameContact.addEventListener('change', () => {
    $('receiverFields').hidden = sameContact.checked;
    $('receiverGroup').classList.toggle('is-same', sameContact.checked);
    /* Any problem shown for the delivery fields no longer applies. */
    $('receiverFields').querySelectorAll('.is-invalid').forEach((field) => field.classList.remove('is-invalid'));
    status.hidden = true;
  });
  /* A field marked as the problem clears its mark as soon as it's edited. */
  form.addEventListener('input', (event) => {
    const field = event.target.closest('.pfield');
    if (field) field.classList.remove('is-invalid');
  });

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'quote-status ' + kind;
    status.hidden = !text;
  }

  /* The first problem with one person's details, focusing its field, or '' when valid. who names them in the message. */
  function checkPerson(inputs, who) {
    const flag = (input, message) => {
      input.closest('.pfield').classList.add('is-invalid');
      input.focus();
      return message;
    };
    if (!inputs.name.value.trim()) return flag(inputs.name, 'Please enter the ' + who + '’s full name.');
    if (!PHONE.test(inputs.phone.value.trim())) return flag(inputs.phone, 'Please enter a valid phone number for the ' + who + '.');
    if (inputs.email.value.trim() && !inputs.email.checkValidity()) {
      return flag(inputs.email, 'Please enter a valid email address for the ' + who + ', or leave it empty.');
    }
    return '';
  }

  /* The first problem with the contact details, or '' when everything needed is filled in. */
  function validate() {
    const senderProblem = checkPerson({ name: nameInput, phone: phoneInput, email: emailInput }, hasReceiver ? 'pickup contact' : 'contact');
    if (senderProblem || !hasReceiver || sameContact.checked) return senderProblem;
    return checkPerson(receiverInputs, 'delivery contact');
  }

  function details() {
    return { name: nameInput.value.trim(), phone: phoneInput.value.trim(), email: emailInput.value.trim() };
  }

  /* The delivery contact (the pickup contact again when "Same as pickup contact" is ticked), or null. */
  function receiver() {
    if (!hasReceiver) return null;
    if (sameContact.checked) return details();
    return {
      name: receiverInputs.name.value.trim(),
      phone: receiverInputs.phone.value.trim(),
      email: receiverInputs.email.value.trim()
    };
  }

  /* Online payment needs the server (it creates the payment) and a price worked out there. */
  function canPayOnline() {
    return config.mode !== 'static' && Boolean(trip);
  }

  /* Until online payments go live, "Pay now" shows but can't be picked. */
  const payNowOn = Boolean(config.payNow);
  if (!payNowOn) {
    payNowBtn.disabled = true;
    payNowBtn.querySelector('.pay-option-text small').textContent = 'Coming soon';
  }

  /* Once sent, the contact details, the buttons and the edit links give way to the result in the billing card. */
  function hideForm() {
    $('contactCard').hidden = true;
    $('billActions').hidden = true;
    $('quoteBack').hidden = true;
  }

  function showDone(title, text) {
    clearQuote();
    hideForm();
    $('payWait').hidden = true;
    $('quoteDoneTitle').textContent = title;
    $('quoteDoneText').textContent = text;
    $('quoteDone').hidden = false;
    $('quoteBack').hidden = true;
  }

  function setBusy(busy, label) {
    [submitBtn, payLaterBtn].forEach((button) => { button.disabled = busy; });
    payNowBtn.disabled = busy || !payNowOn;
    submitBtn.textContent = busy && label ? label : 'Confirm Quote';
  }

  /* Waits for the payment to go through, checking now and then and whenever the customer comes back to this tab. */
  function watchPayment(paymentId, onPaid) {
    const started = Date.now();
    let timer = null;
    let done = false;
    async function check() {
      if (done) return;
      try {
        const result = await backend.paymentStatus(paymentId);
        if (result.ok && result.status === 'paid') {
          done = true;
          clearInterval(timer);
          onPaid();
          return;
        }
      } catch (error) {
        /* Try again on the next tick. */
      }
      if (Date.now() - started > PAYMENT_POLL_LIMIT_MS) clearInterval(timer);
    }
    timer = setInterval(check, PAYMENT_POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  }

  /* Sends the quote with the chosen payment. payWindow is a tab opened on the click (so it isn't
     blocked as a popup) that the payment page loads into. */
  async function send(payment, payWindow) {
    const { name, phone, email } = details();
    setBusy(true, 'Sending…');
    setStatus('', '');
    try {
      const result = await backend.submitQuote({
        name, phone, email, receiver: receiver(), payment, details: quote.rows, places: quote.places,
        vehicle: quote.vehicle ? quote.vehicle.id : '', website: $('contactWebsite').value
      });
      if (!result.ok) throw new Error(result.error || '');
      const order = result.orderId ? ' Your order ID is ' + result.orderId + '.' : '';
      if (payment !== 'now' || !result.paymentUrl) {
        if (payWindow) payWindow.close();
        showDone('Quote request sent!', 'Thanks, ' + name + '!' + order + ' We’ll contact you on ' + phone + ' shortly to confirm your booking. You can pay once it’s confirmed.');
        return;
      }
      if (payWindow && !payWindow.closed) payWindow.location.href = result.paymentUrl;
      else window.open(result.paymentUrl, '_blank', 'noopener');
      hideForm();
      $('payOpen').href = result.paymentUrl;
      $('payOrder').textContent = result.orderId || '';
      $('payAmount').textContent = result.amount || trip.total;
      $('payWait').hidden = false;
      $('quoteBack').hidden = true;
      clearQuote();
      watchPayment(result.paymentId, () => {
        showDone('Payment received!', 'Thanks, ' + name + '! We’ve received your payment of ' + (result.amount || trip.total) +
          ' for order ' + result.orderId + '. We’ll call you on ' + phone + ' to arrange the pickup.');
      });
    } catch (error) {
      if (payWindow) payWindow.close();
      /* Show the server's reason (e.g. invalid phone); network failures get a generic message. */
      setStatus(error.message && !(error instanceof TypeError)
        ? error.message
        : 'We couldn\'t send your quote right now. Please try again in a moment.', 'error');
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setStatus(problem, 'error');
      return;
    }
    setStatus('', '');
    if (!canPayOnline()) {
      send('later');
      return;
    }
    /* Ask how they'd like to pay. */
    if (payNowOn) $('payNowAmount').textContent = trip.total;
    submitBtn.hidden = true;
    payChoice.hidden = false;
    (payNowOn ? payNowBtn : payLaterBtn).focus();
  });

  payNowBtn.addEventListener('click', () => {
    const problem = validate();
    if (problem) {
      setStatus(problem, 'error');
      return;
    }
    if (!details().email) {
      setStatus('Please enter the pickup contact’s email address to pay online. We’ll send the receipt there.', 'error');
      emailInput.closest('.pfield').classList.add('is-invalid');
      emailInput.focus();
      return;
    }
    const payWindow = window.open('', '_blank');
    if (payWindow) {
      payWindow.opener = null;
      payWindow.document.title = 'Opening payment…';
      payWindow.document.body.textContent = 'Opening the secure payment page…';
    }
    send('now', payWindow);
  });
  payLaterBtn.addEventListener('click', () => send('later'));
  $('payBack').addEventListener('click', () => {
    payChoice.hidden = true;
    submitBtn.hidden = false;
    setStatus('', '');
  });

  $('contactWhatsapp').addEventListener('click', () => {
    window.open(whatsappLink(details(), receiver()), '_blank', 'noopener');
  });

  /* After the quote changes: back to "Confirm Quote", since the price the payment choice showed is gone. */
  function reset() {
    fitContacts();
    payChoice.hidden = true;
    submitBtn.hidden = false;
    setStatus('', '');
  }

  return { reset };
}

const contact = initContact();

/* Shows the current quote: details, contact section, route, distance and price. */
function render() {
  $('quoteEmpty').hidden = true;
  $('quoteMain').hidden = false;
  trip = null;
  routePoints = null;
  renderRows(quote.rows);
  contact.reset();
  $('routeCard').hidden = !quote.route;
  /* No trip to price: the billing card keeps only its buttons. */
  $('billBody').hidden = !quote.route;
  if (quote.route) showRoute();
}

/* The edited quote replaces the saved one and the page redraws in place. */
const editor = createQuoteEditor({
  onSave(edited) {
    saveQuote(edited);
    quote = edited;
    render();
    $('quoteMain').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

/* "Edit" opens the editor here. A local-service quote (not edited on this page) goes back to its form. */
function editQuote(event) {
  if (quote && !quote.route) {
    if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
    return;
  }
  event.preventDefault();
  editor.open(quote);
}
$('quoteBack').addEventListener('click', editQuote);

/* Edit quote stays reachable: whenever its place at the top isn't fully in view below the sticky
   header, it floats under the header instead. Waiting for the whole row (not just a sliver) to show
   keeps it from slipping behind the header while scrolling back up. */
if ('IntersectionObserver' in window) {
  const header = document.querySelector('header');
  const editBtn = $('quoteBack');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* Moves the button between its place (top right) and floating (under the header, on the left),
     sliding it across from where it was to where it lands: measure before and after the switch,
     then animate the difference away. */
  let slide = null;
  const setFloating = (on) => {
    if (editBtn.classList.contains('is-floating') === on) return;
    if (slide) slide.cancel();
    const before = editBtn.getBoundingClientRect();
    editBtn.classList.toggle('is-floating', on);
    if (reduceMotion.matches || !editBtn.animate) return;
    const after = editBtn.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    slide = editBtn.animate([
      { transform: 'translate(' + dx + 'px, ' + dy + 'px)' },
      { transform: 'none' }
    ], { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    slide.onfinish = () => { slide = null; };
  };
  const observe = () => {
    const below = (header ? header.offsetHeight : 68) + 'px';
    const observer = new IntersectionObserver(([entry]) => {
      const scrolledPast = entry.boundingClientRect.top < entry.rootBounds.top + 1;
      setFloating(entry.intersectionRatio < 1 && scrolledPast);
    }, { rootMargin: '-' + below + ' 0px 0px 0px', threshold: [0, 0.5, 1] });
    observer.observe(document.querySelector('.quote-head-top'));
    return observer;
  };
  let observer = observe();
  /* The header is shorter on phones; re-measure if the screen size changes. */
  window.addEventListener('resize', () => {
    observer.disconnect();
    observer = observe();
  });
}
$('quoteStart').addEventListener('click', () => editor.open(null));

if (quote) render();
else $('quoteEmpty').hidden = false;
