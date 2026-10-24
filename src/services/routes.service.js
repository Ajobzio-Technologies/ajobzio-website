/* Google Routes API, called from the server so the API key never reaches the browser:
   the driving route between a pickup and a delivery point. */
const { google } = require('../config/env');

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const TIMEOUT_MS = 8000;
/* Routes are reused for this long; the same trip asked again (page reload, sending the quote) costs nothing. */
const CACHE_MS = 30 * 60 * 1000;
const CACHE_LIMIT = 500;
const routeCache = new Map();

/* Points rounded to about 1 m, so the same trip always finds the same cache entry. */
function cacheKey(from, to) {
  const point = (p) => p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
  return point(from) + '>' + point(to);
}

/* from and to are { lat, lng }. Resolves to { distanceMeters, durationSeconds } or null when there is no route. */
async function drivingRoute(from, to) {
  const key = cacheKey(from, to);
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.route;
  const route = await fetchRoute(from, to);
  if (routeCache.size >= CACHE_LIMIT) routeCache.delete(routeCache.keys().next().value);
  routeCache.set(key, { at: Date.now(), route });
  return route;
}

async function fetchRoute(from, to) {
  const waypoint = (point) => ({ location: { latLng: { latitude: point.lat, longitude: point.lng } } });
  const response = await fetch(ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': google.apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      ...(google.referer ? { Referer: google.referer } : {})
    },
    body: JSON.stringify({ origin: waypoint(from), destination: waypoint(to), travelMode: 'DRIVE', regionCode: 'IN' }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const result = await response.json();
  if (!response.ok) throw new Error('Routes ' + response.status + ': ' + (result.error && result.error.message));
  const route = result.routes && result.routes[0];
  if (!route || !route.distanceMeters) return null;
  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: parseInt(route.duration, 10) || 0
  };
}

module.exports = { drivingRoute };
