/* Where Ajobzio operates. The header's served-areas pill and every location check read this list. */

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
  const { low, high } = PLACES_AREA.rectangle;
  return lat >= low.latitude && lat <= high.latitude && lng >= low.longitude && lng <= high.longitude;
}

/* The served district a Google district name belongs to, or null. */
function servedDistrict(name, stateName) {
  if (!stateName || !/^kerala(m)?$/i.test(stateName)) return null;
  const canonical = (DISTRICT_ALIASES[name.toLowerCase()] || name).toLowerCase();
  return SERVICE_DISTRICTS.find((district) => district.toLowerCase() === canonical) || null;
}

module.exports = { SERVICE_DISTRICTS, STATE, PLACES_AREA, outsideAreaMessage, inPlacesArea, servedDistrict };
