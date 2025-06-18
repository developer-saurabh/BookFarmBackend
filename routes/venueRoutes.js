const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');
const upload = require('../utils/upload'); // ✅ clean import

// POST /api/venues
router.post(
  '/add_venue',
  upload.array('images', 5), // max 5 images
  venueController.addVenue
);

module.exports = router;
    