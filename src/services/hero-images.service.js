/* The home hero's background images: every image file in public/images/hero/<set>,
   so new banners rotate in without code changes. */
const fs = require('fs');
const path = require('path');
const { HERO_IMAGES_DIR } = require('../config/paths');

const HERO_SETS = ['local-services', 'parcel-delivery'];
const IMAGE_FILE = /\.(png|jpe?g|webp|avif)$/i;

/* Public URLs of the set's images, sorted by file name. Unknown sets fall back to local-services. */
async function listHeroImages(set) {
  const folder = HERO_SETS.includes(set) ? set : HERO_SETS[0];
  const files = await fs.promises.readdir(path.join(HERO_IMAGES_DIR, folder));
  return files
    .filter((name) => IMAGE_FILE.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => '/images/hero/' + folder + '/' + encodeURIComponent(name));
}

module.exports = { HERO_SETS, listHeroImages };
