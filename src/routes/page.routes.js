const express = require('express');
const pages = require('../controllers/pages.controller');

const router = express.Router();

router.get('/', pages.home);
router.get('/track', pages.track);
router.get('/about', pages.about);
router.get('/careers', pages.careers);
router.get('/support', pages.support);
router.get('/privacy-policy', pages.privacyPolicy);
/* One privacy page; the old /privacy link points to it. */
router.get('/privacy', (req, res) => res.redirect(301, '/privacy-policy'));
router.get('/:page', pages.basic);

module.exports = router;
