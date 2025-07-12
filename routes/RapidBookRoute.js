const express = require('express');
const router = express.Router();
const RapidBookController = require('../controllers/RapidBookingController');


router.post('/submit_RapidBooking',RapidBookController.submitRapidBooking);

module.exports = router;
