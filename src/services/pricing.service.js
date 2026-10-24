/* Parcel delivery bill, worked out on the server from the rates in .env so visitors can't see or change them. */
const { pricing } = require('../config/env');

const round2 = (value) => Math.round(value * 100) / 100;

function isVehicle(vehicleType) {
  return Object.prototype.hasOwnProperty.call(pricing.vehicles, vehicleType);
}

/* The bill for a trip of km by vehicleType, or null for an unknown vehicle. The margin is built into
   the base fare and per-km rate; the discount comes off the fare, and GST on what's left is split
   evenly into CGST and SGST (intra-state). subtotal is that discounted, taxable amount. */
function parcelBill(vehicleType, km) {
  if (!isVehicle(vehicleType)) return null;
  const rate = pricing.vehicles[vehicleType];
  const markup = 1 + pricing.marginPercent / 100;
  const baseFare = round2(rate.baseFare * markup);
  const perKm = round2(rate.perKm * markup);
  const extraKm = Math.max(0, Math.round((km - rate.includedKm) * 10) / 10);
  const distanceCharge = round2(extraKm * perKm);
  const fare = round2(baseFare + distanceCharge);
  const discount = round2(fare * pricing.discountPercent / 100);
  const subtotal = round2(fare - discount);
  const cgst = round2(subtotal * pricing.gstPercent / 200);
  const sgst = cgst;
  const total = Math.round(subtotal + cgst + sgst);
  return {
    includedKm: rate.includedKm,
    baseFare,
    extraKm,
    perKm,
    distanceCharge,
    discountPercent: pricing.discountPercent,
    discount,
    subtotal,
    gstPercent: pricing.gstPercent,
    cgst,
    sgst,
    roundOff: round2(total - subtotal - cgst - sgst),
    total
  };
}

module.exports = { parcelBill, isVehicle };
