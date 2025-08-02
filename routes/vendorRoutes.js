const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const ParseNest = require('../utils/ParseNest');
const { vendorAuth } = require('../middlewares/Auth');


// Example: protect this with an isSuperAdmin middleware in production
router.post('/register', vendorController.registerVendor);
router.post('/login', vendorController.loginVendor);

// Forgot Password

router.post('/forgot_password_send_otp', vendorController.forgotPasswordSendOtp);
router.post('/forgot_password_verify_otp', vendorController.forgotPasswordVerifyOtp);
router.post('/forgot_password_reset', vendorController.forgotPasswordReset);

// Change Password

router.post('/change_password',vendorAuth, vendorController.changePassword);


router.post('/add_Farm',ParseNest,vendorAuth,vendorController.addOrUpdateFarm);
router.post('/add_Farm_images',ParseNest,vendorAuth,vendorController.updateFarmImages);

module.exports = router;
    