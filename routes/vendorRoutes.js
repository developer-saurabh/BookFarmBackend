const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const ParseNest = require('../utils/ParseNest');
const { vendorAuth } = require('../middlewares/Auth');

// auth 
router.post('/register', vendorController.registerVendor);
router.post('/verify_register_otp', vendorController.verifyVendorOtp);
router.post('/resend_otp', vendorController.resendVendorOtp);

router.post('/login', vendorController.loginVendor);

// Forgot Password

router.post('/forgot_password_send_otp', vendorController.forgotPasswordSendOtp);
router.post('/forgot_password_verify_otp', vendorController.forgotPasswordVerifyOtp);
router.post('/forgot_password_reset', vendorController.forgotPasswordReset);

// Change Password

router.post('/change_password',vendorAuth, vendorController.changePassword);

// farms 

router.post('/add_Farm',ParseNest,vendorAuth,vendorController.addOrUpdateFarm);
router.post('/add_Farm_images',ParseNest,vendorAuth,vendorController.updateFarmImages);

// mange availbility 


router.post('/block_date',ParseNest,vendorAuth, vendorController.blockDate);

router.post('/un_block_date',ParseNest,vendorAuth, vendorController.unblockDate);

// get vendor farmns

router.post('/get_vendor_farm',ParseNest,vendorAuth,vendorController.getVendorFarms);
router.post('/get_vendor_farm_by_id',ParseNest,vendorAuth,vendorController.getVendorFarmById);

// // delte farm 

// router.delete('/delete_vendor_farm',ParseNest,vendorAuth,vendorController.deleteVendorFarm);


// all categoriess and facilites 

router.get('/get_all_categories',ParseNest,vendorAuth,vendorController.getAllCategories);
router.get('/get_all_facilites',ParseNest,vendorAuth,vendorController.getAllFacilities);

// get vendor booking

router.post('/get_vendor_farm_bookings',ParseNest,vendorAuth,vendorController.getVendorFarmBookings);
router.post('/get_booking_details',ParseNest,vendorAuth,vendorController.getBookingByBookingId);
module.exports = router;
    