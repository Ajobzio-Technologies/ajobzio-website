/* Place suggestions under a text input, from Google Places (through the backend module).
   A picked suggestion is checked to be in a served district before it counts:
   the input then carries data-place-id (and data-lat/lng when set on the map).

   options.showError(message)  where to show problems (required)
   options.onChange()          after the input's place is set or cleared
   options.pickOnMap(input, pin, onPick)  adds a "Choose on map" button
   options.onPick(result)      takes over a verified pick instead of storing it (the map's own search) */
import backend from '../backend/index.js';

const SEARCH_DELAY_MS = 250;
const MIN_QUERY = 3;
const MAP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';

function newSessionToken() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

export function attachPlaces(input, options) {
  const report = options.showError;
  const field = input.closest('.field');
  const menu = document.createElement('ul');
  menu.className = 'when-menu places-menu';
  menu.id = input.id + 'Places';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  field.classList.add('places-field');
  field.append(menu);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', menu.id);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('autocomplete', 'off');

  let timer = null;
  let controller = null;
  let places = [];
  let active = -1;
  let picking = false;
  /* Groups the keystrokes and the final pick into one billed Google session. */
  let sessionToken = newSessionToken();

  function setPlace(placeId, pin, district) {
    if (placeId) input.dataset.placeId = placeId;
    else delete input.dataset.placeId;
    if (district) input.dataset.district = district;
    else delete input.dataset.district;
    if (pin) {
      input.dataset.lat = pin.lat;
      input.dataset.lng = pin.lng;
    } else {
      delete input.dataset.lat;
      delete input.dataset.lng;
    }
    if (options.onChange) options.onChange();
  }

  /* Sets the text without running a new search. */
  function fillInput(value) {
    picking = true;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    picking = false;
  }

  if (options.pickOnMap) {
    const mapButton = document.createElement('button');
    mapButton.type = 'button';
    mapButton.className = 'map-pick';
    mapButton.title = 'Choose on map';
    mapButton.setAttribute('aria-label', 'Choose ' + field.querySelector('span > span').textContent.toLowerCase() + ' on map');
    mapButton.innerHTML = MAP_ICON;
    field.insertBefore(mapButton, menu);
    mapButton.addEventListener('click', (event) => {
      /* The field is a label; keep the click from also focusing the input. */
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      const current = input.dataset.lat ? { lat: Number(input.dataset.lat), lng: Number(input.dataset.lng) } : null;
      options.pickOnMap(input, current, (result, pin) => {
        fillInput(result.text);
        setPlace(result.placeId, pin, result.district);
        report('');
      });
    });
  }

  function setOpen(open) {
    menu.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    field.classList.toggle('open', open);
    if (!open) setActive(-1);
  }

  function setActive(index) {
    active = index;
    menu.querySelectorAll('button').forEach((button, i) => {
      button.classList.toggle('on', i === index);
      button.setAttribute('aria-selected', String(i === index));
      if (i === index) button.scrollIntoView({ block: 'nearest' });
    });
    if (index >= 0) input.setAttribute('aria-activedescendant', menu.id + '-' + index);
    else input.removeAttribute('aria-activedescendant');
  }

  function render() {
    menu.replaceChildren(...places.map((place, i) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.id = menu.id + '-' + i;
      button.dataset.index = i;
      button.tabIndex = -1;
      button.setAttribute('role', 'option');
      const label = document.createElement('span');
      const main = document.createElement('b');
      main.textContent = place.main;
      label.append(main);
      if (place.secondary) {
        const secondary = document.createElement('small');
        secondary.textContent = place.secondary;
        label.append(secondary);
      }
      button.append(label);
      item.append(button);
      return item;
    }));
    setOpen(places.length > 0);
  }

  async function pick(index) {
    const place = places[index];
    if (!place) return;
    places = [];
    setOpen(false);
    fillInput(place.text);
    const token = sessionToken;
    sessionToken = newSessionToken();
    try {
      const result = await backend.verifyPlace(place.placeId, token);
      if (input.value !== place.text) return;
      if (result.ok && result.allowed) {
        report('');
        if (options.onPick) options.onPick(result);
        else setPlace(place.placeId, null, result.district);
        return;
      }
      input.value = '';
      report(result.error || 'Could not check this location right now. Please try again.');
    } catch (error) {
      if (input.value !== place.text) return;
      input.value = '';
      report('Could not reach the server to check this location. Check your connection and try again.');
    }
    input.focus();
  }

  async function search(query) {
    if (controller) controller.abort();
    controller = new AbortController();
    try {
      const result = await backend.autocomplete(query, sessionToken, controller.signal);
      if (input.value.trim() !== query || document.activeElement !== input) return;
      places = result.ok ? result.places : [];
      render();
    } catch (error) {
      if (error.name === 'AbortError') return;
      places = [];
      setOpen(false);
    }
  }

  input.addEventListener('input', () => {
    if (picking) return;
    setPlace('');
    report('');
    clearTimeout(timer);
    const query = input.value.trim();
    if (query.length < MIN_QUERY) {
      if (controller) controller.abort();
      places = [];
      setOpen(false);
      return;
    }
    timer = setTimeout(() => search(query), SEARCH_DELAY_MS);
  });
  input.addEventListener('keydown', (event) => {
    if (menu.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((active + 1) % places.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(active <= 0 ? places.length - 1 : active - 1);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      pick(active);
    } else if (event.key === 'Escape') {
      /* Close the suggestions only, not a dialog around the field. */
      event.preventDefault();
      setOpen(false);
    }
  });
  /* Keep focus in the input while a suggestion is clicked. */
  menu.addEventListener('mousedown', (event) => event.preventDefault());
  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-index]');
    if (!button) return;
    event.stopPropagation();
    pick(Number(button.dataset.index));
  });
  input.addEventListener('blur', () => setOpen(false));
}
