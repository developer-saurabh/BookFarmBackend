const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateAdmin } = require('../middlewares/Auth');

// Example: protect this with an isSuperAdmin middleware in production
router.post('/register', adminController.registerAdmin);
router.post('/login', adminController.loginAdmin);
router.post('/update_status/:id',authenticateAdmin, adminController.updateVendorStatus);
router.post('/add_farm_category',authenticateAdmin, adminController.addFarmCategory);
router.post('/add_Farm_Facilities',authenticateAdmin, adminController.addFacilities);
router.post('/get_all_bookings',authenticateAdmin, adminController.getAllBookings);
router.post('/get_all_customers',authenticateAdmin, adminController.getAllCustomers);
router.post('/get_all_vendors',authenticateAdmin, adminController.getAllVendors);

module.exports = router;
    