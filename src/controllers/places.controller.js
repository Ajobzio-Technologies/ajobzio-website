const placesService = require('../services/places.service');
const { google } = require('../config/env');
const { outsideAreaMessage, inPlacesArea } = require('../config/service-area');
const { PATTERNS, text, coordinate } = require('../utils/input');
const HttpError = require('../utils/http-error');

const CHECK_FAILED = 'Could not check this location right now. Please try again.';

function sessionTokenFrom(req) {
  const token = text(req.query.sessionToken, 64);
  return PATTERNS.sessionToken.test(token) ? token : '';
}

/* GET /api/places/autocomplete?input=&sessionToken= */
async function autocomplete(req, res) {
  const input = text(req.query.input, 100);
  if (input.length < 3) return res.json({ ok: true, places: [] });
  try {
    const places = await placesService.autocomplete(input, sessionTokenFrom(req));
    res.json({ ok: true, places });
  } catch (error) {
    throw new HttpError(502, 'Place search is unavailable right now.', { cause: error });
  }
}

/* GET /api/places/verify?placeId=&sessionToken=
   Checks a picked suggestion is inside a served district. Ends the autocomplete session. */
async function verify(req, res) {
  const placeId = text(req.query.placeId, 300);
  if (!PATTERNS.placeId.test(placeId)) throw new HttpError(400, 'Invalid place.');
  let place;
  try {
    place = await placesService.lookupPlace(placeId, sessionTokenFrom(req));
  } catch (error) {
    throw new HttpError(502, CHECK_FAILED, { cause: error });
  }
  if (!place.district) return res.json({ ok: true, allowed: false, error: outsideAreaMessage(place.area) });
  res.json({ ok: true, allowed: true, district: place.district, location: place.location });
}

/* GET /api/places/reverse?lat=&lng=
   Turns a pin dropped on the map into the nearest place, then checks it like a picked suggestion. */
async function reverse(req, res) {
  const lat = coordinate(req.query.lat, -90, 90);
  const lng = coordinate(req.query.lng, -180, 180);
  if (lat === null || lng === null) throw new HttpError(400, 'Invalid location.');
  if (!inPlacesArea(lat, lng)) return res.json({ ok: true, allowed: false, error: outsideAreaMessage() });
  let nearest;
  let place;
  try {
    nearest = await placesService.nearestPlace(lat, lng);
    if (nearest) place = await placesService.lookupPlace(nearest.id);
  } catch (error) {
    throw new HttpError(502, CHECK_FAILED, { cause: error });
  }
  if (!nearest) {
    return res.json({ ok: true, allowed: false, error: 'We couldn\'t find an address at this spot. Move the pin closer to a road or building.' });
  }
  if (!place.district) return res.json({ ok: true, allowed: false, error: outsideAreaMessage(place.area) });
  res.json({ ok: true, allowed: true, placeId: place.placeId, text: place.address || nearest.address, district: place.district });
}

/* GET /api/maps/config — browser key for the Maps JavaScript API (map picker).
   It must be restricted to this site's referrers. */
function mapsConfig(req, res) {
  res.json({ ok: true, key: google.browserKey });
}

module.exports = { autocomplete, verify, reverse, mapsConfig };
