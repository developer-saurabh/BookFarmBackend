const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Example: protect this with an isSuperAdmin middleware in production
router.post('/register', adminController.registerAdmin);

module.exports = router;
    