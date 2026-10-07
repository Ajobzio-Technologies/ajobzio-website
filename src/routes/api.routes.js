const express = require('express');
const rateLimit = require('../middleware/rate-limit');
const honeypot = require('../middleware/honeypot');
const { asyncRoute } = require('../middleware/errors');
const quote = require('../controllers/quote.controller');
const places = require('../controllers/places.controller');
const track = require('../controllers/track.controller');
const heroImages = require('../controllers/hero-images.controller');

const router = express.Router();

const quoteLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000, message: 'Too many requests. Please try again later.' });
const placesLimit = rateLimit({ max: 60, windowMs: 60 * 1000, message: 'Too many requests. Please slow down.' });
const trackLimit = rateLimit({ max: 30, windowMs: 60 * 1000, message: 'Too many requests. Please slow down.' });

router.post('/quote', honeypot, quoteLimit, asyncRoute(quote.create));

router.get('/places/autocomplete', placesLimit, asyncRoute(places.autocomplete));
router.get('/places/verify', placesLimit, asyncRoute(places.verify));
router.get('/places/reverse', placesLimit, asyncRoute(places.reverse));
router.get('/maps/config', places.mapsConfig);

router.get('/track', trackLimit, asyncRoute(track.show));

router.get('/hero-images', asyncRoute(heroImages.list));

module.exports = router;
