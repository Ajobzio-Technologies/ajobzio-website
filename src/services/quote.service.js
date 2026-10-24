/* Quote requests from the home page: validation, location checks and the email to the team. */
const { PATTERNS, text, oneLine, coordinate } = require('../utils/input');
const { outsideAreaMessage } = require('../config/service-area');
const HttpError = require('../utils/http-error');
const placesService = require('./places.service');
const mailService = require('./mail.service');
const crypto = require('crypto');
const tripService = require('./trip.service');
const paymentService = require('./payment.service');
const { isVehicle } = require('./pricing.service');
const { quoteEmail, paymentReceivedEmail, money } = require('./quote-email');
const env = require('../config/env');

const PLACE_LABELS = ['Pickup', 'Delivery', 'Area'];
/* Price rows only the server writes; any sent by the browser are dropped. */
const PRICE_LABELS = ['Distance', 'Travel time', 'Subtotal', 'Base fare', 'Distance charge', 'Discount', 'CGST', 'SGST', 'GST', 'Round off', 'Estimated total', 'Estimated price', 'Total payable'];

/* Contact details and the quote rows from the form. Throws a 400 listing every problem. */
function readQuote(body) {
  const name = oneLine(text(body.name, 100));
  const phone = text(body.phone, 20);
  const email = text(body.email, 254);
  const errors = [];
  if (!name) errors.push('Full name is required.');
  if (!PATTERNS.phone.test(phone)) errors.push('A valid phone number is required.');
  if (email && !PATTERNS.email.test(email)) errors.push('Email address is not valid.');
  /* Parcel quotes also name who receives the parcel at the delivery point. */
  let receiver = null;
  if (body.receiver && typeof body.receiver === 'object') {
    receiver = {
      name: oneLine(text(body.receiver.name, 100)),
      phone: text(body.receiver.phone, 20),
      email: text(body.receiver.email, 254)
    };
    if (!receiver.name) errors.push('Delivery contact name is required.');
    if (!PATTERNS.phone.test(receiver.phone)) errors.push('A valid delivery contact phone number is required.');
    if (receiver.email && !PATTERNS.email.test(receiver.email)) errors.push('Delivery contact email address is not valid.');
  }
  const details = Array.isArray(body.details)
    ? body.details.slice(0, 40)
      .filter((row) => Array.isArray(row) && row.length === 2)
      .map(([label, value]) => [text(label, 60), text(String(value), 200)])
      .filter(([label]) => label && !PRICE_LABELS.some((price) => label.startsWith(price)))
    : [];
  if (!details.length) errors.push('Quote details are missing.');
  if (errors.length) throw new HttpError(400, errors.join(' '));
  const vehicle = isVehicle(body.vehicle) ? body.vehicle : null;
  const payNow = body.payment === 'now';
  if (payNow && !email) throw new HttpError(400, 'Please enter your email address to pay online.');
  const request = (details.find(([label]) => label === 'Request') || [])[1] || 'Quote';
  /* The form's rows minus the ones the email shows elsewhere (request type and the places). */
  const requestRows = details.filter(([label]) => label !== 'Request' && !PLACE_LABELS.includes(label));
  return { name, phone, email, receiver, details, vehicle, payNow, request, requestRows, locations: [], routeLink: '', trip: null, bill: null };
}

/* The places picked in the form. Every one must be a known label with a valid place ID. */
function readPlaces(body) {
  const picked = Array.isArray(body.places) ? body.places.slice(0, 2) : [];
  const places = picked
    .map((item) => ({
      label: text(item && item.label, 20),
      placeId: text(item && item.placeId, 300),
      /* Set when the customer pinned the spot on the map, which is more exact than the place. */
      lat: item ? coordinate(item.lat, -90, 90) : null,
      lng: item ? coordinate(item.lng, -180, 180) : null
    }))
    .filter((item) => PLACE_LABELS.includes(item.label) && PATTERNS.placeId.test(item.placeId));
  if (!places.length || places.length !== picked.length) {
    throw new HttpError(400, 'Please choose your location from the suggestions.');
  }
  return places;
}

/* Google Maps URLs (https://developers.google.com/maps/documentation/urls) open the right spot
   in the Maps app and in the browser. coords are { lat, lng }. */
function latLng(coords) {
  return coords.lat.toFixed(6) + ',' + coords.lng.toFixed(6);
}
function mapsSearchLink(coords, placeId, address) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(coords ? latLng(coords) : address) +
    (placeId ? '&query_place_id=' + encodeURIComponent(placeId) : '');
}
function mapsDirectionsLink(from, to) {
  return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(latLng(from)) +
    '&destination=' + encodeURIComponent(latLng(to)) + '&travelmode=driving';
}

/* Checks each place is in a served district and adds its district and map links to the quote,
   plus driving directions from pickup to delivery. */
async function addPlaceDetails(quote, places) {
  const spots = {};
  for (const item of places) {
    let place;
    try {
      place = await placesService.lookupPlace(item.placeId);
    } catch (error) {
      throw new HttpError(502, 'Could not check your location right now. Please try again.', { cause: error });
    }
    if (!place.district) throw new HttpError(400, outsideAreaMessage(place.area));
    quote.details.push([item.label + ' district', place.district]);
    const mapLink = mapsSearchLink(place.location, item.placeId, place.address);
    quote.details.push([item.label + ' on map', mapLink]);
    const pin = item.lat !== null && item.lng !== null ? { lat: item.lat, lng: item.lng } : null;
    /* The customer's pin is more exact than the place, so it has its own link (coordinates only). */
    const pinLink = pin ? mapsSearchLink(pin) : '';
    if (pin) quote.details.push([item.label + ' pin', pinLink]);
    spots[item.label] = pin || place.location;
    const typed = (quote.details.find(([label]) => label === item.label) || [])[1];
    quote.locations.push({ label: item.label, address: typed || place.address, district: place.district, mapLink, pinLink });
  }
  if (spots.Pickup && spots.Delivery) {
    quote.routeLink = mapsDirectionsLink(spots.Pickup, spots.Delivery);
    quote.details.push(['Route on map', quote.routeLink]);
    if (quote.vehicle) await addPrice(quote, spots.Pickup, spots.Delivery);
  }
}

function durationText(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? minutes + ' min' : Math.floor(minutes / 60) + ' h ' + (minutes % 60) + ' min';
}

/* Prices the trip again on the server, so the email always carries the real rates. */
async function addPrice(quote, from, to) {
  const trip = await tripService.parcelTrip(from, to, quote.vehicle);
  quote.bill = trip.bill;
  quote.trip = { km: trip.km, approximate: trip.approximate, duration: trip.durationSeconds ? durationText(trip.durationSeconds) : '' };
  const approx = trip.approximate ? ' (approx.)' : '';
  quote.details.push(['Distance', trip.km + ' km' + (trip.approximate ? ' (approx.)' : ' (driving)')]);
  const { bill } = trip;
  if (!bill) return;
  quote.details.push(['Base fare (first ' + bill.includedKm + ' km)', money(bill.baseFare)]);
  quote.details.push(['Distance charge (' + bill.extraKm + ' km × ' + money(bill.perKm) + '/km)', money(bill.distanceCharge)]);
  if (bill.discount) quote.details.push(['Discount (' + bill.discountPercent + '%)', '−' + money(bill.discount)]);
  quote.details.push(['Subtotal', money(bill.subtotal)]);
  quote.details.push(['CGST @ ' + bill.gstPercent / 2 + '%', money(bill.cgst)]);
  quote.details.push(['SGST @ ' + bill.gstPercent / 2 + '%', money(bill.sgst)]);
  quote.details.push(['Estimated total', money(bill.total) + approx]);
}

/* AJQ-20261014-3F9A2C: the date and a random part, quoted to the customer and sent to the payments service. */
function newOrderId() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return 'AJQ-' + day + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

/* Payments created here and not yet seen as paid, so the team gets one "payment received" email.
   Kept in memory: after a restart the payment still completes, the team just checks the payments service. */
const awaitingPayment = new Map();
const AWAITING_LIMIT = 1000;

/* Validates a quote request, checks its locations, creates the online payment when the customer
   chose "Pay now", and emails it all to the team. Resolves to { orderId, paymentId?, paymentUrl?, amount? }
   (amount is what the payment page charges, worked out here). */
async function submitQuote(body) {
  const quote = readQuote(body);
  const places = readPlaces(body);
  await addPlaceDetails(quote, places);
  const orderId = newOrderId();
  quote.orderId = orderId;
  quote.details.unshift(['Order ID', orderId]);
  let payment = null;
  if (quote.payNow) {
    if (!env.payments.enabled) throw new HttpError(400, 'Online payment is not available yet. Please choose Pay later.');
    if (!quote.bill) throw new HttpError(400, 'Online payment isn\'t available for this quote. Please choose Pay later.');
    const tax = Math.round((quote.bill.cgst + quote.bill.sgst) * 100) / 100;
    try {
      payment = await paymentService.createPayment({
        orderId,
        email: quote.email,
        phone: quote.phone,
        amount: Math.round((quote.bill.total - tax) * 100) / 100,
        tax
      });
    } catch (error) {
      throw new HttpError(502, 'Online payment is unavailable right now. Please try again, or choose Pay later.', { cause: error });
    }
    quote.details.push(['Payment', 'Pay now (online) – awaiting payment']);
    quote.details.push(['Payment ID', payment.paymentId]);
    quote.payment = { method: 'now', ...payment };
  } else {
    quote.details.push(['Payment', 'Pay later']);
    quote.payment = { method: 'later' };
  }
  try {
    await mailService.sendToInbox(quoteEmail(quote));
  } catch (error) {
    throw new HttpError(502, 'We couldn\'t send your quote right now. Please try again in a moment.', { cause: error });
  }
  if (!payment) return { orderId };
  if (awaitingPayment.size >= AWAITING_LIMIT) awaitingPayment.delete(awaitingPayment.keys().next().value);
  awaitingPayment.set(payment.paymentId, { orderId, name: quote.name, phone: quote.phone, total: quote.bill.total });
  return { orderId, paymentId: payment.paymentId, paymentUrl: payment.paymentUrl, amount: money(quote.bill.total) };
}

/* The payment's status; the first time it shows as paid, the team gets a "payment received" email. */
async function checkPayment(paymentId) {
  let status;
  try {
    status = await paymentService.paymentStatus(paymentId);
  } catch (error) {
    throw new HttpError(502, 'Could not check the payment right now.', { cause: error });
  }
  const order = awaitingPayment.get(paymentId);
  if (status === 'paid' && order) {
    awaitingPayment.delete(paymentId);
    mailService.sendToInbox(paymentReceivedEmail({ ...order, paymentId })).catch((error) => console.error('Payment email failed', error));
  }
  return status;
}

module.exports = { submitQuote, checkPayment };
