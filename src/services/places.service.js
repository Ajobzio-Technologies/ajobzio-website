/* Google Places API (New), called from the server so the API key never reaches the browser. */
const { google } = require('../config/env');
const { PLACES_AREA, districtFromComponents } = require('../config/service-area');

const PLACES_BASE = 'https://places.googleapis.com/v1/places';
const TIMEOUT_MS = 5000;
const CACHE_LIMIT = 2000;

function googleHeaders(fieldMask) {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': google.apiKey,
    ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
    ...(google.referer ? { Referer: google.referer } : {})
  };
}

async function request(url, options, label) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const result = await response.json();
  if (!response.ok) throw new Error(label + ' ' + response.status + ': ' + (result.error && result.error.message));
  return result;
}

/* Looked-up places, so the quote check doesn't pay for a second Place Details call. */
const placeCache = new Map();

/* Place Details, reduced to what the site needs: the address and the served district (or null). */
async function lookupPlace(placeId, sessionToken) {
  if (placeCache.has(placeId)) return placeCache.get(placeId);
  const query = sessionToken ? '?sessionToken=' + encodeURIComponent(sessionToken) : '';
  const result = await request(PLACES_BASE + '/' + encodeURIComponent(placeId) + query, {
    headers: googleHeaders('addressComponents,formattedAddress,location')
  }, 'Place Details');

  /* area is where the customer is, for the "not served yet" message. */
  const { area, district } = districtFromComponents(result.addressComponents || []);
  const place = {
    placeId,
    address: result.formattedAddress || '',
    area,
    district,
    /* Lets the map picker jump to a searched place. */
    location: result.location ? { lat: result.location.latitude, lng: result.location.longitude } : null
  };
  if (placeCache.size >= CACHE_LIMIT) placeCache.delete(placeCache.keys().next().value);
  placeCache.set(placeId, place);
  return place;
}

/* Suggestions for what the customer has typed, limited to the service area. */
async function autocomplete(input, sessionToken) {
  const result = await request(PLACES_BASE + ':autocomplete', {
    method: 'POST',
    headers: googleHeaders(),
    body: JSON.stringify({
      input,
      includedRegionCodes: ['in'],
      languageCode: 'en',
      locationRestriction: PLACES_AREA,
      ...(sessionToken ? { sessionToken } : {})
    })
  }, 'Places autocomplete');

  return (result.suggestions || [])
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
}

/* The closest Google place to a map pin (within 500 m), or null. */
async function nearestPlace(lat, lng) {
  const result = await request(PLACES_BASE + ':searchNearby', {
    method: 'POST',
    headers: googleHeaders('places.id,places.formattedAddress'),
    body: JSON.stringify({
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 500 } },
      rankPreference: 'DISTANCE',
      maxResultCount: 1,
      languageCode: 'en'
    })
  }, 'Nearby search');
  const nearest = (result.places || [])[0];
  return nearest ? { id: nearest.id, address: nearest.formattedAddress } : null;
}

module.exports = { lookupPlace, autocomplete, nearestPlace };
