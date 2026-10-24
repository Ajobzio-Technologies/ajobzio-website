/* Reads and checks environment variables once, so the rest of the app imports plain values. */
require('dotenv').config();

const REQUIRED = ['MAIL_HOST', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM', 'MAIL_TO', 'GOOGLE_MAPS_API_KEY'];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  console.error('Missing environment variables: ' + missing.join(', ') + '. See .env.example.');
  process.exit(1);
}

const mailPort = Number(process.env.MAIL_PORT) || 587;

/* A non-negative number from the environment, or fallback when it's unset or invalid. */
function amount(key, fallback) {
  const value = Number(process.env[key]);
  return process.env[key] !== undefined && process.env[key] !== '' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/* Parcel rates per vehicle, before margin and GST. Set in .env so they stay on the server. */
function vehicleRate(prefix, fallback) {
  return {
    baseFare: amount(prefix + '_BASE_FARE', fallback.baseFare),
    includedKm: amount(prefix + '_INCLUDED_KM', fallback.includedKm),
    perKm: amount(prefix + '_PER_KM', fallback.perKm)
  };
}

module.exports = {
  port: Number(process.env.PORT) || 1631,
  mail: {
    host: process.env.MAIL_HOST,
    port: mailPort,
    /* Port 465 is implicit TLS; 587 upgrades with STARTTLS. */
    secure: mailPort === 465,
    requireTLS: process.env.MAIL_STARTTLS !== 'false',
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_TO
  },
  pricing: {
    vehicles: {
      TWO_WHEELER: vehicleRate('PRICE_TWO_WHEELER', { baseFare: 49, includedKm: 2, perKm: 15 }),
      THREE_WHEELER: vehicleRate('PRICE_THREE_WHEELER', { baseFare: 149, includedKm: 2, perKm: 25 }),
      FOUR_WHEELER: vehicleRate('PRICE_FOUR_WHEELER', { baseFare: 299, includedKm: 2, perKm: 35 })
    },
    /* Added to the base fare and per-km rate; customers see the marked-up line amounts only. */
    marginPercent: amount('PRICE_MARGIN_PERCENT', 0),
    /* Taken off the fare before GST and shown as its own line; 0 hides it. */
    discountPercent: Math.min(amount('DISCOUNT_PERCENT', 0), 100),
    gstPercent: amount('GST_PERCENT', 18)
  },
  /* Ajobzio Payments, for "Pay now" on the quote page. Defaults to the test (UAT) service.
     Off unless PAYMENTS_ENABLED=true: the option shows as "Coming soon" and quotes go through as Pay later. */
  payments: {
    enabled: process.env.PAYMENTS_ENABLED === 'true',
    baseUrl: (process.env.PAYMENTS_BASE_URL || 'https://payments-uat.ajobzio.com').replace(/\/+$/, ''),
    tenantId: process.env.PAYMENTS_TENANT_ID || '1001'
  },
  google: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    /* Only needed while the key carries a website (referrer) restriction. */
    referer: process.env.GOOGLE_MAPS_REFERER || '',
    /* Sent to the browser for the map picker; falls back to the server key. */
    browserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY
  }
};
