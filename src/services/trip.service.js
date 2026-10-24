/* A parcel trip between two points: the driving route when Google can find one, otherwise an
   approximation from the straight-line distance, plus the bill for the chosen vehicle. */
const routesService = require('./routes.service');
const pricingService = require('./pricing.service');

/* Roads are rarely straight: a straight-line distance times this is a fair stand-in when routing fails. */
const ROAD_FACTOR = 1.3;

function straightKm(a, b) {
  const rad = (deg) => deg * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/* from and to are { lat, lng }. Resolves to { km, durationSeconds, approximate, bill }. */
async function parcelTrip(from, to, vehicleType) {
  let route = null;
  try {
    route = await routesService.drivingRoute(from, to);
  } catch (error) {
    route = null;
  }
  const km = route ? route.distanceMeters / 1000 : straightKm(from, to) * ROAD_FACTOR;
  return {
    km: Math.round(km * 10) / 10,
    durationSeconds: route ? route.durationSeconds : null,
    approximate: !route,
    bill: pricingService.parcelBill(vehicleType, km)
  };
}

module.exports = { parcelTrip };
