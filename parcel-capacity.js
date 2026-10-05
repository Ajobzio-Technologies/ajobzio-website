/* Ajobzio parcel capacity.
   Service limits for a single parcel, not a vehicle's legal payload.
   evaluateShipment is the rule a future order API must run again
   before a parcel delivery order is created. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AjobzioParcel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VEHICLE_CAPACITY = [
    {
      vehicleType: 'TWO_WHEELER',
      displayName: '2 Wheeler',
      icon: '🛵',
      maxWeightKg: 15,
      maxLengthCm: 60,
      maxWidthCm: 40,
      maxHeightCm: 40,
      maxQuantity: 2,
      weightOptionsKg: [1, 2, 5, 10, 15]
    },
    {
      vehicleType: 'THREE_WHEELER',
      displayName: '3 Wheeler',
      icon: '🛺',
      maxWeightKg: 200,
      maxLengthCm: 180,
      maxWidthCm: 120,
      maxHeightCm: 120,
      maxQuantity: 5,
      weightOptionsKg: [25, 50, 100, 150, 200]
    },
    {
      vehicleType: 'FOUR_WHEELER',
      displayName: '4 Wheeler',
      icon: '🚚',
      maxWeightKg: 750,
      maxLengthCm: 300,
      maxWidthCm: 180,
      maxHeightCm: 180,
      maxQuantity: 10,
      weightOptionsKg: [100, 250, 400, 600, 750]
    }
  ];

  function positive(value) {
    return typeof value === 'number' && isFinite(value) && value > 0;
  }

  function limitsText(vehicle) {
    return vehicle.maxLengthCm + ' × ' + vehicle.maxWidthCm + ' × ' + vehicle.maxHeightCm + ' cm';
  }

  function checkVehicle(vehicle, totalWeightKg, quantity, boxes) {
    const weightFail = totalWeightKg > vehicle.maxWeightKg;
    const quantityFail = quantity > vehicle.maxQuantity;
    const dimensionFail = Boolean(boxes) && boxes.some((box) => (
      box.lengthCm > vehicle.maxLengthCm ||
      box.widthCm > vehicle.maxWidthCm ||
      box.heightCm > vehicle.maxHeightCm
    ));
    return {
      ok: !weightFail && !quantityFail && !dimensionFail,
      weightFail: weightFail,
      quantityFail: quantityFail,
      dimensionFail: dimensionFail
    };
  }

  /* Smallest vehicle that can carry the shipment, starting from
     input.vehicleType when given (the customer's choice is only ever upgraded).
     Weight uses parcel weight × quantity.
     input.boxes holds one { lengthCm, widthCm, heightCm } per box;
     each box must fit the vehicle on its own. */
  function evaluateShipment(input) {
    const weightKg = Number(input.weightKg);
    const quantity = Number(input.quantity);
    const totalWeightKg = weightKg * quantity;
    const needsDimensions = Boolean(input.checkDimensions);
    const boxes = (input.boxes || []).slice(0, quantity).map((box) => ({
      lengthCm: Number(box.lengthCm),
      widthCm: Number(box.widthCm),
      heightCm: Number(box.heightCm)
    }));
    const dimensionsReady = needsDimensions && quantity > 0 && boxes.length === quantity &&
      boxes.every((box) => positive(box.lengthCm) && positive(box.widthCm) && positive(box.heightCm));
    const checkedBoxes = dimensionsReady ? boxes : null;

    const chosen = VEHICLE_CAPACITY.findIndex((item) => item.vehicleType === input.vehicleType);
    let vehicle = null;
    for (let i = Math.max(chosen, 0); i < VEHICLE_CAPACITY.length; i += 1) {
      if (checkVehicle(VEHICLE_CAPACITY[i], totalWeightKg, quantity, checkedBoxes).ok) {
        vehicle = VEHICLE_CAPACITY[i];
        break;
      }
    }

    const largest = VEHICLE_CAPACITY[VEHICLE_CAPACITY.length - 1];
    return {
      totalWeightKg: totalWeightKg,
      volumeCm3: checkedBoxes
        ? checkedBoxes.reduce((sum, box) => sum + box.lengthCm * box.widthCm * box.heightCm, 0)
        : null,
      boxes: checkedBoxes,
      vehicle: vehicle,
      supported: Boolean(vehicle),
      incompleteDimensions: needsDimensions && !dimensionsReady,
      largestFailure: vehicle ? null : checkVehicle(largest, totalWeightKg, quantity, checkedBoxes)
    };
  }

  return {
    VEHICLE_CAPACITY: VEHICLE_CAPACITY,
    checkVehicle: checkVehicle,
    evaluateShipment: evaluateShipment,
    limitsText: limitsText
  };
});
