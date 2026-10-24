const tripService = require('../services/trip.service');
const { isVehicle } = require('../services/pricing.service');
const { inPlacesArea } = require('../config/service-area');
const { coordinate } = require('../utils/input');
const HttpError = require('../utils/http-error');

/* A point from the query, kept inside the area we search places in. */
function pointFrom(query, prefix) {
  const lat = coordinate(query[prefix + 'Lat'], -90, 90);
  const lng = coordinate(query[prefix + 'Lng'], -180, 180);
  return lat !== null && lng !== null && inPlacesArea(lat, lng) ? { lat, lng } : null;
}

/* GET /api/estimate?fromLat=&fromLng=&toLat=&toLng=&vehicle=
   The route, distance and bill for the quote confirmation page, priced on the server. */
async function estimate(req, res) {
  const from = pointFrom(req.query, 'from');
  const to = pointFrom(req.query, 'to');
  const vehicle = String(req.query.vehicle || '');
  if (!from || !to || !isVehicle(vehicle)) throw new HttpError(400, 'Invalid route.');
  res.json({ ok: true, ...(await tripService.parcelTrip(from, to, vehicle)) });
}

module.exports = { estimate };
