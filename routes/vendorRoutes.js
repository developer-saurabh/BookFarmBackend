const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const ParseNest = require('../utils/ParseNest');
const { vendorAuth } = require('../middlewares/vendorAuth');


// Example: protect this with an isSuperAdmin middleware in production
router.post('/register', vendorController.registerVendor);
router.post('/login', vendorController.loginVendor);

router.post('/add_Farm',ParseNest,vendorAuth,vendorController.addFarm);
module.exports = router;
    