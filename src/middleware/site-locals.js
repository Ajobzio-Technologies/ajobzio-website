/* Values every page template uses (header pill, footer). */
const { SERVICE_DISTRICTS, STATE } = require('../config/service-area');

function siteLocals(req, res, next) {
  res.locals.districts = SERVICE_DISTRICTS;
  res.locals.state = STATE;
  res.locals.year = new Date().getFullYear();
  next();
}

module.exports = siteLocals;
