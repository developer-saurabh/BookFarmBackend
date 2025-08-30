const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const additional_pdf_controller=require('../controllers/adminAdditionalController')
const { authenticateAdmin } = require('../middlewares/Auth');
const ParseNest = require('../utils/ParseNest');


// Auth Routes

router.post('/send_admin_otp', adminController.sendAdminOtp);
router.post('/register', adminController.registerAdmin);
router.post('/login', adminController.loginAdmin);

// Change Password

router.post('/change_password',authenticateAdmin, adminController.changePassword);

// Forgot_Password

router.post('/forgot_password_send_otp', adminController.forgotPasswordSendOtp);
router.post('/forgot_password_verify_otp', adminController.forgotPasswordVerifyOtp);
router.post('/forgot_password_reset', adminController.forgotPasswordReset);

// update vendor status api

router.post('/update_status',authenticateAdmin, adminController.updateVendorStatus);

//  vendor related 

router.post('/get_all_aprrove_vendors',authenticateAdmin, adminController.getAllApprovedVendors);
router.post('/get_all_vendors',authenticateAdmin, adminController.getAllVendors);
router.post('/get_vendor_by_id',authenticateAdmin, adminController.getVendorWithFarms);

// add ,get  categoris and facilites ,types

router.post('/add_type', adminController.addType);
router.post('/add_farm_category',authenticateAdmin, adminController.addFarmCategory);
router.post('/add_Farm_Facilities',authenticateAdmin, adminController.addFacilities);

router.get('/get_all_categories',ParseNest,authenticateAdmin,adminController.getAllCategories);
router.get('/get_all_facilites',ParseNest,authenticateAdmin,adminController.getAllFacilities);
router.get('/get_all_types',ParseNest,authenticateAdmin,adminController.getAllTypes);

// booking 

router.post('/get_all_bookings', authenticateAdmin,adminController.getAllBookings);
router.post('/get_booking_details',authenticateAdmin, adminController.getBookingByBookingId);
router.post('/update_booking_status',authenticateAdmin, adminController.updateBookingStatusByAdmin);

// customers

router.post('/get_all_customers',authenticateAdmin, adminController.getAllCustomers);

// farms 

router.post('/get_vendor_farm_by_id',adminController.getVendorFarmById);
router.post('/get_all_farms',authenticateAdmin, adminController.getAllFarms);
router.post('/Change_farm_status',authenticateAdmin, adminController.updateFarmStatus);
router.delete('/delete_vendor_farm',ParseNest,authenticateAdmin,adminController.deleteVendorFarm);

// Profile_apis

router.post('/profile',authenticateAdmin, adminController.getAdminProfile);
router.post('/update_profile',authenticateAdmin, adminController.updateAdminProfile);


// Notification apis

router.get('/get_all_active_vendors',authenticateAdmin, adminController.getAllActiveVendors);
router.post('/send_notification_to_active_vendors',authenticateAdmin, adminController.notifyVendorsForAvailabilityChange);

// Adittional Apis


router.post('/additional_pdf',authenticateAdmin, additional_pdf_controller.createBooking);
router.post('/update_additional_pdf',authenticateAdmin, additional_pdf_controller.updateBooking);
router.post('/get_pdf_by_id',authenticateAdmin, additional_pdf_controller.getBooking);
router.post('/get_all_pdf',authenticateAdmin, additional_pdf_controller.getAllBookings);

module.exports = router;
    