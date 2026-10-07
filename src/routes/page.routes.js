const express = require('express');
const pages = require('../controllers/pages.controller');

const router = express.Router();

router.get('/', pages.home);
router.get('/track', pages.track);
router.get('/:page', pages.basic);

module.exports = router;
