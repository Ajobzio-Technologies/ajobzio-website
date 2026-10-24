/* Pages that have no content yet render the shared empty layout with their own title. */
const BASIC_PAGES = {};

/* Shown at the top of the privacy policy; update it whenever the policy changes. */
const PRIVACY_POLICY_DATE = '24 October 2026';

/* Shown at the top of the terms; update it whenever the terms change. */
const TERMS_DATE = '13 October 2026';

function home(req, res) {
  res.render('pages/home', { title: '' });
}

function track(req, res) {
  res.render('pages/track', { title: 'Track order' });
}

function about(req, res) {
  res.render('pages/about', { title: 'About us' });
}

function careers(req, res) {
  res.render('pages/careers', { title: 'Careers' });
}

function support(req, res) {
  res.render('pages/support', { title: 'Support' });
}

function privacyPolicy(req, res) {
  res.render('pages/privacy-policy', { title: 'Privacy Policy', effectiveDate: PRIVACY_POLICY_DATE });
}

function quote(req, res) {
  res.render('pages/quote', { title: 'Confirm your quote' });
}

function terms(req, res) {
  res.render('pages/terms', { title: 'Terms of Service', effectiveDate: TERMS_DATE });
}

function basic(req, res, next) {
  const title = BASIC_PAGES[req.params.page];
  if (!title) return next();
  res.render('pages/basic', { title });
}

module.exports = { BASIC_PAGES, PRIVACY_POLICY_DATE, TERMS_DATE, home, track, about, careers, support, privacyPolicy, terms, quote, basic };
