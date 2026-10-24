/* Backend calls handled in the browser, for the static site on GitHub Pages:
   Google Maps JavaScript API for places (with a key restricted to the site's domain),
   Web3Forms for quote emails, and a hero image list written at build time. */
import { config } from '../lib/config.js';
import { loadGoogleMaps } from '../lib/google-maps.js';
import serviceArea from '../lib/service-area.js';

const { PLACES_AREA, outsideAreaMessage, inPlacesArea, districtFromComponents } = serviceArea;
const BOUNDS = {
  south: PLACES_AREA.rectangle.low.latitude,
  west: PLACES_AREA.rectangle.low.longitude,
  north: PLACES_AREA.rectangle.high.latitude,
  east: PLACES_AREA.rectangle.high.longitude
};
const CHECK_FAILED = { ok: false, error: 'Could not check this location right now. Please try again.' };
const NO_ADDRESS = { ok: true, allowed: false, error: 'We couldn\'t find an address at this spot. Move the pin closer to a road or building.' };
const QUOTE_FAILED = 'We couldn\'t send your quote right now. Please try again in a moment.';
/* Google's calls never settle when the key is rejected (e.g. wrong domain), so give up after this long. */
const GOOGLE_TIMEOUT_MS = 10000;

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) => setTimeout(() => reject(new Error('Google request timed out')), GOOGLE_TIMEOUT_MS))
  ]);
}

export async function mapsKey() {
  if (!config.mapsKey) throw new Error('Maps key missing');
  return config.mapsKey;
}

async function placesLibrary() {
  await withTimeout(loadGoogleMaps(mapsKey));
  return withTimeout(google.maps.importLibrary('places'));
}

export async function heroImages(set) {
  const response = await fetch('/data/hero-images.json');
  const sets = await response.json();
  return sets[set] || [];
}

/* Google's session tokens are objects; the pages use strings, so keep one object per string. */
const sessions = new Map();
function sessionFor(token, AutocompleteSessionToken) {
  if (!sessions.has(token)) sessions.set(token, new AutocompleteSessionToken());
  return sessions.get(token);
}

export async function autocomplete(input, sessionToken, signal) {
  try {
    const { AutocompleteSuggestion, AutocompleteSessionToken } = await placesLibrary();
    const { suggestions } = await withTimeout(AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      sessionToken: sessionFor(sessionToken, AutocompleteSessionToken),
      includedRegionCodes: ['in'],
      language: 'en',
      locationRestriction: BOUNDS
    }));
    if (signal && signal.aborted) throw new DOMException('Search replaced', 'AbortError');
    const places = suggestions
      .map((item) => item.placePrediction)
      .filter(Boolean)
      .map((place) => ({
        placeId: place.placeId,
        text: place.text ? place.text.text : '',
        main: place.mainText ? place.mainText.text : (place.text ? place.text.text : ''),
        secondary: place.secondaryText ? place.secondaryText.text : ''
      }))
      .filter((place) => place.text);
    return { ok: true, places };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return { ok: false, error: 'Place search is unavailable right now.' };
  }
}

/* Checks a picked suggestion is inside a served district. Ends the autocomplete session. */
export async function verifyPlace(placeId, sessionToken) {
  sessions.delete(sessionToken);
  try {
    const { Place } = await placesLibrary();
    const place = new Place({ id: placeId });
    await withTimeout(place.fetchFields({ fields: ['addressComponents', 'formattedAddress', 'location'] }));
    const { area, district } = districtFromComponents(place.addressComponents || []);
    if (!district) return { ok: true, allowed: false, error: outsideAreaMessage(area) };
    const location = place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null;
    return { ok: true, allowed: true, district, location };
  } catch (error) {
    return CHECK_FAILED;
  }
}

/* Turns a map pin into the nearest place, then checks it like a picked suggestion. */
export async function reversePlace(lat, lng) {
  if (!inPlacesArea(lat, lng)) return { ok: true, allowed: false, error: outsideAreaMessage() };
  try {
    const { Place, SearchNearbyRankPreference } = await placesLibrary();
    /* The closest place within 500 m, like the server's nearby search. */
    const { places } = await withTimeout(Place.searchNearby({
      fields: ['id', 'formattedAddress', 'addressComponents'],
      locationRestriction: { center: { lat, lng }, radius: 500 },
      rankPreference: SearchNearbyRankPreference.DISTANCE,
      maxResultCount: 1,
      language: 'en'
    }));
    const nearest = places[0];
    if (!nearest) return NO_ADDRESS;
    const { area, district } = districtFromComponents(nearest.addressComponents || []);
    if (!district) return { ok: true, allowed: false, error: outsideAreaMessage(area) };
    return { ok: true, allowed: true, placeId: nearest.id, text: nearest.formattedAddress, district };
  } catch (error) {
    return CHECK_FAILED;
  }
}

/* Google Maps URLs that open the right spot in the Maps app and the browser (same as the server's). */
function latLng(coords) {
  return coords.lat.toFixed(6) + ',' + coords.lng.toFixed(6);
}
function mapsSearchLink(coords, placeId, address) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(coords ? latLng(coords) : address || '') +
    (placeId ? '&query_place_id=' + encodeURIComponent(placeId) : '');
}

/* Emails the quote to the team through Web3Forms, in the same layout as the server's email. */
export async function submitQuote({ name, phone, email, receiver, details, places, website }) {
  /* Honeypot: real visitors never fill this field. */
  if (website) return { ok: true };
  if (!config.web3formsKey) {
    return { ok: false, error: 'Online quotes aren\'t available right now. Please send this quote on WhatsApp instead.' };
  }
  const rows = details.slice();
  const spots = {};
  places.forEach((place) => {
    const own = typeof place.placeLat === 'number' ? { lat: place.placeLat, lng: place.placeLng } : null;
    const pin = typeof place.lat === 'number' ? { lat: place.lat, lng: place.lng } : null;
    if (place.district) rows.push([place.label + ' district', place.district]);
    rows.push([place.label + ' on map', mapsSearchLink(own, place.placeId, place.address)]);
    if (pin) rows.push([place.label + ' pin', mapsSearchLink(pin)]);
    spots[place.label] = pin || own;
  });
  if (spots.Pickup && spots.Delivery) {
    rows.push(['Route on map', 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(latLng(spots.Pickup)) +
      '&destination=' + encodeURIComponent(latLng(spots.Delivery)) + '&travelmode=driving']);
  }
  const request = (details.find(([label]) => label === 'Request') || [])[1] || 'Quote';
  const message = [
    receiver ? 'Pickup contact (customer)' : 'Customer',
    'Name: ' + name,
    'Phone: ' + phone,
    'Email: ' + (email || 'Not provided'),
    '',
    ...(receiver ? ['Delivery contact', 'Name: ' + receiver.name, 'Phone: ' + receiver.phone, 'Email: ' + (receiver.email || 'Not provided'), ''] : []),
    'Quote details',
    ...rows.map(([label, value]) => label + ': ' + value)
  ].join('\n');
  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: config.web3formsKey,
        subject: 'New quote: ' + request + ' from ' + name,
        from_name: 'Ajobzio website',
        name,
        phone,
        email: email || undefined,
        message
      })
    });
    const result = await response.json().catch(() => ({}));
    return result.success ? { ok: true } : { ok: false, error: QUOTE_FAILED };
  } catch (error) {
    return { ok: false, error: QUOTE_FAILED };
  }
}

/* Driving route between two { lat, lng } points through the Maps JavaScript API's Routes library. */
async function drivingRoute(from, to) {
  try {
    await withTimeout(loadGoogleMaps(mapsKey));
    const { Route } = await withTimeout(google.maps.importLibrary('routes'));
    const { routes } = await withTimeout(Route.computeRoutes({
      origin: from,
      destination: to,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis']
    }));
    const best = routes && routes[0];
    if (!best || !best.distanceMeters) return { ok: false, error: 'No driving route found.' };
    return {
      ok: true,
      distanceMeters: best.distanceMeters,
      durationSeconds: Math.round((best.durationMillis || 0) / 1000),
      path: (best.path || []).map((point) => (typeof point.lat === 'function' ? { lat: point.lat(), lng: point.lng() } : { lat: point.lat, lng: point.lng }))
    };
  } catch (error) {
    return { ok: false, error: 'Route is unavailable right now.' };
  }
}

/* The static site has no server to keep rates private, so it shows the route and distance only
   and the team confirms the price. Same shape as the server's /api/estimate, with bill: null. */
export async function estimate(from, to) {
  const route = await drivingRoute(from, to);
  if (!route.ok) return route;
  return {
    ok: true,
    km: Math.round(route.distanceMeters / 100) / 10,
    durationSeconds: route.durationSeconds,
    path: route.path,
    approximate: false,
    bill: null
  };
}

/* Online payment needs the server, so the static site never offers it. */
export async function paymentStatus() {
  return { ok: false, error: 'Online payment isn\'t available here.' };
}

/* There is no order store yet, so lookups use the dummy orders in /data/sample-orders.json when it
   exists (same answer as the server; delete the file to switch them off). */
export async function trackOrder(orderId) {
  const notFound = { ok: false, error: 'There\'s no order with the ID ' + orderId + '.' };
  try {
    const response = await fetch('/data/sample-orders.json');
    if (!response.ok) return notFound;
    const order = ((await response.json()).orders || []).find((item) => item.id === orderId);
    return order ? { ok: true, order } : notFound;
  } catch (error) {
    return notFound;
  }
}
