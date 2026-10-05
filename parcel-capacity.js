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
      weightOptionsKg: [100, 250, 400, 600, 750]
    }
  ];

  function positive(value) {
    return typeof value === 'number' && isFinite(value) && value > 0;
  }

  function limitsText(vehicle) {
    return vehicle.maxLengthCm + ' × ' + vehicle.maxWidthCm + ' × ' + vehicle.maxHeightCm + ' cm';
  }

  function checkVehicle(vehicle, totalWeightKg, dimensions) {
    const weightFail = totalWeightKg > vehicle.maxWeightKg;
    let lengthFail = false;
    let widthFail = false;
    let heightFail = false;
    if (dimensions) {
      lengthFail = dimensions.lengthCm > vehicle.maxLengthCm;
      widthFail = dimensions.widthCm > vehicle.maxWidthCm;
      heightFail = dimensions.heightCm > vehicle.maxHeightCm;
    }
    return {
      ok: !weightFail && !lengthFail && !widthFail && !heightFail,
      weightFail: weightFail,
      dimensionFail: lengthFail || widthFail || heightFail
    };
  }

  /* Smallest vehicle that can carry the shipment.
     Weight uses parcel weight × quantity.
     Dimensions are checked per parcel, never multiplied by quantity. */
  function evaluateShipment(input) {
    const weightKg = Number(input.weightKg);
    const quantity = Number(input.quantity);
    const totalWeightKg = weightKg * quantity;
    const lengthCm = Number(input.lengthCm);
    const widthCm = Number(input.widthCm);
    const heightCm = Number(input.heightCm);
    const needsDimensions = Boolean(input.checkDimensions);
    const dimensionsReady = needsDimensions && positive(lengthCm) && positive(widthCm) && positive(heightCm);
    const dimensions = dimensionsReady
      ? { lengthCm: lengthCm, widthCm: widthCm, heightCm: heightCm }
      : null;

    let vehicle = null;
    for (let i = 0; i < VEHICLE_CAPACITY.length; i += 1) {
      if (checkVehicle(VEHICLE_CAPACITY[i], totalWeightKg, dimensions).ok) {
        vehicle = VEHICLE_CAPACITY[i];
        break;
      }
    }

    const largest = VEHICLE_CAPACITY[VEHICLE_CAPACITY.length - 1];
    return {
      totalWeightKg: totalWeightKg,
      volumeCm3: dimensions ? lengthCm * widthCm * heightCm : null,
      dimensions: dimensions,
      vehicle: vehicle,
      supported: Boolean(vehicle),
      incompleteDimensions: needsDimensions && !dimensionsReady,
      largestFailure: vehicle ? null : checkVehicle(largest, totalWeightKg, dimensions)
    };
  }

  return {
    VEHICLE_CAPACITY: VEHICLE_CAPACITY,
    evaluateShipment: evaluateShipment,
    limitsText: limitsText
  };
});
