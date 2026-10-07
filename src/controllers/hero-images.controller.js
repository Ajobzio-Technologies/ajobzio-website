const heroImagesService = require('../services/hero-images.service');

/* GET /api/hero-images?set=parcel-delivery|local-services */
async function list(req, res) {
  /* New images in the folder show up on the next page load. */
  res.set('Cache-Control', 'no-cache');
  try {
    res.json({ ok: true, images: await heroImagesService.listHeroImages(req.query.set) });
  } catch (error) {
    console.error('Hero image list failed:', error.message);
    res.json({ ok: true, images: [] });
  }
}

module.exports = { list };
