/* Wraps an async route so a rejected promise reaches the error handler. */
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function isApi(req) {
  return req.originalUrl.startsWith('/api/');
}

function notFound(req, res) {
  if (isApi(req)) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).render('errors/404', { title: 'Page not found' });
}

/* HttpErrors carry a visitor-safe message; anything else is logged and gets a generic one. */
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  const logged = error.cause || (status >= 500 ? error : null);
  if (logged) console.error(req.method + ' ' + req.path + ' failed:', logged.message);
  const message = error.status ? error.message : 'Something went wrong. Please try again.';
  if (isApi(req)) return res.status(status).json({ ok: false, error: message });
  res.status(status).type('text').send(message);
}

module.exports = { asyncRoute, notFound, errorHandler };
