const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');
const ParseNest = require('../utils/ParseNest');
const { vendorAuth } = require('../middlewares/Auth');


router.post(
  '/add_venue', ParseNest,vendorAuth,
  venueController.addVenue   
);

module.exports = router;
