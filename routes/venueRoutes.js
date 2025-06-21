const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');
const ParseNest = require('../utils/ParseNest');

router.post(
  '/add_venue',      ParseNest,
  venueController.addVenue   
);

module.exports = router;
