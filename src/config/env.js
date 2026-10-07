/* Reads and checks environment variables once, so the rest of the app imports plain values. */
require('dotenv').config();

const REQUIRED = ['MAIL_HOST', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM', 'MAIL_TO', 'GOOGLE_MAPS_API_KEY'];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  console.error('Missing environment variables: ' + missing.join(', ') + '. See .env.example.');
  process.exit(1);
}

const mailPort = Number(process.env.MAIL_PORT) || 587;

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
  google: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    /* Only needed while the key carries a website (referrer) restriction. */
    referer: process.env.GOOGLE_MAPS_REFERER || '',
    /* Sent to the browser for the map picker; falls back to the server key. */
    browserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY
  }
};
