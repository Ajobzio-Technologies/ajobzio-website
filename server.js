require('dotenv').config();
const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;
const REQUIRED_ENV = ['MAIL_HOST', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM', 'MAIL_TO', 'GOOGLE_MAPS_API_KEY'];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error('Missing environment variables: ' + missing.join(', ') + '. See .env.example.');
  process.exit(1);
}

const mailPort = Number(process.env.MAIL_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: mailPort,
  /* Port 465 is implicit TLS; 587 upgrades with STARTTLS. */
  secure: mailPort === 465,
  requireTLS: process.env.MAIL_STARTTLS !== 'false',
  auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD }
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));

/* Small in-memory limit per IP so the endpoints can't be used to flood the inbox or burn API quota. */
function createLimiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(ip);
    }
  }, windowMs).unref();
  return (ip) => {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((time) => now - time < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > max;
  };
}
const PLACE_LABELS = ['Pickup', 'Delivery', 'Area'];
const quoteLimited = createLimiter(5, 15 * 60 * 1000);
const placesLimited = createLimiter(60, 60 * 1000);

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
/* Keeps header-bound values on one line. */
function oneLine(value) {
  return value.replace(/[\r\n]+/g, ' ');
}

function readQuote(body) {
  const name = oneLine(text(body.name, 100));
  const phone = text(body.phone, 20);
  const email = text(body.email, 254);
  const errors = [];
  if (!name) errors.push('Full name is required.');
  if (!/^\+?[0-9\s-]{10,15}$/.test(phone)) errors.push('A valid phone number is required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email address is not valid.');
  const details = Array.isArray(body.details)
    ? body.details.slice(0, 40)
      .filter((row) => Array.isArray(row) && row.length === 2)
      .map(([label, value]) => [text(label, 60), text(String(value), 200)])
      .filter(([label]) => label)
    : [];
  if (!details.length) errors.push('Quote details are missing.');
  return { name, phone, email, details, errors };
}

app.post('/api/quote', async (req, res) => {
  /* Honeypot: real visitors never see or fill this field. */
  if (req.body && req.body.website) return res.json({ ok: true });
  if (quoteLimited(req.ip)) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });
  }
  const quote = readQuote(req.body || {});
  if (quote.errors.length) return res.status(400).json({ ok: false, error: quote.errors.join(' ') });

  const picked = Array.isArray(req.body.places) ? req.body.places.slice(0, 2) : [];
  const places = picked
    .map((item) => ({ label: text(item && item.label, 20), placeId: text(item && item.placeId, 300) }))
    .filter((item) => PLACE_LABELS.includes(item.label) && PLACE_ID.test(item.placeId));
  if (!places.length || places.length !== picked.length) {
    return res.status(400).json({ ok: false, error: 'Please choose your location from the suggestions.' });
  }
  try {
    for (const item of places) {
      const place = await lookupPlace(item.placeId);
      if (!place.district) return res.status(400).json({ ok: false, error: outsideArea(place) });
      quote.details.push([item.label + ' district', place.district]);
      quote.details.push([item.label + ' on map', 'https://www.google.com/maps/place/?q=place_id:' + item.placeId]);
    }
  } catch (error) {
    console.error('Quote place check failed:', error.message);
    return res.status(502).json({ ok: false, error: 'Could not check your location right now. Please try again.' });
  }

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

  try {
    await transporter.sendMail({
      from: { name: 'Ajobzio', address: process.env.MAIL_FROM },
      to: process.env.MAIL_TO,
      replyTo: quote.email || undefined,
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
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('Quote email failed:', error.message);
    res.status(502).json({ ok: false, error: 'We couldn\'t send your quote right now. Please try again in a moment.' });
  }
});

/* Place search via Google Places API (New). Proxied so the API key never reaches the browser. */
const PLACES_BASE = 'https://places.googleapis.com/v1/places';
/* Districts Ajobzio serves. For Kerala, Google returns the district as administrative_area_level_3. */
const SERVICE_DISTRICTS = ['Ernakulam', 'Kottayam', 'Idukki', 'Alappuzha', 'Pathanamthitta'];
const DISTRICT_ALIASES = { alleppey: 'Alappuzha' };
const SERVED_LIST = SERVICE_DISTRICTS.slice(0, -1).join(', ') + ' and ' + SERVICE_DISTRICTS[SERVICE_DISTRICTS.length - 1];
function outsideArea(place) {
  return 'Ajobzio will be available at your location' + (place.area ? ' in ' + place.area : '') +
    ' soon! For now, we serve ' + SERVED_LIST + '.';
}
/* A box around those districts, so suggestions stay local. It overlaps a few neighbours,
   so every picked place is still checked against SERVICE_DISTRICTS. */
const PLACES_AREA = { rectangle: { low: { latitude: 8.95, longitude: 76.1 }, high: { latitude: 10.5, longitude: 77.5 } } };
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const SESSION_TOKEN = /^[A-Za-z0-9-]{1,64}$/;

function googleHeaders(fieldMask) {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
    ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
    /* Only needed while the key carries a website (referrer) restriction. */
    ...(process.env.GOOGLE_MAPS_REFERER ? { Referer: process.env.GOOGLE_MAPS_REFERER } : {})
  };
}

/* Looked-up places, so the quote check doesn't pay for a second Place Details call. */
const placeCache = new Map();
async function lookupPlace(placeId, sessionToken) {
  if (placeCache.has(placeId)) return placeCache.get(placeId);
  const query = sessionToken ? '?sessionToken=' + encodeURIComponent(sessionToken) : '';
  const response = await fetch(PLACES_BASE + '/' + encodeURIComponent(placeId) + query, {
    headers: googleHeaders('addressComponents,formattedAddress'),
    signal: AbortSignal.timeout(5000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error('Place Details ' + response.status + ': ' + (result.error && result.error.message));
  const components = result.addressComponents || [];
  const find = (type) => components.find((item) => item.types.includes(type));
  const state = find('administrative_area_level_1');
  const raw = (find('administrative_area_level_3') || find('administrative_area_level_2') || {}).longText || '';
  const name = DISTRICT_ALIASES[raw.toLowerCase()] || raw;
  const inKerala = Boolean(state) && /^kerala(m)?$/i.test(state.longText);
  const place = {
    placeId,
    address: result.formattedAddress || '',
    /* Where the customer is, for the "coming soon" message. */
    area: raw || (state ? state.longText : ''),
    district: inKerala ? SERVICE_DISTRICTS.find((item) => item.toLowerCase() === name.toLowerCase()) || null : null
  };
  if (placeCache.size >= 2000) placeCache.delete(placeCache.keys().next().value);
  placeCache.set(placeId, place);
  return place;
}

function placesGuard(req, res) {
  if (placesLimited(req.ip)) {
    res.status(429).json({ ok: false, error: 'Too many requests. Please slow down.' });
    return false;
  }
  return true;
}
function sessionTokenFrom(req) {
  const token = text(req.query.sessionToken, 64);
  return SESSION_TOKEN.test(token) ? token : '';
}

app.get('/api/places/autocomplete', async (req, res) => {
  if (!placesGuard(req, res)) return;
  const input = text(req.query.input, 100);
  if (input.length < 3) return res.json({ ok: true, places: [] });
  const sessionToken = sessionTokenFrom(req);

  try {
    const response = await fetch(PLACES_BASE + ':autocomplete', {
      method: 'POST',
      headers: googleHeaders(),
      body: JSON.stringify({
        input,
        includedRegionCodes: ['in'],
        languageCode: 'en',
        locationRestriction: PLACES_AREA,
        ...(sessionToken ? { sessionToken } : {})
      }),
      signal: AbortSignal.timeout(5000)
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('Places autocomplete failed:', response.status, result.error && result.error.message);
      return res.status(502).json({ ok: false, error: 'Place search is unavailable right now.' });
    }
    const places = (result.suggestions || [])
      .map((item) => item.placePrediction)
      .filter(Boolean)
      .map((place) => ({
        placeId: place.placeId,
        text: place.text ? place.text.text : '',
        main: place.structuredFormat ? place.structuredFormat.mainText.text : (place.text ? place.text.text : ''),
        secondary: place.structuredFormat && place.structuredFormat.secondaryText
          ? place.structuredFormat.secondaryText.text
          : ''
      }))
      .filter((place) => place.text);
    res.json({ ok: true, places });
  } catch (error) {
    console.error('Places autocomplete failed:', error.message);
    res.status(502).json({ ok: false, error: 'Place search is unavailable right now.' });
  }
});

/* Checks a picked suggestion is inside a served district. Ends the autocomplete session. */
app.get('/api/places/verify', async (req, res) => {
  if (!placesGuard(req, res)) return;
  const placeId = text(req.query.placeId, 300);
  if (!PLACE_ID.test(placeId)) return res.status(400).json({ ok: false, error: 'Invalid place.' });
  try {
    const place = await lookupPlace(placeId, sessionTokenFrom(req));
    if (!place.district) return res.json({ ok: true, allowed: false, error: outsideArea(place) });
    res.json({ ok: true, allowed: true, district: place.district });
  } catch (error) {
    console.error('Place verify failed:', error.message);
    res.status(502).json({ ok: false, error: 'Could not check this location right now. Please try again.' });
  }
});

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

/* Clean URLs: /careers serves careers.html. */
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html')));

app.listen(PORT, () => console.log('Ajobzio running on http://localhost:' + PORT));
