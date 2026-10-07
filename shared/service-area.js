/* Where Ajobzio operates, and how a Google address maps to a served district.
   Used by the server (src/config/service-area.js) and, on the static site, by the browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AjobzioServiceArea = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /* For Kerala, Google returns the district as administrative_area_level_3. */
  const SERVICE_DISTRICTS = ['Ernakulam', 'Kottayam', 'Idukki', 'Alappuzha', 'Pathanamthitta'];
  const DISTRICT_ALIASES = { alleppey: 'Alappuzha' };
  const STATE = 'Kerala';

  /* A box around those districts, so suggestions stay local. It overlaps a few neighbours,
     so every picked place is still checked against SERVICE_DISTRICTS. */
  const PLACES_AREA = {
    rectangle: {
      low: { latitude: 8.95, longitude: 76.1 },
      high: { latitude: 10.5, longitude: 77.5 }
    }
  };

  const SERVED_LIST = SERVICE_DISTRICTS.slice(0, -1).join(', ') + ' and ' + SERVICE_DISTRICTS[SERVICE_DISTRICTS.length - 1];

  function outsideAreaMessage(area) {
    return 'Sorry, we don\'t serve ' + (area || 'this location') + ' just yet, but we\'re expanding and hope to be there soon. ' +
      'Right now we serve ' + SERVED_LIST + ' in ' + STATE + '.';
  }

  function inPlacesArea(lat, lng) {
    const low = PLACES_AREA.rectangle.low;
    const high = PLACES_AREA.rectangle.high;
    return lat >= low.latitude && lat <= high.latitude && lng >= low.longitude && lng <= high.longitude;
  }

  /* From Google address components ({ longText, types }), the customer's area and the served district (or null). */
  function districtFromComponents(components) {
    const find = (type) => components.find((item) => (item.types || []).includes(type));
    const state = find('administrative_area_level_1');
    const name = (find('administrative_area_level_3') || find('administrative_area_level_2') || {}).longText || '';
    const inState = Boolean(state) && /^kerala(m)?$/i.test(state.longText);
    const canonical = (DISTRICT_ALIASES[name.toLowerCase()] || name).toLowerCase();
    return {
      area: name || (state ? state.longText : ''),
      district: inState ? SERVICE_DISTRICTS.find((item) => item.toLowerCase() === canonical) || null : null
    };
  }

  return { SERVICE_DISTRICTS, STATE, PLACES_AREA, outsideAreaMessage, inPlacesArea, districtFromComponents };
});
