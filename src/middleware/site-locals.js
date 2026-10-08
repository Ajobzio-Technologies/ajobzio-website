/* Values every page template uses (header pill, contact links, browser config). */
const { SERVICE_DISTRICTS, STATE } = require('../config/service-area');
const site = require('../config/site');
const { icon } = require('../views/icons');

/* What the browser code needs to know. 'server' mode talks to this app's /api routes. */
const clientConfig = { mode: 'server', phone: site.phone };

function siteLocals(req, res, next) {
  res.locals.districts = SERVICE_DISTRICTS;
  res.locals.state = STATE;
  res.locals.site = site;
  res.locals.icon = icon;
  res.locals.year = new Date().getFullYear();
  res.locals.clientConfig = clientConfig;
  next();
}

module.exports = siteLocals;
