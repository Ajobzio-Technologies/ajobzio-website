/* Parcel details: vehicle, parcel type, weight per box, quantity and box sizes.
   The chosen vehicle is only ever upgraded to fit what the customer enters. */
import capacity from './parcel-capacity.js';
import { createDropdown } from '../lib/dropdowns.js';

function boxesText(count) {
  return count + (count === 1 ? ' box' : ' boxes');
}
function readDim(value) {
  if (!value || value.trim() === '') return null;
  const number = Number(value);
  return number > 0 ? number : null;
}
function vehicleById(id) {
  return capacity.VEHICLE_CAPACITY.find((item) => item.vehicleType === id);
}

/* onChange({ typeChanged }) runs after every edit so the form can update its button. */
export function createParcelDetails({ onChange }) {
  const $ = (id) => document.getElementById(id);
  const vehicleList = $('vehicleList');
  const typeMenu = $('typeMenu');
  const typeValue = $('typeValue');
  const weightMenu = $('weightMenu');
  const weightValue = $('weightValue');
  const qtyMenu = $('qtyMenu');
  const qtyValue = $('qtyValue');
  const parcelDims = $('parcelDims');
  const boxList = $('boxList');
  const copyDims = $('copyDims');
  const dimsHint = $('dimsHint');
  const totalWeightLine = $('totalWeightLine');
  const upgradeNote = $('upgradeNote');
  const capacityError = $('capacityError');
  const type = createDropdown({ button: $('typeBtn'), menu: typeMenu, field: $('typeField') });
  const weight = createDropdown({ button: $('weightBtn'), menu: weightMenu, field: $('weightField') });
  const qty = createDropdown({ button: $('qtyBtn'), menu: qtyMenu, field: $('qtyField') });

  let vehicleId = 'TWO_WHEELER';
  /* The vehicle picked before switching to Document, restored when switching back. */
  let vehicleBeforeDocument = vehicleId;
  let parcelType = 'NON_DOCUMENT';
  let weightKg = 1;
  let quantity = 1;
  /* Typed dimensions per box, kept when the quantity shrinks so they come back if it grows again. */
  const boxDims = [];

  /* Documents always go by 2 Wheeler and skip step 2 (no weight, quantity or size). */
  function isDocument() {
    return parcelType === 'DOCUMENT';
  }

  function renderBoxes() {
    while (boxDims.length < quantity) boxDims.push({ lengthCm: '', widthCm: '', heightCm: '' });
    const dims = [['lengthCm', 'Length'], ['widthCm', 'Width'], ['heightCm', 'Height']];
    let html = '';
    for (let i = 0; i < quantity; i += 1) {
      html += '<div class="box-row"><b>Box ' + (i + 1) + '</b>' + dims.map(([key, label]) => (
        '<input type="number" min="1" step="1" inputmode="numeric" placeholder="cm"' +
        ' data-box="' + i + '" data-dim="' + key + '" value="' + boxDims[i][key] + '"' +
        ' aria-label="Box ' + (i + 1) + ' ' + label.toLowerCase() + ' in cm">'
      )).join('') + '</div>';
    }
    boxList.innerHTML = html;
    copyDims.hidden = quantity < 2;
  }

  function renderVehicles() {
    const vehicles = isDocument() ? [vehicleById('TWO_WHEELER')] : capacity.VEHICLE_CAPACITY;
    vehicleList.innerHTML = vehicles.map((item) => {
      const on = item.vehicleType === vehicleId ? ' active' : '';
      return '<button type="button" class="' + on.trim() + '" data-vehicle="' + item.vehicleType + '" role="radio" aria-checked="' + (on ? 'true' : 'false') + '">' + item.icon + ' ' + item.displayName + '</button>';
    }).join('');
  }

  function renderWeights() {
    const options = vehicleById(vehicleId).weightOptionsKg.slice();
    if (options.indexOf(weightKg) === -1) options.push(weightKg);
    options.sort((a, b) => a - b);
    weightMenu.innerHTML = options.map((kg) => {
      const on = kg === weightKg ? ' class="on"' : '';
      return '<li><button type="button" data-kg="' + kg + '"' + on + '>' + kg + ' kg</button></li>';
    }).join('');
    weightValue.textContent = weightKg + ' kg';
  }

  function renderQuantities() {
    const options = [];
    for (let count = 1; count <= vehicleById(vehicleId).maxQuantity; count += 1) options.push(count);
    if (options.indexOf(quantity) === -1) options.push(quantity);
    qtyMenu.innerHTML = options.map((count) => {
      const on = count === quantity ? ' class="on"' : '';
      return '<li><button type="button" data-qty="' + count + '"' + on + '>' + boxesText(count) + '</button></li>';
    }).join('');
    qtyValue.textContent = boxesText(quantity);
  }

  /* Re-checks capacity, upgrades the vehicle if needed and redraws.
     Returns { blocked } — true while sizes are missing or nothing can carry the parcel. */
  function sync() {
    if (isDocument()) {
      vehicleId = 'TWO_WHEELER';
      renderVehicles();
      upgradeNote.hidden = true;
      capacityError.hidden = true;
      return { blocked: false };
    }
    const before = vehicleId;
    const result = capacity.evaluateShipment({
      weightKg,
      quantity,
      boxes: boxDims.slice(0, quantity).map((box) => ({
        lengthCm: readDim(box.lengthCm),
        widthCm: readDim(box.widthCm),
        heightCm: readDim(box.heightCm)
      })),
      checkDimensions: parcelType === 'NON_DOCUMENT',
      vehicleType: vehicleId
    });
    parcelDims.hidden = parcelType !== 'NON_DOCUMENT';
    if (result.vehicle) vehicleId = result.vehicle.vehicleType;
    if (!result.supported) vehicleId = 'FOUR_WHEELER';
    const previous = vehicleById(before);
    renderVehicles();
    renderWeights();
    renderQuantities();
    totalWeightLine.innerHTML = '<span>Total weight:</span> ' + result.totalWeightKg + ' kg';
    upgradeNote.hidden = true;
    capacityError.hidden = true;
    if (result.vehicle && result.vehicle.vehicleType !== before) {
      const failure = capacity.checkVehicle(previous, result.totalWeightKg, quantity, result.boxes);
      const why = [];
      if (failure.weightFail) why.push(previous.maxWeightKg + ' kg');
      if (failure.quantityFail) why.push(boxesText(previous.maxQuantity));
      if (failure.dimensionFail) why.push(capacity.limitsText(previous) + ' per box');
      const limitLine = why.length ? previous.displayName + ' supports a maximum of ' + why.join(' and ') + '. ' : '';
      upgradeNote.textContent = limitLine + 'Vehicle upgraded to ' + result.vehicle.displayName + ' because the parcel exceeds the maximum capacity of a ' + previous.displayName + '.';
      upgradeNote.hidden = false;
    }
    if (!result.incompleteDimensions && !result.supported) {
      capacityError.textContent = 'This parcel exceeds the maximum supported capacity for Ajobzio parcel delivery. Please reduce the parcel quantity/size or contact support for a suitable delivery option.';
      capacityError.hidden = false;
    }
    dimsHint.hidden = !result.incompleteDimensions;
    dimsHint.textContent = quantity > 1
      ? 'Enter the length, width and height of every box to continue.'
      : 'Enter the length, width and height of the box to continue.';
    return { blocked: result.incompleteDimensions || !result.supported };
  }

  /* Rows for the quote summary and email. */
  function summaryRows() {
    const rows = [
      ['Parcel type', typeValue.textContent],
      ['Vehicle', vehicleById(vehicleId).displayName]
    ];
    if (!isDocument()) {
      rows.push(['Weight per box', weightKg + ' kg']);
      rows.push(['Quantity', boxesText(quantity)]);
      rows.push(['Total weight', weightKg * quantity + ' kg']);
      boxDims.slice(0, quantity).forEach((box, i) => {
        rows.push(['Box ' + (i + 1) + ' (L×W×H cm)', box.lengthCm + ' × ' + box.widthCm + ' × ' + box.heightCm]);
      });
    }
    return rows;
  }

  vehicleList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-vehicle]');
    if (!button) return;
    const next = vehicleById(button.dataset.vehicle);
    if (weightKg > next.maxWeightKg) weightKg = next.weightOptionsKg[next.weightOptionsKg.length - 1];
    vehicleId = next.vehicleType;
    onChange();
  });

  $('typeBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    type.toggle();
  });
  typeMenu.addEventListener('click', (event) => {
    const option = event.target.closest('button');
    if (!option) return;
    event.stopPropagation();
    const wasDocument = isDocument();
    parcelType = option.dataset.value;
    if (!wasDocument && isDocument()) vehicleBeforeDocument = vehicleId;
    if (wasDocument && !isDocument()) vehicleId = vehicleBeforeDocument;
    typeValue.textContent = option.textContent;
    typeMenu.querySelectorAll('button').forEach((item) => item.classList.toggle('on', item === option));
    type.setOpen(false);
    onChange({ typeChanged: true });
  });

  $('weightBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    weight.toggle();
  });
  weightMenu.addEventListener('click', (event) => {
    const option = event.target.closest('button');
    if (!option) return;
    event.stopPropagation();
    weightKg = Number(option.dataset.kg);
    weight.setOpen(false);
    onChange();
  });

  $('qtyBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    qty.toggle();
  });
  qtyMenu.addEventListener('click', (event) => {
    const option = event.target.closest('button');
    if (!option) return;
    event.stopPropagation();
    quantity = Number(option.dataset.qty);
    qty.setOpen(false);
    renderBoxes();
    onChange();
  });

  copyDims.addEventListener('click', () => {
    const first = boxDims[0];
    for (let i = 1; i < quantity; i += 1) boxDims[i] = { ...first };
    renderBoxes();
    onChange();
  });
  boxList.addEventListener('input', (event) => {
    const input = event.target.closest('[data-box]');
    if (!input) return;
    boxDims[Number(input.dataset.box)][input.dataset.dim] = input.value;
    onChange();
  });

  renderBoxes();
  return { isDocument, sync, summaryRows };
}
