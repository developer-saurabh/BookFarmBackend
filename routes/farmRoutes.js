const express = require('express');
const router = express.Router();
const { addFarm } = require('../controllers/FarmController');
const { vendorAuth } = require('../middlewares/vendorAuth');
const ParseNest = require('../utils/ParseNest');

router.post('/add_Farm',ParseNest,vendorAuth, addFarm);

module.exports = router;
