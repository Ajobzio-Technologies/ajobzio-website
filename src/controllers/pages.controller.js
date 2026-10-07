/* Pages that have no content yet render the shared empty layout with their own title. */
const BASIC_PAGES = {
  careers: 'Careers',
  support: 'Support',
  privacy: 'Privacy',
  'privacy-policy': 'Privacy Policy',
  terms: 'Terms'
};

function home(req, res) {
  res.render('pages/home', { title: '' });
}

function track(req, res) {
  res.render('pages/track', { title: 'Track order' });
}

function basic(req, res, next) {
  const title = BASIC_PAGES[req.params.page];
  if (!title) return next();
  res.render('pages/basic', { title });
}

module.exports = { BASIC_PAGES, home, track, basic };
