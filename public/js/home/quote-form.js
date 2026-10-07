/* The hero quote form. Parcel delivery has two steps (route, then parcel details);
   local service is one step. Both share the submit button, which stays disabled
   until every location has been picked and checked. */
import { closeDropdowns } from '../lib/dropdowns.js';
import { createParcelDetails } from './parcel-details.js';
import { createSchedulePicker } from './schedule-picker.js';

/* Flip to true once local-service providers are signed up. */
const SERVICES_LIVE = false;

/* A location counts only once it was picked from the suggestions and checked to be in a served district. */
function hasPlace(input) {
  return Boolean(input.dataset.placeId);
}

/* onSubmit runs when a complete quote is submitted. */
export function createQuoteForm({ onSubmit }) {
  const $ = (id) => document.getElementById(id);
  const fromInput = $('from');
  const toInput = $('to');
  const serviceNeed = $('serviceNeed');
  const serviceArea = $('serviceArea');
  const parcelMode = $('parcelMode');
  const serviceMode = $('serviceMode');
  const parcelStep1 = $('parcelStep1');
  const parcelStep2 = $('parcelStep2');
  const stepMeta1 = $('stepMeta1');
  const parcelRow = $('parcelRow');
  const backBtn = $('backBtn');
  const compareBtn = $('compareBtn');
  const placeError = $('placeError');

  let mode = 'parcel';
  let parcelStep = 1;
  const schedule = createSchedulePicker();
  const parcel = createParcelDetails({
    onChange({ typeChanged } = {}) {
      if (typeChanged) setParcelStep(1);
      syncParcel();
    }
  });

  function routeReady() {
    return hasPlace(fromInput) && hasPlace(toInput);
  }

  function syncServiceReady() {
    if (mode !== 'service') return;
    compareBtn.disabled = !SERVICES_LIVE || !serviceNeed.value.trim() || !hasPlace(serviceArea);
  }

  function syncParcel() {
    const { blocked } = parcel.sync();
    if (parcel.isDocument()) {
      compareBtn.disabled = mode === 'parcel' && !routeReady();
      return;
    }
    if (mode === 'parcel' && parcelStep === 2) compareBtn.disabled = blocked;
    else if (mode === 'parcel' && parcelStep === 1) compareBtn.disabled = !routeReady();
    else syncServiceReady();
  }

  /* Re-checks the button after a location is picked or cleared. */
  function syncLocationReady() {
    if (mode === 'parcel') {
      if (parcelStep === 1) compareBtn.disabled = !routeReady();
    } else {
      syncServiceReady();
    }
  }

  function setParcelStep(step) {
    const changed = parcelStep !== step;
    parcelStep = step;
    parcelStep1.hidden = step !== 1;
    parcelStep2.hidden = step !== 2;
    if (changed) {
      const shown = step === 1 ? parcelStep1 : parcelStep2;
      shown.classList.remove('entering');
      void shown.offsetWidth;
      shown.classList.add('entering');
    }
    backBtn.hidden = step !== 2;
    parcelRow.classList.toggle('with-back', step === 2);
    parcelRow.classList.toggle('solo', step !== 2);
    stepMeta1.hidden = parcel.isDocument();
    if (step === 1) {
      compareBtn.type = parcel.isDocument() ? 'submit' : 'button';
      compareBtn.textContent = parcel.isDocument() ? 'Confirm Quote →' : 'Next →';
      compareBtn.disabled = !routeReady();
    } else {
      compareBtn.type = 'submit';
      compareBtn.textContent = 'Confirm Quote →';
      syncParcel();
    }
  }

  function showPlaceError(message) {
    placeError.textContent = message;
    placeError.hidden = !message;
  }

  /* Switches the form between 'parcel' and 'service'. */
  function setMode(next) {
    mode = next;
    const isParcel = mode === 'parcel';
    parcelMode.hidden = !isParcel;
    serviceMode.hidden = isParcel;
    compareBtn.classList.toggle('is-soon', !isParcel && !SERVICES_LIVE);
    showPlaceError('');
    closeDropdowns();
    if (isParcel) {
      setParcelStep(1);
      syncParcel();
    } else {
      backBtn.hidden = true;
      parcelRow.classList.remove('with-back');
      parcelRow.classList.add('solo');
      compareBtn.type = 'submit';
      compareBtn.textContent = SERVICES_LIVE ? 'Compare quotes →' : 'Starting soon';
      syncServiceReady();
    }
  }

  /* Rows for the quote summary and email. */
  function summaryRows() {
    if (mode === 'parcel') {
      return [
        ['Request', 'Parcel delivery'],
        ['Pickup', fromInput.value.trim()],
        ['Delivery', toInput.value.trim()],
        ...parcel.summaryRows()
      ];
    }
    const { when, date } = schedule.summary();
    return [
      ['Request', 'Local service'],
      ['Service', serviceNeed.value.trim()],
      ['Area', serviceArea.value.trim()],
      ['When', when],
      ['Date', date]
    ];
  }

  /* The checked places, with the exact map pin when the customer set one. */
  function pickedPlaces() {
    const inputs = mode === 'parcel'
      ? [['Pickup', fromInput], ['Delivery', toInput]]
      : [['Area', serviceArea]];
    return inputs.map(([label, input]) => ({
      label,
      placeId: input.dataset.placeId,
      district: input.dataset.district,
      ...(input.dataset.lat ? { lat: Number(input.dataset.lat), lng: Number(input.dataset.lng) } : {})
    }));
  }

  [serviceNeed, serviceArea].forEach((input) => input.addEventListener('input', syncServiceReady));
  backBtn.addEventListener('click', () => setParcelStep(1));
  compareBtn.addEventListener('click', (event) => {
    if (mode !== 'parcel') return;
    if (parcelStep === 1 && !parcel.isDocument()) {
      event.preventDefault();
      if (!routeReady()) return;
      setParcelStep(2);
    }
  });
  $('quote').addEventListener('submit', (event) => {
    event.preventDefault();
    if (mode === 'parcel') {
      if (parcelStep !== 2 && !parcel.isDocument()) return;
      syncParcel();
      if (compareBtn.disabled || !routeReady()) return;
    } else if (!SERVICES_LIVE || !hasPlace(serviceArea)) {
      return;
    }
    onSubmit();
  });

  setParcelStep(1);
  syncParcel();

  return {
    fields: { fromInput, toInput, serviceNeed, serviceArea },
    setMode,
    syncLocationReady,
    showPlaceError,
    summaryRows,
    pickedPlaces
  };
}
