/* Parcel details: parcel type, quantity and box sizes.
   The customer doesn't pick a vehicle: the smallest one that fits the boxes is chosen for them. */
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
function boxSized(box) {
  return readDim(box.lengthCm) !== null && readDim(box.widthCm) !== null && readDim(box.heightCm) !== null;
}
function vehicleById(id) {
  return capacity.VEHICLE_CAPACITY.find((item) => item.vehicleType === id);
}
/* Quantity choices cover every vehicle, since the vehicle follows from them. */
const MAX_QUANTITY = Math.max(...capacity.VEHICLE_CAPACITY.map((item) => item.maxQuantity));

/* onChange({ typeChanged }) runs after every edit so the form can update its button. */
export function createParcelDetails({ onChange }) {
  const $ = (id) => document.getElementById(id);
  const typeMenu = $('typeMenu');
  const typeValue = $('typeValue');
  const qtyMenu = $('qtyMenu');
  const qtyValue = $('qtyValue');
  const parcelDims = $('parcelDims');
  const boxList = $('boxList');
  const copyDims = $('copyDims');
  const vehicleLine = $('vehicleLine');
  const capacityError = $('capacityError');
  const type = createDropdown({ button: $('typeBtn'), menu: typeMenu, field: $('typeField') });
  const qty = createDropdown({ button: $('qtyBtn'), menu: qtyMenu, field: $('qtyField') });

  let vehicleId = 'TWO_WHEELER';
  let parcelType = 'NON_DOCUMENT';
  let quantity = 1;
  /* Typed dimensions per box, kept when the quantity shrinks so they come back if it grows again. */
  const boxDims = [];

  /* Documents always go by 2 Wheeler and skip step 2 (no quantity or size). */
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

  function renderQuantities() {
    const options = [];
    for (let count = 1; count <= MAX_QUANTITY; count += 1) options.push(count);
    if (options.indexOf(quantity) === -1) options.push(quantity);
    qtyMenu.innerHTML = options.map((count) => {
      const on = count === quantity ? ' class="on"' : '';
      return '<li><button type="button" data-qty="' + count + '"' + on + '>' + boxesText(count) + '</button></li>';
    }).join('');
    qtyValue.textContent = boxesText(quantity);
  }

  /* Re-checks capacity, picks the smallest vehicle that fits and redraws.
     The vehicle is only chosen once every box has all three sizes.
     Returns { blocked } — true until the sizes are complete, or when nothing can carry the parcel. */
  function sync() {
    if (isDocument()) {
      vehicleId = 'TWO_WHEELER';
      capacityError.hidden = true;
      return { blocked: false };
    }
    parcelDims.hidden = parcelType !== 'NON_DOCUMENT';
    renderQuantities();
    capacityError.hidden = true;
    const boxes = boxDims.slice(0, quantity);
    if (!boxes.every(boxSized)) {
      vehicleLine.innerHTML = '<span>' + (quantity > 1
        ? 'Add the length, width and height of every box to see your vehicle.'
        : 'Add the length, width and height to see your vehicle.') + '</span>';
      return { blocked: true };
    }
    /* Weight isn't asked for, so only the box count and sizes decide the vehicle. */
    const result = capacity.evaluateShipment({
      weightKg: 0,
      quantity,
      boxes: boxes.map((box) => ({
        lengthCm: readDim(box.lengthCm),
        widthCm: readDim(box.widthCm),
        heightCm: readDim(box.heightCm)
      })),
      checkDimensions: true
    });
    if (result.vehicle) vehicleId = result.vehicle.vehicleType;
    if (!result.supported) vehicleId = 'FOUR_WHEELER';
    const chosen = vehicleById(vehicleId);
    vehicleLine.innerHTML = result.supported
      ? '<span>Vehicle:</span> <b class="total-vehicle">' + chosen.icon + ' ' + chosen.displayName + '</b>'
      : '';
    if (!result.supported) {
      capacityError.textContent = 'This parcel exceeds the maximum supported capacity for Ajobzio parcel delivery. Please reduce the parcel quantity/size or contact support for a suitable delivery option.';
      capacityError.hidden = false;
    }
    return { blocked: !result.supported };
  }

  /* Rows for the quote summary and email. */
  function summaryRows() {
    const rows = [
      ['Parcel type', typeValue.textContent],
      ['Vehicle', vehicleById(vehicleId).displayName]
    ];
    if (!isDocument()) {
      rows.push(['Quantity', boxesText(quantity)]);
      boxDims.slice(0, quantity).forEach((box, i) => {
        if (boxSized(box)) rows.push(['Box ' + (i + 1) + ' (L×W×H cm)', box.lengthCm + ' × ' + box.widthCm + ' × ' + box.heightCm]);
      });
    }
    return rows;
  }

  $('typeBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    type.toggle();
  });
  typeMenu.addEventListener('click', (event) => {
    const option = event.target.closest('button');
    if (!option) return;
    event.stopPropagation();
    parcelType = option.dataset.value;
    typeValue.textContent = option.textContent;
    typeMenu.querySelectorAll('button').forEach((item) => item.classList.toggle('on', item === option));
    type.setOpen(false);
    onChange({ typeChanged: true });
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

  /* The vehicle the quote is priced for. */
  function vehicle() {
    const item = vehicleById(vehicleId);
    return { id: item.vehicleType, name: item.displayName };
  }

  /* Everything the customer chose, saved with the quote so the quote page can reopen it for editing. */
  function state() {
    return { vehicleId, parcelType, quantity, boxes: boxDims.slice(0, quantity).map((box) => ({ ...box })) };
  }

  /* Puts a saved state() back into the fields. Call sync() (or the form's update) afterwards. */
  function restore(saved) {
    if (!saved) return;
    parcelType = saved.parcelType === 'DOCUMENT' ? 'DOCUMENT' : 'NON_DOCUMENT';
    quantity = Number(saved.quantity) || 1;
    boxDims.length = 0;
    (saved.boxes || []).forEach((box) => boxDims.push({ lengthCm: box.lengthCm || '', widthCm: box.widthCm || '', heightCm: box.heightCm || '' }));
    typeMenu.querySelectorAll('button').forEach((item) => {
      const on = item.dataset.value === parcelType;
      item.classList.toggle('on', on);
      if (on) typeValue.textContent = item.textContent;
    });
    renderBoxes();
  }

  renderBoxes();
  return { isDocument, sync, summaryRows, vehicle, state, restore };
}
