/* Builds the static site for GitHub Pages into dist/:
   renders every EJS view to HTML, copies public/ and shared/, and writes the hero image list.
   The browser code runs in 'static' mode there (see public/js/backend/static-backend.js).

   Environment (GitHub Actions variables, or .env locally):
     GOOGLE_MAPS_BROWSER_KEY  Maps JavaScript API key restricted to the site's domain
     WEB3FORMS_ACCESS_KEY     Web3Forms access key for quote emails */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { ROOT, PUBLIC_DIR, SHARED_DIR, VIEWS_DIR } = require('../src/config/paths');
const { SERVICE_DISTRICTS, STATE } = require('../src/config/service-area');
const site = require('../src/config/site');
const { HERO_SETS, listHeroImages } = require('../src/services/hero-images.service');
const { BASIC_PAGES } = require('../src/controllers/pages.controller');

const DIST = path.join(ROOT, 'dist');

const clientConfig = {
  mode: 'static',
  phone: site.phone,
  mapsKey: process.env.GOOGLE_MAPS_BROWSER_KEY || '',
  web3formsKey: process.env.WEB3FORMS_ACCESS_KEY || ''
};
const locals = { districts: SERVICE_DISTRICTS, state: STATE, site, year: new Date().getFullYear(), clientConfig };

/* view → output file. GitHub Pages serves /careers from careers.html and unknown paths from 404.html. */
const PAGES = [
  { view: 'pages/home', file: 'index.html', title: '' },
  { view: 'pages/track', file: 'track.html', title: 'Track order' },
  ...Object.entries(BASIC_PAGES).map(([slug, title]) => ({ view: 'pages/basic', file: slug + '.html', title })),
  { view: 'errors/404', file: '404.html', title: 'Page not found' }
];

async function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.cpSync(PUBLIC_DIR, DIST, { recursive: true });
  fs.cpSync(SHARED_DIR, path.join(DIST, 'js', 'shared'), { recursive: true });

  for (const page of PAGES) {
    const html = await ejs.renderFile(path.join(VIEWS_DIR, page.view + '.ejs'), { ...locals, title: page.title });
    fs.writeFileSync(path.join(DIST, page.file), html);
  }

  const heroImages = {};
  for (const set of HERO_SETS) heroImages[set] = await listHeroImages(set);
  fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'data', 'hero-images.json'), JSON.stringify(heroImages, null, 2));

  if (fs.existsSync(path.join(ROOT, 'CNAME'))) fs.copyFileSync(path.join(ROOT, 'CNAME'), path.join(DIST, 'CNAME'));
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

  console.log('Built ' + PAGES.length + ' pages into dist/');
  if (!clientConfig.mapsKey) console.warn('Warning: GOOGLE_MAPS_BROWSER_KEY is not set; location search and the map will not work.');
  if (!clientConfig.web3formsKey) console.warn('Warning: WEB3FORMS_ACCESS_KEY is not set; quotes can only be sent on WhatsApp.');
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
