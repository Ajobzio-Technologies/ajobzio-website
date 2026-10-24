/* "Choose on map": the customer centres the map on their spot (starting from their current location),
   and the backend turns it into a checked place, just like a picked suggestion. */
import backend from '../backend/index.js';
import { loadGoogleMaps } from '../lib/google-maps.js';

const MAP_START = { lat: 9.9816, lng: 76.2999 }; /* Kochi */

async function loadMaps() {
  const maps = await loadGoogleMaps(backend.mapsKey);
  return maps.importLibrary('maps');
}

export function createMapPicker() {
  const dialog = document.getElementById('mapDialog');
  const canvas = document.getElementById('mapCanvas');
  const status = document.getElementById('mapStatus');
  const locateBtn = document.getElementById('mapLocate');
  const confirmBtn = document.getElementById('mapConfirm');
  const search = document.getElementById('mapSearch');
  const mapWrap = canvas.closest('.map-wrap');
  let map = null;
  let target = null;

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'parcel-note contact-status ' + kind;
    status.hidden = !text;
  }

  /* Google calls this when the key is rejected (wrong referrer, API not enabled, billing). */
  window.gm_authFailure = () => setStatus('The map is unavailable right now. Please search for your location instead.', 'error');

  /* The customer's live location as { lat, lng }, or null (with the reason shown) when it isn't available. */
  function currentPosition() {
    if (!navigator.geolocation) {
      setStatus('Your browser can\'t share your location. Move the map to your spot instead.', 'error');
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition((position) => {
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
      }, (error) => {
        setStatus(error.code === error.PERMISSION_DENIED
          ? 'Location access is blocked. Allow it in your browser settings, or move the map to your spot.'
          : 'We couldn\'t get your location. Move the map to your spot instead.', 'error');
        resolve(null);
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
  }

  /* "Use my current location": moves the map to where the customer is. */
  async function locate() {
    if (!map) return;
    locateBtn.disabled = true;
    setStatus('Finding your location…', 'upgrade');
    const here = await currentPosition();
    locateBtn.disabled = false;
    if (!here) return;
    setStatus('', '');
    map.setCenter(here);
    map.setZoom(17);
  }

  /* Opens the picker for input, centred on pin (or the customer's location).
     onPick(result, pin) gets the checked place when the customer confirms. */
  async function open(input, pin, onPick) {
    target = { input, onPick };
    search.value = '';
    setStatus('', '');
    confirmBtn.disabled = true;
    dialog.showModal();
    /* showModal focuses the search box, which pops up the phone keyboard over the map.
       Focus the popup itself instead; the customer taps the search box if they want it. */
    dialog.tabIndex = -1;
    dialog.focus({ preventScroll: true });
    /* Show the map only once it's centred: on the customer's pin, else their live location,
       which is looked up while the map loads, so it never opens on some other place first. */
    mapWrap.classList.add('is-loading');
    try {
      const [{ Map }, here] = await Promise.all([loadMaps(), pin ? null : currentPosition()]);
      const center = pin || here || MAP_START;
      const zoom = here ? 17 : 16;
      if (!map) {
        map = new Map(canvas, {
          center,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy'
        });
      } else {
        map.setCenter(center);
        map.setZoom(zoom);
      }
      confirmBtn.disabled = false;
    } catch (error) {
      setStatus('The map couldn\'t load right now. Please search for your location instead.', 'error');
    } finally {
      mapWrap.classList.remove('is-loading');
    }
  }

  async function confirm() {
    if (!map || !target) return;
    const pickFor = target;
    const center = map.getCenter();
    const pin = { lat: center.lat(), lng: center.lng() };
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Checking…';
    setStatus('', '');
    try {
      const result = await backend.reversePlace(pin.lat, pin.lng);
      if (!dialog.open || target !== pickFor) return;
      if (result.ok && result.allowed) {
        pickFor.onPick(result, pin);
        dialog.close();
        return;
      }
      setStatus(result.error || 'Could not check this location right now. Please try again.', 'error');
    } catch (error) {
      setStatus('Could not reach the server to check this location. Check your connection and try again.', 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm location';
    }
  }

  locateBtn.addEventListener('click', locate);
  confirmBtn.addEventListener('click', confirm);
  document.getElementById('mapCancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  return {
    open,
    searchInput: search,
    showError: (message) => setStatus(message, 'error'),
    /* Moves the map to a place picked in the dialog's own search box. */
    centerOn(result) {
      if (!map || !result.location) return;
      map.setCenter(result.location);
      map.setZoom(16);
    }
  };
}
