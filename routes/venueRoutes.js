const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');
const getUpload = require('../utils/multer');

// Create dynamic upload instance for venues:
const uploadVenue = getUpload('venues');

router.post('/', uploadVenue.array('images', 10), venueController.addVenue);

module.exports = router;
