/* Quote requests from the home page: validation, location checks and the email to the team. */
const { PATTERNS, text, oneLine, coordinate, escapeHtml } = require('../utils/input');
const { outsideAreaMessage } = require('../config/service-area');
const HttpError = require('../utils/http-error');
const placesService = require('./places.service');
const mailService = require('./mail.service');

const PLACE_LABELS = ['Pickup', 'Delivery', 'Area'];

/* Contact details and the quote rows from the form. Throws a 400 listing every problem. */
function readQuote(body) {
  const name = oneLine(text(body.name, 100));
  const phone = text(body.phone, 20);
  const email = text(body.email, 254);
  const errors = [];
  if (!name) errors.push('Full name is required.');
  if (!PATTERNS.phone.test(phone)) errors.push('A valid phone number is required.');
  if (email && !PATTERNS.email.test(email)) errors.push('Email address is not valid.');
  const details = Array.isArray(body.details)
    ? body.details.slice(0, 40)
      .filter((row) => Array.isArray(row) && row.length === 2)
      .map(([label, value]) => [text(label, 60), text(String(value), 200)])
      .filter(([label]) => label)
    : [];
  if (!details.length) errors.push('Quote details are missing.');
  if (errors.length) throw new HttpError(400, errors.join(' '));
  return { name, phone, email, details };
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

/* Checks each place is in a served district and adds its district and map links to the quote. */
async function addPlaceDetails(quote, places) {
  for (const item of places) {
    let place;
    try {
      place = await placesService.lookupPlace(item.placeId);
    } catch (error) {
      throw new HttpError(502, 'Could not check your location right now. Please try again.', { cause: error });
    }
    if (!place.district) throw new HttpError(400, outsideAreaMessage(place.area));
    quote.details.push([item.label + ' district', place.district]);
    quote.details.push([item.label + ' on map', 'https://www.google.com/maps/place/?q=place_id:' + item.placeId]);
    if (item.lat !== null && item.lng !== null) {
      quote.details.push([item.label + ' pin', 'https://www.google.com/maps?q=' + item.lat.toFixed(6) + ',' + item.lng.toFixed(6)]);
    }
  }
}

function quoteEmail(quote) {
  const request = (quote.details.find(([label]) => label === 'Request') || [])[1] || 'Quote';
  const contact = [
    ['Name', quote.name],
    ['Phone', quote.phone],
    ['Email', quote.email || 'Not provided']
  ];
  const rows = (list) => list.map(([label, value]) => (
    '<tr><td style="padding:4px 12px 4px 0;color:#6D8386">' + escapeHtml(label) + '</td>' +
    '<td style="padding:4px 0;color:#082D36;font-weight:600">' + escapeHtml(value) + '</td></tr>'
  )).join('');
  return {
    replyTo: quote.email,
    subject: oneLine('New quote: ' + request + ' from ' + quote.name),
    text: [
      'Customer',
      ...contact.map(([label, value]) => label + ': ' + value),
      '',
      'Quote details',
      ...quote.details.map(([label, value]) => label + ': ' + value)
    ].join('\n'),
    html:
      '<div style="font-family:Arial,sans-serif;font-size:14px">' +
      '<h3 style="margin:0 0 8px">Customer</h3><table>' + rows(contact) + '</table>' +
      '<h3 style="margin:16px 0 8px">Quote details</h3><table>' + rows(quote.details) + '</table></div>'
  };
}

/* Validates a quote request, checks its locations and emails it to the team. */
async function submitQuote(body) {
  const quote = readQuote(body);
  const places = readPlaces(body);
  await addPlaceDetails(quote, places);
  try {
    await mailService.sendToInbox(quoteEmail(quote));
  } catch (error) {
    throw new HttpError(502, 'We couldn\'t send your quote right now. Please try again in a moment.', { cause: error });
  }
}

module.exports = { submitQuote };
