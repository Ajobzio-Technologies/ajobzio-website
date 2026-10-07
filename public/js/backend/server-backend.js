/* Backend calls answered by the Express app's /api routes. */

/* The route's JSON, with ok forced to false on an HTTP error. Network failures throw. */
async function getJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  return response.ok ? result : { ...result, ok: false };
}

export async function heroImages(set) {
  const result = await getJson('/api/hero-images?set=' + encodeURIComponent(set));
  return result.images || [];
}

export function autocomplete(input, sessionToken, signal) {
  return getJson('/api/places/autocomplete?input=' + encodeURIComponent(input) +
    '&sessionToken=' + encodeURIComponent(sessionToken), { signal });
}

export function verifyPlace(placeId, sessionToken) {
  return getJson('/api/places/verify?placeId=' + encodeURIComponent(placeId) +
    '&sessionToken=' + encodeURIComponent(sessionToken));
}

export function reversePlace(lat, lng) {
  return getJson('/api/places/reverse?lat=' + lat.toFixed(6) + '&lng=' + lng.toFixed(6));
}

export async function mapsKey() {
  const result = await getJson('/api/maps/config');
  if (!result.ok || !result.key) throw new Error('Maps key missing');
  return result.key;
}

export function submitQuote(quote) {
  return getJson('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quote)
  });
}

export function trackOrder(orderId) {
  return getJson('/api/track?orderId=' + encodeURIComponent(orderId));
}
