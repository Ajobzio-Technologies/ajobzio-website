/* Old links ended in .html (index.html, careers.html…). Send them to the clean URL. */
function legacyUrls(req, res, next) {
  const match = req.path.match(/^\/([\w-]+)\.html$/);
  if (!match) return next();
  const page = match[1] === 'index' ? '' : match[1];
  const query = req.originalUrl.slice(req.path.length);
  res.redirect(301, '/' + page + query);
}

module.exports = legacyUrls;
