const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

module.exports = {
  ROOT,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  /* Code used by both the browser and the server (served at /js/shared). */
  SHARED_DIR: path.join(ROOT, 'shared'),
  VIEWS_DIR: path.join(ROOT, 'src', 'views'),
  HERO_IMAGES_DIR: path.join(ROOT, 'public', 'images', 'hero')
};
