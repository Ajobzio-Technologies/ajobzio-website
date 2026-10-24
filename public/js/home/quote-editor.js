/* "Edit your quote" on the quote page: the same location search, map picker and parcel fields as the
   home quote form, in a popup. Saving builds the quote exactly as the home form does and hands it to
   onSave(quote), so the page can redraw the route, price and details in place. */
import { attachPlaces } from './places-autocomplete.js';
import { createMapPicker } from './map-picker.js';
import { createParcelDetails } from './parcel-details.js';
import { closeDropdowns } from '../lib/dropdowns.js';
import { pickedPlace, routePoint, restorePlace } from '../lib/quote-places.js';

export function createQuoteEditor({ onSave }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('editDialog');
  const fromInput = $('from');
  const toInput = $('to');
  const sizeSection = $('editSize');
  const saveBtn = $('editSave');
  const error = $('editError');

  function showError(message) {
    error.textContent = message;
    error.hidden = !message;
  }

  /* Save stays off until both places are checked and something can carry the parcel. */
  function sync() {
    const { blocked } = parcel.sync();
    sizeSection.hidden = parcel.isDocument();
    saveBtn.disabled = blocked || !fromInput.dataset.placeId || !toInput.dataset.placeId;
  }

  const parcel = createParcelDetails({ onChange: sync });
  const mapPicker = createMapPicker();
  [fromInput, toInput].forEach((input) => attachPlaces(input, { showError, onChange: sync, pickOnMap: mapPicker.open }));
  attachPlaces(mapPicker.searchInput, { showError: mapPicker.showError, onPick: mapPicker.centerOn });

  /* Opens the editor on quote's choices, or empty to start a new quote. */
  function open(quote) {
    showError('');
    const places = (quote && quote.places) || [];
    const place = (label) => places.find((item) => item.label === label);
    [[fromInput, place('Pickup')], [toInput, place('Delivery')]].forEach(([input, saved]) => {
      if (saved) restorePlace(input, saved);
      else restorePlace(input, {});
    });
    if (quote && quote.parcel) parcel.restore(quote.parcel);
    sync();
    dialog.showModal();
    /* Like the map picker: focus the popup itself so phones don't open the keyboard straight away. */
    dialog.tabIndex = -1;
    dialog.focus({ preventScroll: true });
  }

  function close() {
    closeDropdowns();
    dialog.close();
  }

  saveBtn.addEventListener('click', () => {
    sync();
    if (saveBtn.disabled) return;
    onSave({
      request: 'parcel',
      rows: [
        ['Request', 'Parcel delivery'],
        ['Pickup', fromInput.value.trim()],
        ['Delivery', toInput.value.trim()],
        ...parcel.summaryRows()
      ],
      places: [pickedPlace('Pickup', fromInput), pickedPlace('Delivery', toInput)],
      route: { from: routePoint(fromInput), to: routePoint(toInput) },
      vehicle: parcel.vehicle(),
      parcel: parcel.state()
    });
    close();
  });
  $('editClose').addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  return { open };
}
