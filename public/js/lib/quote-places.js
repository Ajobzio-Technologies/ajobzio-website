/* How a quote's locations are read from (and put back into) the place inputs. A checked input carries
   data-place-id, data-district, data-place-lat/lng (the place's own spot) and data-lat/lng (the
   customer's map pin, when set) — see js/home/places-autocomplete.js. Shared by the home quote form
   and the quote page editor so both save quotes the same way. */

/* The checked place in input, for sending with the quote. */
export function pickedPlace(label, input) {
  return {
    label,
    placeId: input.dataset.placeId,
    district: input.dataset.district,
    address: input.value.trim(),
    ...(input.dataset.placeLat ? { placeLat: Number(input.dataset.placeLat), placeLng: Number(input.dataset.placeLng) } : {}),
    ...(input.dataset.lat ? { lat: Number(input.dataset.lat), lng: Number(input.dataset.lng) } : {})
  };
}

/* A point on the route: the map pin if the customer set one, else the place's own coordinates. */
export function routePoint(input) {
  const lat = input.dataset.lat || input.dataset.placeLat;
  const lng = input.dataset.lng || input.dataset.placeLng;
  return {
    text: input.value.trim(),
    placeId: input.dataset.placeId,
    pinned: Boolean(input.dataset.lat),
    ...(lat ? { lat: Number(lat), lng: Number(lng) } : {})
  };
}

/* Puts a saved pickedPlace() back into input, so it counts as checked without searching again. */
export function restorePlace(input, place) {
  input.value = place.address || '';
  const set = (key, value) => {
    if (value === undefined || value === null || value === '') delete input.dataset[key];
    else input.dataset[key] = value;
  };
  set('placeId', place.placeId);
  set('district', place.district);
  set('placeLat', place.placeLat);
  set('placeLng', place.placeLng);
  set('lat', place.lat);
  set('lng', place.lng);
}
