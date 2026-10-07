/* Builds the Express app: middleware, static files, API and page routes, then error handling. */
const express = require('express');
const { PUBLIC_DIR, SHARED_DIR, VIEWS_DIR } = require('./config/paths');
const siteLocals = require('./middleware/site-locals');
const legacyUrls = require('./middleware/legacy-urls');
const { notFound, errorHandler } = require('./middleware/errors');
const apiRoutes = require('./routes/api.routes');
const pageRoutes = require('./routes/page.routes');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', VIEWS_DIR);

  app.use(express.json({ limit: '20kb' }));
  app.use(legacyUrls);
  app.use(express.static(PUBLIC_DIR, { index: false }));
  app.use('/js/shared', express.static(SHARED_DIR));

  app.use('/api', apiRoutes);
  app.use(siteLocals);
  app.use(pageRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
